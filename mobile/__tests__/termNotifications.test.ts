import type { ConceptSummary } from '@devacademy/shared';
import * as Notifications from 'expo-notifications';
import {
  cancelTermNotifications,
  rescheduleTermNotifications,
  planTermNotifications,
} from '@/notifications/termNotifications';

/** Günde 2 terim bildirimi: izin, kapalı ayar, adet ve yalnızca type==='term' iptali */

jest.mock('expo-notifications', () => ({
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  setNotificationChannelAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  AndroidImportance: { DEFAULT: 3 },
}));
jest.mock('expo-device', () => ({ isDevice: true, deviceName: 'x' }));

const N = Notifications as jest.Mocked<typeof Notifications>;
const concepts: ConceptSummary[] = Array.from({ length: 20 }, (_, i) => ({
  id: `c${i}`,
  term: { tr: `Terim${i}`, en: `Term${i}` },
  definition: { tr: `Tanim${i}. Ikinci.` },
  aliases: [],
  lessonCount: 1,
}));
const on = { enabled: true, hours: [10, 19] as [number, number] };

beforeEach(() => {
  jest.clearAllMocks();
  N.getAllScheduledNotificationsAsync.mockResolvedValue([
    { identifier: 't1', content: { data: { type: 'term' } } },
    { identifier: 't2', content: { data: { type: 'term', conceptId: 'x' } } },
    { identifier: 'r1', content: { data: { type: 'reminder' } } },
    { identifier: 'n1', content: { data: undefined } },
  ] as never);
  N.getPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
});

it('yalnızca type==="term" olanları iptal eder', async () => {
  await cancelTermNotifications();
  expect(N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]).sort()).toEqual(['t1', 't2']);
});

it('izin yokken 0 planlar', async () => {
  N.getPermissionsAsync.mockResolvedValue({ status: 'denied' } as never);
  expect(await rescheduleTermNotifications(concepts, 'tr', on)).toBe(0);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('enabled=false iken yalnızca iptal eder', async () => {
  expect(await rescheduleTermNotifications(concepts, 'tr', { ...on, enabled: false })).toBe(0);
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(N.getPermissionsAsync).not.toHaveBeenCalled();
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('izin varken planlayıcının ürettiği kadar bildirim planlar', async () => {
  const expected = planTermNotifications(concepts, on.hours).length;
  expect(expected).toBeGreaterThanOrEqual(13); // 7 gün × 2, bugünün geçmiş slotları hariç
  expect(expected).toBeLessThanOrEqual(14);
  expect(await rescheduleTermNotifications(concepts, 'tr', on)).toBe(expected);
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(expected);
  const first = N.scheduleNotificationAsync.mock.calls[0]![0];
  expect((first.content.data as { type: string }).type).toBe('term');
});

it('kavram yoksa hiçbir şey planlamaz', async () => {
  expect(await rescheduleTermNotifications([], 'tr', on)).toBe(0);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('aynı gün+slot deterministik; geçmiş slotlar atlanır; tek kavramda çökmez', () => {
  const now = new Date(2026, 5, 10, 12, 0);
  const a = planTermNotifications(concepts, [10, 19], now);
  const b = planTermNotifications([...concepts].reverse(), [10, 19], now);
  expect(a.map((p) => p.concept.id)).toEqual(b.map((p) => p.concept.id));
  expect(a).toHaveLength(13);
  expect(planTermNotifications(concepts.slice(0, 1), [10, 19], now)).toHaveLength(13);
});
