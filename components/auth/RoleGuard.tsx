"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";
import type { RouteIdType } from "@/lib/roleAccess";

interface RoleGuardProps {
  /** The route ID to check access for */
  routeId: RouteIdType;
  /** Content to render if authorized */
  children: React.ReactNode;
}

/**
 * Component that guards routes based on user role.
 * - Shows loading spinner while checking auth
 * - Redirects unauthorized users back to previous page (or Home)
 * - Renders children if authorized
 */
export function RoleGuard({ routeId, children }: RoleGuardProps) {
  const router = useRouter();
  const { canAccessRoute, loading, role } = useRoleAccess();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only check access after loading is complete
    if (loading) return;

    // If not authorized and haven't redirected yet
    if (!canAccessRoute(routeId) && !hasRedirected.current) {
      hasRedirected.current = true;
      // Redirect back to previous page, or Home if no history
      router.back();
    }
  }, [loading, canAccessRoute, routeId, router, role]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authorized, show nothing (redirect is happening)
  if (!canAccessRoute(routeId)) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Authorized - render children
  return <>{children}</>;
}
