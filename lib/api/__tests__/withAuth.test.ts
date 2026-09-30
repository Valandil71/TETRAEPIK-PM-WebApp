import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser }, from }),
}));

import { getAuthenticatedSupabase } from '@/lib/api/withAuth';

describe('getAuthenticatedSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  });

  it('returns 401 without a session', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const auth = await getAuthenticatedSupabase(['pm', 'admin']);
    expect('error' in auth && auth.error.status).toBe(401);
  });

  it('does not look up the role when no roles are required', async () => {
    const auth = await getAuthenticatedSupabase();
    expect('error' in auth).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(['pm', 'admin'])('lets a %s through', async (role) => {
    maybeSingle.mockResolvedValue({ data: { role }, error: null });
    const auth = await getAuthenticatedSupabase(['pm', 'admin']);
    expect('error' in auth).toBe(false);
    expect(from).toHaveBeenCalledWith('users');
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('returns 403 for an employee', async () => {
    maybeSingle.mockResolvedValue({ data: { role: 'employee' }, error: null });
    const auth = await getAuthenticatedSupabase(['pm', 'admin']);
    expect('error' in auth && auth.error.status).toBe(403);
  });

  it('returns 403 when the user has no profile row', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const auth = await getAuthenticatedSupabase(['pm', 'admin']);
    expect('error' in auth && auth.error.status).toBe(403);
  });

  it('returns 500 when the role lookup fails', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const auth = await getAuthenticatedSupabase(['pm', 'admin']);
    expect('error' in auth && auth.error.status).toBe(500);
  });
});
