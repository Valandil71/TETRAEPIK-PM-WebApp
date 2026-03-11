import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

type AuthSuccess = {
  supabase: ReturnType<typeof createServerClient>;
  user: User;
};

type AuthFailure = {
  error: NextResponse;
};

/**
 * Creates an authenticated Supabase server client from cookies.
 * Returns `{ supabase, user }` on success or `{ error: NextResponse }` on failure.
 *
 * Usage:
 * ```ts
 * const auth = await getAuthenticatedSupabase();
 * if ('error' in auth) return auth.error;
 * const { supabase, user } = auth;
 * ```
 */
export async function getAuthenticatedSupabase(): Promise<AuthSuccess | AuthFailure> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return {
      error: NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      ),
    };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return { supabase, user };
}
