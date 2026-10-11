import { describe, expect, it } from 'vitest';
import { isHiddenTestAccount } from '@/lib/users/testAccounts';

describe('isHiddenTestAccount', () => {
  it('hides the test accounts outside localhost, ignoring case and accents', () => {
    expect(isHiddenTestAccount('Francisco Rodrigues', false)).toBe(true);
    expect(isHiddenTestAccount('  xiconi das cóves ', false)).toBe(true);
  });

  it('shows every account on localhost', () => {
    expect(isHiddenTestAccount('Francisco Rodrigues', true)).toBe(false);
    expect(isHiddenTestAccount('Xiconi das Coves', true)).toBe(false);
  });

  it('never hides real accounts', () => {
    expect(isHiddenTestAccount('Maria Silva', false)).toBe(false);
  });

  it('hides them in builds by default (NODE_ENV is not "development")', () => {
    expect(isHiddenTestAccount('Francisco Rodrigues')).toBe(true);
  });
});
