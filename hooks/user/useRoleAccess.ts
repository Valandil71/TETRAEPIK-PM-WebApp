"use client";

import { useMemo } from "react";
import { useUser } from '@/hooks/user/useUser';
import type { UserRole } from "@/types/user";
import {
  canAccessRoute as canAccessRouteHelper,
  canManageAssignments as canManageAssignmentsHelper,
  canEditColors as canEditColorsHelper,
  allowedProjectActions as allowedProjectActionsHelper,
  getNavItemsForRole,
  isTranslator as isTranslatorHelper,
  isPmOrAdmin as isPmOrAdminHelper,
  type RouteIdType,
  type NavItem,
} from "@/lib/roleAccess";

export interface UseRoleAccessReturn {
  /** Current user's role */
  role: UserRole | undefined;
  /** Current user object */
  user: ReturnType<typeof useUser>["user"];
  /** Whether the user data is still loading */
  loading: boolean;
  /** Check if user can access a specific route */
  canAccessRoute: (routeId: RouteIdType) => boolean;
  /** Check if user can manage assignments (add/remove translators) */
  canManageAssignments: () => boolean;
  /** Check if user can edit color settings */
  canEditColors: () => boolean;
  /** Get project actions available for user */
  allowedProjectActions: () => ReturnType<typeof allowedProjectActionsHelper>;
  /** Get navigation items available for user */
  allowedNavItems: NavItem[];
  /** Check if user is a translator */
  isTranslator: () => boolean;
  /** Check if user is PM or Admin */
  isPmOrAdmin: () => boolean;
}

/**
 * Hook that provides role-based access control utilities
 * Wraps roleAccess.ts helpers with current user context
 */
export function useRoleAccess(): UseRoleAccessReturn {
  const { user, loading } = useUser();
  const role = user?.role as UserRole | undefined;

  // Memoize navigation items to prevent unnecessary re-renders
  const allowedNavItems = useMemo(() => {
    return getNavItemsForRole(role);
  }, [role]);

  // Memoize helper functions that depend on role
  const canAccessRoute = useMemo(() => {
    return (routeId: RouteIdType) => canAccessRouteHelper(role, routeId);
  }, [role]);

  const canManageAssignments = useMemo(() => {
    return () => canManageAssignmentsHelper(role);
  }, [role]);

  const canEditColors = useMemo(() => {
    return () => canEditColorsHelper(role);
  }, [role]);

  const allowedProjectActions = useMemo(() => {
    return () => allowedProjectActionsHelper(role);
  }, [role]);

  const isTranslator = useMemo(() => {
    return () => isTranslatorHelper(role);
  }, [role]);

  const isPmOrAdmin = useMemo(() => {
    return () => isPmOrAdminHelper(role);
  }, [role]);

  return {
    role,
    user,
    loading,
    canAccessRoute,
    canManageAssignments,
    canEditColors,
    allowedProjectActions,
    allowedNavItems,
    isTranslator,
    isPmOrAdmin,
  };
}
