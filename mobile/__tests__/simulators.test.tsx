import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { estimateCapacity } from '@devacademy/shared';
import { CapacityEstimatorSim, initialCapacityInput } from '@/components/interactive/CapacityEstimatorSim';
import { PipelineSim } from '@/components/interactive/PipelineSim';
import { RequestJourneySim } from '@/components/interactive/RequestJourneySim';
import { MOBILE_SIMULATORS } from '@/components/interactive/registry';
import { createPipelineState, defaultFailStage, fleetView, parseStages, pipelineTick, type PipelineConfig, type PipelineState } from '@/components/interactive/pipeline';
import { batchJourney, buildHops, classify, computeJourney, parseLayers, splitSpec, type JourneyOptions } from '@/components/interactive/requestJourney';
import { useSettings } from '@/stores/settings';

/** Mobil simülatörler: request-journey, capacity-estimator, pipeline (saf mantık + bileşen etkileşimi) */

beforeEach(() => {
  useSettings.setState({ locale: 'en' });
  // reduced-motion sorgusu testte hiç çözülmez (act dışı durum güncellemesi olmasın)
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise<boolean>(() => {}));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/* ------------------------------ request-journey: saf mantık ------------------------------ */

const baseOpts: JourneyOptions = { dns: false, cdn: false, cache: false, rttMs: 20, http3: false, injectFail: false, failureStage: '' };
const noSlow = { slowService: '', slowPenaltyMs: 300, coldToggle: false, coldStart: false };

describe('requestJourney', () => {
  it('splitSpec "ad:ms" biçimini ayırır', () => {
    expect(splitSpec('ranking:30')).toEqual({ id: 'ranking', ms: 30 });
    expect(splitSpec('db')).toEqual({ id: 'db' });
  });

  it('classify katman türlerini tanır', () => {
    expect(classify('browser').kind).toBe('client');
    expect(classify('cdn-edge').kind).toBe('cdn');
    expect(classify('load-balancer').kind).toBe('lb');
    expect(classify('redis-cache').kind).toBe('cache');
    expect(classify('database').kind).toBe('db');
    expect(classify('tls').kind).toBe('net');
    expect(classify('payment-service').kind).toBe('service');
  });

  it('parseLayers istemci yoksa "user" ekler ve layers/path/stages/services okur', () => {
    expect(parseLayers({ path: 'dns,cdn-edge,database' })).toEqual(['user', 'dns', 'cdn-edge', 'database']);
    expect(parseLayers({ layers: 'browser,cdn,db' })).toEqual(['browser', 'cdn', 'db']);
    expect(parseLayers({ services: 'gateway,order-service' })[0]).toBe('user');
    expect(parseLayers({})).toHaveLength(8);
  });

  it('cache hit kısa devre yapar ve toplam gecikmeyi düşürür', () => {
    const hops = buildHops(parseLayers({ layers: 'client,cdn,gateway,service,cache,db' }), noSlow);
    const miss = computeJourney(hops, baseOpts);
    const hit = computeJourney(hops, { ...baseOpts, cache: true });
    expect(miss.terminal).toBe(hops.length - 1);
    expect(hit.terminal).toBe(4);
    expect(hit.total).toBeLessThan(miss.total);
    expect(computeJourney(hops, { ...baseOpts, cdn: true }).visited).toHaveLength(2);
  });

  it('hata enjeksiyonu isteği o katmanda keser', () => {
    const hops = buildHops(parseLayers({ stages: 'gateway,orders,catalog,payments,db' }), noSlow);
    const j = computeJourney(hops, { ...baseOpts, injectFail: true, failureStage: 'payments' });
    expect(j.failed).toBe(true);
    expect(hops[j.terminal].id).toBe('payments');
  });

  it('yavaş servis, cold start ve ms geçersiz kılma uygulanır', () => {
    const hops = buildHops(['user', 'gateway:5', 'payment-service'], { ...noSlow, slowService: 'payment-service', slowPenaltyMs: 50 });
    expect(hops[1].ms).toBe(5);
    expect(hops[2].ms).toBe(80);
    const cold = buildHops(['client', 'lambda'], { slowService: '', slowPenaltyMs: 0, coldToggle: true, coldStart: true });
    expect(cold[1].ms).toBe(30 + 770);
  });

  it('HTTP/3 TCP el sıkışmasını kaldırır', () => {
    const hops = buildHops(parseLayers({ stages: 'dns,tcp,tls,http' }), noSlow);
    const h1 = computeJourney(hops, { ...baseOpts, rttMs: 40 });
    const h3 = computeJourney(hops, { ...baseOpts, rttMs: 40, http3: true });
    expect(h1.total - h3.total).toBe(40);
  });

  it('batchJourney deterministik rng ile ortalama/p95 üretir', () => {
    const hops = buildHops(parseLayers({ layers: 'client,service,cache,db' }), noSlow);
    const allHit = batchJourney(hops, baseOpts, 100, () => 0);
    const allMiss = batchJourney(hops, baseOpts, 0, () => 0.99);
    expect(allHit.avg).toBe(allHit.p95);
    expect(allMiss.avg).toBeGreaterThan(allHit.avg);
  });
});

/* ------------------------------ pipeline: saf motor ------------------------------ */

function runToEnd(stages: string[], cfg: PipelineConfig): { state: PipelineState; logs: string[] } {
  let state = createPipelineState(stages.length, true);
  const logs: string[] = [];
  for (let i = 0; i < 500 && state.running; i++) {
    const r = pipelineTick(state, stages, cfg);
    state = r.state;
    logs.push(...r.logs.map((l) => l.type));
  }
  return { state, logs };
}

const cfg: PipelineConfig = { inject: false, failAt: '', canaryErr: 0.5, retries: 1, strategy: 'canary' };

describe('pipeline', () => {
  it('parseStages ve defaultFailStage', () => {
    expect(parseStages({ stages: 'a, b ,c' })).toEqual(['a', 'b', 'c']);
    expect(parseStages({})[0]).toBe('commit');
    expect(defaultFailStage(['lint', 'unit-test', 'build'], 'nope')).toBe('unit-test');
    expect(defaultFailStage(['lint', 'unit-test'], 'lint')).toBe('lint');
  });

  it('hatasız çalıştırma tüm aşamaları başarıyla bitirir, %100 v2 trafiği', () => {
    const stages = ['lint', 'build', 'deploy'];
    const { state } = runToEnd(stages, cfg);
    expect(state.outcome).toBe('ok');
    expect(state.status).toEqual(['success', 'success', 'success']);
    expect(fleetView(state, 'rolling').v2Traffic).toBe(100);
    // 2 + 2 + 6 tik
    expect(state.elapsed).toBe(10);
  });

  it('hata enjeksiyonu yeniden denemelerden sonra durur, sonraki aşamalar atlanır', () => {
    const stages = ['lint', 'e2e-test', 'deploy'];
    const { state, logs } = runToEnd(stages, { ...cfg, inject: true, failAt: 'e2e-test', retries: 2 });
    expect(state.outcome).toBe('failed');
    expect(state.status).toEqual(['success', 'failed', 'skipped']);
    expect(logs.filter((l) => l === 'retry')).toHaveLength(2);
  });

  it('canary hata oranı eşiği aşarsa geri alınır', () => {
    const stages = ['build', 'canary-5', 'production'];
    const { state, logs } = runToEnd(stages, { ...cfg, canaryErr: 5 });
    expect(state.outcome).toBe('rolledback');
    expect(state.status).toEqual(['success', 'rolledback', 'skipped']);
    expect(logs).toContain('rollback');
    expect(fleetView(state, 'canary').v2Traffic).toBe(0);
  });

  it('fleetView stratejiye göre trafik dağıtır', () => {
    const s = { ...createPipelineState(2), deployProgress: 0.5 };
    expect(fleetView(s, 'rolling').v2Traffic).toBe(50);
    expect(fleetView(s, 'blue-green').v2Traffic).toBe(0);
    expect(fleetView(s, 'canary').v2Traffic).toBe(25);
    expect(fleetView(s, 'blue-green').versions.filter((v) => v === 2)).toHaveLength(4);
  });
});

/* ------------------------------ Bileşenler ------------------------------ */

describe('kayıt', () => {
  it('üç yeni simülatör mobilde kayıtlı', () => {
    expect(MOBILE_SIMULATORS['request-journey']).toBe(RequestJourneySim);
    expect(MOBILE_SIMULATORS['capacity-estimator']).toBe(CapacityEstimatorSim);
    expect(MOBILE_SIMULATORS.pipeline).toBe(PipelineSim);
  });
});

describe('RequestJourneySim', () => {
  it('istek gönderir, cache hit yolu kısaltır', () => {
    jest.useFakeTimers();
    const onInteract = jest.fn();
    render(<RequestJourneySim params={{ layers: 'client,cdn,gateway,service,cache,db' }} lessonId="l1" onInteract={onInteract} />);
    fireEvent.press(screen.getByTestId('rj-send'));
    expect(onInteract).toHaveBeenCalled();
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByTestId('rj-result')).toHaveTextContent(/Response served by “db”/);
    expect(screen.getByText('6/6')).toBeTruthy();

    fireEvent(screen.getByTestId('rj-cache'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('rj-send'));
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByTestId('rj-result')).toHaveTextContent(/Response served by “cache”/);
    expect(screen.getByText('5/6')).toBeTruthy();
  });

  it('hata enjeksiyonu ve 20 isteklik toplu gönderim', () => {
    jest.useFakeTimers();
    render(<RequestJourneySim params={{ stages: 'gateway,orders,catalog,payments,db', failureStage: 'payments' }} lessonId="l1" onInteract={() => {}} />);
    fireEvent(screen.getByTestId('rj-fail'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('rj-send'));
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByTestId('rj-result')).toHaveTextContent(/failed with 5xx at “payments”/);
    expect(screen.queryByText('p95 (20 req)')).toBeNull();
    fireEvent.press(screen.getByTestId('rj-batch'));
    expect(screen.getByText('p95 (20 req)')).toBeTruthy();
  });

  it('bütçe aşımını gösterir', () => {
    jest.useFakeTimers();
    render(<RequestJourneySim params={{ budgetMs: 10, stages: 'gateway:5,ranking:30' }} lessonId="l1" onInteract={() => {}} />);
    fireEvent.press(screen.getByTestId('rj-send'));
    act(() => {
      jest.runAllTimers();
    });
    expect(screen.getByText(/Over budget/)).toBeTruthy();
  });
});

describe('CapacityEstimatorSim', () => {
  it('ders parametrelerini okur ve girdi değişince sonuçları günceller', () => {
    const params = { dau: 50000000, readsPerUserPerDay: 100, writesPerUserPerDay: 3, avgWriteSizeBytes: 2000 };
    const input = initialCapacityInput(params);
    expect(input.dau).toBe(50_000_000);
    expect(input.retentionYears).toBe(5); // varsayılan
    const onInteract = jest.fn();
    render(<CapacityEstimatorSim params={params} lessonId="l1" onInteract={onInteract} />);
    const servers = (dau: number) => String(estimateCapacity({ ...input, dau }, 1000).appServers);
    expect(screen.getByText(servers(50_000_000))).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('cap-dau'), '500');
    expect(onInteract).toHaveBeenCalled();
    // 500 kullanıcı → tek sunucu yeter
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText(servers(50_000_000))).toBeNull();
  });

  it('geçersiz giriş hesaplamayı bozmaz ve sınırlar uygulanır', () => {
    expect(initialCapacityInput({ hotDataRatio: 5, replicationFactor: 'x' }).hotDataRatio).toBe(1);
    expect(initialCapacityInput({ replicationFactor: 'x' }).replicationFactor).toBe(3);
    render(<CapacityEstimatorSim params={{}} lessonId="l1" onInteract={() => {}} />);
    fireEvent.changeText(screen.getByTestId('cap-dau'), 'abc');
    expect(screen.getByDisplayValue('abc')).toBeTruthy();
  });
});

describe('PipelineSim', () => {
  it('çalıştırınca aşamalar ilerler, enjekte hata pipeline’ı durdurur', () => {
    jest.useFakeTimers();
    const onInteract = jest.fn();
    render(<PipelineSim params={{ stages: 'lint,e2e-test,deploy', failureStage: 'e2e-test' }} lessonId="l1" onInteract={onInteract} />);
    fireEvent(screen.getByTestId('pipe-inject'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('pipe-run'));
    expect(onInteract).toHaveBeenCalled();
    // Tik başına bir durum güncellemesi; her tik ayrı act içinde ilerletilir
    for (let i = 0; i < 20; i++) {
      act(() => {
        jest.advanceTimersByTime(600);
      });
    }
    expect(screen.getByTestId('pipe-outcome')).toHaveTextContent(/Pipeline stopped at “e2e-test”/);
    expect(screen.getByLabelText('3. deploy: skipped')).toBeTruthy();
  });

  it('hatasız çalıştırma dağıtımı tamamlar', () => {
    jest.useFakeTimers();
    render(<PipelineSim params={{ stages: 'build,deploy' }} lessonId="l1" onInteract={() => {}} />);
    fireEvent.press(screen.getByTestId('pipe-run'));
    for (let i = 0; i < 12; i++) {
      act(() => {
        jest.advanceTimersByTime(600);
      });
    }
    expect(screen.getByTestId('pipe-outcome')).toHaveTextContent(/Deployment completed/);
    expect(screen.getByText('v2 100%')).toBeTruthy();
  });
});
