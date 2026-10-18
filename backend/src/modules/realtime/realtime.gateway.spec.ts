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
  const gateway = new RealtimeGateway({} as never, {} as never);

  it('anonim istemcinin girdisini yaymaz', () => {
    const { socket, emit } = fakeSocket();
    gateway.relaySimulationInput(socket as never, { simulationId: 'demo', data: { x: 1 } });
    expect(emit).not.toHaveBeenCalled();
  });

  it('kimliği doğrulanmış istemcinin girdisini odaya yayar', () => {
    const { socket, emit } = fakeSocket('u1');
    gateway.relaySimulationInput(socket as never, { simulationId: 'demo', data: { x: 1 } });
    expect(emit).toHaveBeenCalledWith('event', expect.objectContaining({ type: 'simulation.tick' }));
  });

  it('odada olmayan istemcinin girdisini yaymaz', () => {
    const { socket, emit } = fakeSocket('u1');
    gateway.relaySimulationInput(socket as never, { simulationId: 'baska', data: {} });
    expect(emit).not.toHaveBeenCalled();
  });

  it('saniyede 20 mesajdan fazlasını düşürür', () => {
    const { socket, emit } = fakeSocket('u1');
    for (let i = 0; i < 30; i++) gateway.relaySimulationInput(socket as never, { simulationId: 'demo', data: i });
    expect(emit).toHaveBeenCalledTimes(20);
  });
});
