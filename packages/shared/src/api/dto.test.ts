import { describe, expect, it } from 'vitest';
import { isValidTimeZone, UpdateProfileSchema } from './dto';

describe('saat dilimi doğrulaması', () => {
  it('geçerli IANA saat dilimlerini kabul eder', () => {
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Europe/Istanbul')).toBe(true);
    expect(UpdateProfileSchema.safeParse({ timezone: 'America/New_York' }).success).toBe(true);
  });

  it('geçersiz saat dilimini reddeder', () => {
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(UpdateProfileSchema.safeParse({ timezone: 'Nope/Zone' }).success).toBe(false);
  });

  it('timezone verilmezse şema yine geçer', () => {
    expect(UpdateProfileSchema.safeParse({ displayName: 'Ada' }).success).toBe(true);
  });
});
