import { describe, expect, it } from 'vitest';
import { dateInputToTimestamp, toDateInputValue } from '@/lib/date-utils';

// Assertions compare in local time so they hold in any timezone the tests run in.
describe('toDateInputValue', () => {
  it('formats a timestamp as the local yyyy-MM-dd day', () => {
    const iso = new Date(2026, 9, 2, 14, 30).toISOString();
    expect(toDateInputValue(iso)).toBe('2026-10-02');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(toDateInputValue(null)).toBe('');
    expect(toDateInputValue(undefined)).toBe('');
    expect(toDateInputValue('not a date')).toBe('');
  });
});

describe('dateInputToTimestamp', () => {
  const original = new Date(2026, 9, 2, 14, 30).toISOString(); // 2 Oct, 14:30 local

  it('returns the stored timestamp untouched when the day did not change', () => {
    expect(dateInputToTimestamp('2026-10-02', original)).toBe(original);
  });

  it('keeps the original time of day when the day changes', () => {
    const result = new Date(dateInputToTimestamp('2026-10-05', original)!);
    expect(toDateInputValue(result.toISOString())).toBe('2026-10-05');
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(30);
  });

  it('keeps the time of day across month and year boundaries', () => {
    const result = new Date(dateInputToTimestamp('2027-01-31', original)!);
    expect(toDateInputValue(result.toISOString())).toBe('2027-01-31');
    expect(result.getHours()).toBe(14);
  });

  it('uses midnight UTC when there is no stored deadline', () => {
    expect(dateInputToTimestamp('2026-10-05', null)).toBe('2026-10-05T00:00:00.000Z');
    expect(dateInputToTimestamp('2026-10-05', 'garbage')).toBe('2026-10-05T00:00:00.000Z');
  });

  it('returns null when the date is cleared or malformed', () => {
    expect(dateInputToTimestamp('', original)).toBeNull();
    expect(dateInputToTimestamp(null, original)).toBeNull();
    expect(dateInputToTimestamp('05/10/2026', original)).toBeNull();
  });
});
