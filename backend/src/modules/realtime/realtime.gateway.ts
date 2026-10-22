import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { WsServerEvent } from '@devacademy/shared';
import type { Env } from '../../config/env';
import { AuthStateService } from '../../common/auth/auth-state.service';
import type { AccessTokenPayload } from '../../common/auth/jwt-auth.guard';
import { MetricsService } from '../../common/metrics/metrics.service';

const RELAY_WINDOW_MS = 1000;
const RELAY_MAX = 20;
/** Bir soketin aynı anda katılabileceği simülasyon odası sayısı (oda başına fetchSockets maliyeti var) */
const MAX_SIM_ROOMS = 5;

interface SocketData {
  userId?: string;
  role?: string;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

/**
 * WebSocket (socket.io) geçidi.
 *  - Kimliği doğrulanmış kullanıcı kendi odasına (user:<id>) alınır; ilerleme/rozet/seri olayları buraya gider.
 *  - "content.published" tüm istemcilere yayınlanır (istemci cache'ini tazeler).
 *  - Simülasyon odaları: aynı simülasyonu izleyen kullanıcılar girdi olaylarını paylaşır (sınıf içi canlı demo).
 */
@Injectable()
// CORS, main.ts'deki CorsIoAdapter ile HTTP beyaz listesinden uygulanır
@WebSocketGateway({ path: '/ws' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  /** Soket başına basit hız sınırı: simülasyon girdisi relay'i (pencere başına en fazla RELAY_MAX mesaj) */
  private readonly relayCounters = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly authState: AuthStateService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    this.metrics?.wsConnected();
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      bearerFromHeader(client.handshake.headers.authorization);
    const data = client.data as SocketData;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload & { exp?: number }>(token, {
          secret: this.config.get('JWT_ACCESS_SECRET'),
        });
        // HTTP guard ile aynı kurallar: yalnızca access token, kullanıcı aktif ve oturumları kapatılmamış
        if (payload.type !== 'access') throw new Error('wrong token type');
        const state = await this.authState.get(payload.sub);
        if (!state || !AuthStateService.isIssuedAfterRevocation(state, payload.iat))
          throw new Error('revoked');
        data.userId = payload.sub;
        data.role = state.role;
        await client.join(`user:${payload.sub}`);
        // Token süresi dolunca kişisel odadan çıkar; istemci yeni token'la yeniden bağlanır
        if (payload.exp) {
          const ms = payload.exp * 1000 - Date.now();
          data.expiryTimer = setTimeout(() => this.downgrade(client), Math.max(0, ms));
        }
      } catch {
        // anonim bağlantı: yalnızca genel yayınlar
      }
    }
    client.emit('hello', {
      authenticated: Boolean(data.userId),
      serverTime: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.metrics?.wsDisconnected();
    const data = client.data as SocketData;
    if (data.expiryTimer) clearTimeout(data.expiryTimer);
    this.relayCounters.delete(client.id);
    if (data.userId) this.logger.debug(`Bağlantı kapandı: ${data.userId}`);
  }

  /** Kimliği düşür: kişisel odadan çık, bağlantı anonim olarak sürer */
  private downgrade(client: Socket): void {
    const data = client.data as SocketData;
    if (!data.userId) return;
    void client.leave(`user:${data.userId}`);
    data.userId = undefined;
    data.role = undefined;
    client.emit('hello', { authenticated: false, serverTime: new Date().toISOString() });
  }

  @SubscribeMessage('simulation.join')
  async joinSimulation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { simulationId?: string },
  ): Promise<{ ok: boolean; members: number }> {
    if (!body?.simulationId) return { ok: false, members: 0 };
    const room = `sim:${sanitize(body.simulationId)}`;
    const simRooms = [...client.rooms].filter((r) => r.startsWith('sim:'));
    if (!client.rooms.has(room) && simRooms.length >= MAX_SIM_ROOMS)
      return { ok: false, members: 0 };
    await client.join(room);
    const members = (await this.server.in(room).fetchSockets()).length;
    this.server.to(room).emit('simulation.members', { simulationId: body.simulationId, members });
    return { ok: true, members };
  }

  @SubscribeMessage('simulation.input')
  relaySimulationInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { simulationId?: string; data?: unknown },
  ): void {
    const data = client.data as SocketData;
    if (!data.userId) return; // anonim istemciler girdi yayınlayamaz
    if (!body?.simulationId) return;
    const room = `sim:${sanitize(body.simulationId)}`;
    if (!client.rooms.has(room)) return;
    if (!this.allowRelay(client.id)) return;
    const event: WsServerEvent = {
      type: 'simulation.tick',
      payload: { simulationId: body.simulationId, data: { input: body.data, from: data.userId } },
    };
    client.to(room).emit('event', event);
  }

  private allowRelay(socketId: string, now = Date.now()): boolean {
    const c = this.relayCounters.get(socketId);
    if (!c || now - c.windowStart >= RELAY_WINDOW_MS) {
      this.relayCounters.set(socketId, { count: 1, windowStart: now });
      return true;
    }
    c.count += 1;
    return c.count <= RELAY_MAX;
  }

  emitToUser(userId: string, event: WsServerEvent): void {
    this.server?.to(`user:${userId}`).emit('event', event);
  }

  broadcast(event: WsServerEvent): void {
    this.server?.emit('event', event);
  }

  /** Hesap silindiğinde kullanıcının tüm soketlerini (Redis adaptörüyle tüm örneklerde) kapatır */
  disconnectUser(userId: string): void {
    this.server?.in(`user:${userId}`).disconnectSockets(true);
  }
}

function bearerFromHeader(header?: string): string | undefined {
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : undefined;
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}
