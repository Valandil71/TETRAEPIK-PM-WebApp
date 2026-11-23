import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubSentryEvent, sentryDataCollection, stripUrlQuery } from '@/lib/monitoring/sentryOptions';

describe('sentry privacy settings', () => {
  it('turns off user info, cookies, bodies, query strings and local variables', () => {
    expect(sentryDataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
    });
  });

  it('strips cookies, bodies, auth headers, user identity and bearer tokens from events', () => {
    const event = {
      type: undefined,
      message: 'call failed with Bearer abc.def.ghi',
      request: {
        url: 'https://app.example.com/api/sap/sync',
        cookies: { 'sb-access-token': 'secret' },
        data: '{"password":"x"}',
        query_string: 'code=123',
        headers: {
          'user-agent': 'Mozilla',
          Authorization: 'Bearer abc',
          'x-approuter-authorization': 'Bearer abc',
          Cookie: 'a=b',
        },
      },
      user: { id: 'user-1', email: 'pm@example.com', ip_address: '1.2.3.4' },
      exception: { values: [{ type: 'Error', value: 'Token Basic dXNlcjpwYXNz rejected' }] },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.data).toBeUndefined();
    expect(scrubbed.request?.query_string).toBeUndefined();
    expect(scrubbed.request?.headers).toEqual({
      'user-agent': 'Mozilla',
      Authorization: '[Filtered]',
      'x-approuter-authorization': '[Filtered]',
      Cookie: '[Filtered]',
    });
    expect(scrubbed.user).toEqual({ id: 'user-1' });
    expect(scrubbed.message).toBe('call failed with Bearer [Filtered]');
    expect(scrubbed.exception?.values?.[0].value).toBe('Token Basic [Filtered] rejected');
  });

  it('scrubs contexts, extra and breadcrumbs too', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    const event = {
      type: undefined,
      contexts: {
        upstream: { url: 'https://sap.example.com/x', body: `{"access_token":"${jwt}"}`, attempts: [{ status: 503 }] },
        route_context: { requestedProjects: [{ projectId: 1 }], refresh_token: 'abc' },
      },
      extra: { note: `Bearer ${jwt}` },
      breadcrumbs: [{ message: `got ${jwt}`, data: { Authorization: 'Basic xyz' } }],
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    const json = JSON.stringify(scrubbed);

    expect(json).not.toContain(jwt);
    expect(json).not.toContain('Basic xyz');
    expect(scrubbed.contexts?.route_context).toMatchObject({
      requestedProjects: [{ projectId: 1 }],
      refresh_token: '[Filtered]',
    });
    expect(scrubbed.contexts?.upstream).toMatchObject({ attempts: [{ status: 503 }] });
  });

  it('strips query strings from URLs', () => {
    expect(stripUrlQuery('https://sap.example.com/v1/x?token=abc#frag')).toBe('https://sap.example.com/v1/x');
  });
});
