import { describe, expect, it } from 'vitest';
import { dateTimeInputToTimestamp, toDateTimeInputValue } from '@/lib/date-utils';

// Assertions compare in local time so they hold in any timezone the tests run in.
describe('toDateTimeInputValue', () => {
  it('formats a timestamp as the local yyyy-MM-ddTHH:mm date and time', () => {
    const iso = new Date(2026, 9, 2, 14, 30).toISOString();
    expect(toDateTimeInputValue(iso)).toBe('2026-10-02T14:30');
  });

  it('returns an empty string for missing or invalid values', () => {
    expect(toDateTimeInputValue(null)).toBe('');
    expect(toDateTimeInputValue(undefined)).toBe('');
    expect(toDateTimeInputValue('not a date')).toBe('');
  });
});

describe('dateTimeInputToTimestamp', () => {
  const original = new Date(2026, 9, 2, 14, 30, 45).toISOString(); // 2 Oct, 14:30:45 local

  it('returns the stored timestamp untouched when the date and time did not change', () => {
    expect(dateTimeInputToTimestamp('2026-10-02T14:30', original)).toBe(original);
  });

  it('applies a new time on the same day', () => {
    const result = new Date(dateTimeInputToTimestamp('2026-10-02T09:15', original)!);
    expect(toDateTimeInputValue(result.toISOString())).toBe('2026-10-02T09:15');
  });

  it('applies a new date and time', () => {
    const result = new Date(dateTimeInputToTimestamp('2027-01-31T17:00', original)!);
    expect(toDateTimeInputValue(result.toISOString())).toBe('2027-01-31T17:00');
  });

  it('reads the input as local time when there is no stored deadline', () => {
    expect(dateTimeInputToTimestamp('2026-10-05T16:00', null)).toBe(
      new Date(2026, 9, 5, 16, 0).toISOString()
    );
    expect(dateTimeInputToTimestamp('2026-10-05T16:00', 'garbage')).toBe(
      new Date(2026, 9, 5, 16, 0).toISOString()
    );
  });

  it('returns null when the value is cleared or malformed', () => {
    expect(dateTimeInputToTimestamp('', original)).toBeNull();
    expect(dateTimeInputToTimestamp(null, original)).toBeNull();
    expect(dateTimeInputToTimestamp('2026-10-05', original)).toBeNull();
    expect(dateTimeInputToTimestamp('05/10/2026 16:00', original)).toBeNull();
  });
});
