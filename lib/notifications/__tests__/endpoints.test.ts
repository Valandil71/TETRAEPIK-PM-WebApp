import { describe, expect, it } from 'vitest';
import { isAllowedPushEndpoint } from '@/lib/notifications/endpoints';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-db5p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('accepts %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
    'https://fcm.googleapis.com.evil.com/x',
    'https://evilnotify.windows.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'http://169.254.169.254/latest/meta-data',
    'https://localhost/x',
    'not a url',
  ])('rejects %s', (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});
