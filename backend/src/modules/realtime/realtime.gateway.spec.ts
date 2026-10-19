import { RealtimeGateway } from './realtime.gateway';

function fakeSocket(userId?: string) {
  const emit = jest.fn();
  return {
    emit,
    socket: {
      id: `s-${Math.random()}`,
      rooms: new Set(['sim:demo']),
      data: userId ? { userId } : {},
      to: jest.fn(() => ({ emit })),
    },
  };
}

describe('RealtimeGateway simulation.input', () => {
  const gateway = new RealtimeGateway({} as never, {} as never, {} as never);

  it('anonim istemcinin girdisini yaymaz', () => {
    const { socket, emit } = fakeSocket();
    gateway.relaySimulationInput(socket as never, { simulationId: 'demo', data: { x: 1 } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('kimliği doğrulanmış istemcinin girdisini odaya yayar', () => {
    const { socket, emit } = fakeSocket('u1');
    gateway.relaySimulationInput(socket as never, { simulationId: 'demo', data: { x: 1 } });
    expect(emit).toHaveBeenCalledWith(
      'event',
      expect.objectContaining({ type: 'simulation.tick' }),
    );
  });

  it('odada olmayan istemcinin girdisini yaymaz', () => {
    const { socket, emit } = fakeSocket('u1');
    gateway.relaySimulationInput(socket as never, { simulationId: 'baska', data: {} });
    expect(emit).not.toHaveBeenCalled();
  });

  it('saniyede 20 mesajdan fazlasını düşürür', () => {
    const { socket, emit } = fakeSocket('u1');
    for (let i = 0; i < 30; i++)
      gateway.relaySimulationInput(socket as never, { simulationId: 'demo', data: i });
    expect(emit).toHaveBeenCalledTimes(20);
  });
});

describe('RealtimeGateway bağlantı kimlik doğrulaması', () => {
  const config = { get: () => 'secret' };
  const connect = async (payload: Record<string, unknown>, state: unknown) => {
    const jwt = { verifyAsync: jest.fn(async () => payload) };
    const authState = { get: jest.fn(async () => state) };
    const gateway = new RealtimeGateway(jwt as never, config as never, authState as never);
    const client = {
      handshake: { auth: { token: 't' }, headers: {} },
      data: {} as Record<string, unknown>,
      join: jest.fn(async () => undefined),
      leave: jest.fn(async () => undefined),
      emit: jest.fn(),
    };
    await gateway.handleConnection(client as never);
    gateway.handleDisconnect({ ...client, id: 'x' } as never);
    return client;
  };
  const exp = Math.floor(Date.now() / 1000) + 900;

  it('geçerli access token ile kişisel odaya alınır', async () => {
    const c = await connect(
      { sub: 'u1', type: 'access', iat: 1, exp },
      { role: 'student', tokensValidAfter: null },
    );
    expect(c.join).toHaveBeenCalledWith('user:u1');
  });

  it('access olmayan token, silinmiş kullanıcı ya da iptal edilmiş oturumla anonim kalır', async () => {
    for (const [payload, state] of [
      [
        { sub: 'u1', type: 'refresh', iat: 1, exp },
        { role: 'student', tokensValidAfter: null },
      ],
      [{ sub: 'u1', type: 'access', iat: 1, exp }, null],
      [
        { sub: 'u1', type: 'access', iat: 1, exp },
        { role: 'student', tokensValidAfter: 5000 },
      ],
    ] as const) {
      const c = await connect(payload, state);
      expect(c.join).not.toHaveBeenCalled();
      expect(c.emit).toHaveBeenCalledWith(
        'hello',
        expect.objectContaining({ authenticated: false }),
      );
    }
  });
});
