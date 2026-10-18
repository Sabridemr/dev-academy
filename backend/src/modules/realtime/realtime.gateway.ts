import { Injectable, Logger } from '@nestjs/common';
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
import type { AccessTokenPayload } from '../../common/auth/jwt-auth.guard';

interface SocketData {
  userId?: string;
  role?: string;
}

/**
 * WebSocket (socket.io) geçidi.
 *  - Kimliği doğrulanmış kullanıcı kendi odasına (user:<id>) alınır; ilerleme/rozet/seri olayları buraya gider.
 *  - "content.published" tüm istemcilere yayınlanır (istemci cache'ini tazeler).
 *  - Simülasyon odaları: aynı simülasyonu izleyen kullanıcılar girdi olaylarını paylaşır (sınıf içi canlı demo).
 */
@Injectable()
@WebSocketGateway({ cors: { origin: true, credentials: true }, path: '/ws' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth?.token as string | undefined) ?? bearerFromHeader(client.handshake.headers.authorization);
    const data = client.data as SocketData;
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
        data.userId = payload.sub;
        data.role = payload.role;
        await client.join(`user:${payload.sub}`);
      } catch {
        // anonim bağlantı: yalnızca genel yayınlar
      }
    }
    client.emit('hello', { authenticated: Boolean(data.userId), serverTime: new Date().toISOString() });
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as SocketData;
    if (data.userId) this.logger.debug(`Bağlantı kapandı: ${data.userId}`);
  }

  @SubscribeMessage('subscribe.lesson')
  async subscribeLesson(@ConnectedSocket() client: Socket, @MessageBody() body: { lessonId?: string }): Promise<{ ok: boolean }> {
    if (!body?.lessonId) return { ok: false };
    await client.join(`lesson:${body.lessonId}`);
    return { ok: true };
  }

  @SubscribeMessage('simulation.join')
  async joinSimulation(@ConnectedSocket() client: Socket, @MessageBody() body: { simulationId?: string }): Promise<{ ok: boolean; members: number }> {
    if (!body?.simulationId) return { ok: false, members: 0 };
    const room = `sim:${sanitize(body.simulationId)}`;
    await client.join(room);
    const members = (await this.server.in(room).fetchSockets()).length;
    this.server.to(room).emit('simulation.members', { simulationId: body.simulationId, members });
    return { ok: true, members };
  }

  @SubscribeMessage('simulation.input')
  relaySimulationInput(@ConnectedSocket() client: Socket, @MessageBody() body: { simulationId?: string; data?: unknown }): void {
    if (!body?.simulationId) return;
    const room = `sim:${sanitize(body.simulationId)}`;
    if (!client.rooms.has(room)) return;
    const data = client.data as SocketData;
    const event: WsServerEvent = { type: 'simulation.tick', payload: { simulationId: body.simulationId, data: { input: body.data, from: data.userId ?? 'anon' } } };
    client.to(room).emit('event', event);
  }

  emitToUser(userId: string, event: WsServerEvent): void {
    this.server?.to(`user:${userId}`).emit('event', event);
  }

  broadcast(event: WsServerEvent): void {
    this.server?.emit('event', event);
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
