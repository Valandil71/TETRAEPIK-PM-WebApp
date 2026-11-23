// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase env vars missing for middleware.");
    return res;
  }

  // Anti-cache headers (Cache-Control: private, no-store...) that @supabase/ssr hands over
  // when it writes auth cookies, so no CDN/proxy can serve one user's session to another.
  // They only come with the first write, so keep them for when `res` is re-created.
  const cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        Object.assign(cacheHeaders, headers);
        // First set on the request (for downstream server components)
        cookiesToSet.forEach(({ name, value }) => {
          req.cookies.set(name, value);
        });
        // Re-create response to pick up request cookie changes
        res = NextResponse.next({ request: req });
        // Then set on the response (for the browser)
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
        Object.entries(cacheHeaders).forEach(([key, value]) => {
          res.headers.set(key, value);
        });
      },
    },
  });

  // Get current session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Define routes accessible without login
  const publicRoutes = ["/login"];
  const isPublic = publicRoutes.some((route) => pathname.startsWith(route));

  // Redirect unauthenticated users trying to access private routes
  if (!session && !isPublic) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);

    // Important: return redirect *with cookies from supabase client*
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  // Redirect authenticated users away from /login
  if (session && pathname === "/login") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";

    // Important: return redirect *with cookies*
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  // Always return `res` (the modified one)
  return res;
}

// Define which routes middleware applies to
export const config = {
  matcher: [
    // Protect all routes except static files, icons (needed on the login page too), API routes
    // and the push service worker (browsers reject a redirected service worker script)
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|apple-touch-icon.png|sw.js|api).*)",
  ],
};
