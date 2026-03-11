import type { UserRole } from "@/types/user";

// Route IDs for type safety
export const RouteId = {
  HOME: "home",
  MY_PROJECTS: "my-projects",
  PROFILE: "profile",
  SETTINGS: "settings",
  PROJECT: "project",
  ASSIGN_PROJECTS: "assign-projects",
  MANAGEMENT: "management",
  WORKLOAD: "workload",
  NEW_PROJECT: "new-project",
  INVOICING: "invoicing",
} as const;

export type RouteIdType = (typeof RouteId)[keyof typeof RouteId];

// Route access map: which roles can access which routes
const routeAccessMap: Record<RouteIdType, UserRole[]> = {
  [RouteId.HOME]: ["employee", "pm", "admin"],
  [RouteId.MY_PROJECTS]: ["employee", "pm", "admin"],
  [RouteId.PROFILE]: ["employee", "pm", "admin"],
  [RouteId.SETTINGS]: ["employee", "pm", "admin"],
  [RouteId.PROJECT]: ["employee", "pm", "admin"], // Translators have additional assignment check
  [RouteId.ASSIGN_PROJECTS]: ["pm", "admin"],
  [RouteId.MANAGEMENT]: ["pm", "admin"],
  [RouteId.WORKLOAD]: ["pm", "admin"],
  [RouteId.NEW_PROJECT]: ["pm", "admin"],
  [RouteId.INVOICING]: ["admin"],
};

// Navigation items with role restrictions
export interface NavItem {
  path: string;
  label: string;
  routeId: RouteIdType;
  allowedRoles: UserRole[];
}

export const navItems: NavItem[] = [
  {
    path: "/",
    label: "Home",
    routeId: RouteId.HOME,
    allowedRoles: ["employee", "pm", "admin"],
  },
  {
    path: "/my-projects",
    label: "My Projects",
    routeId: RouteId.MY_PROJECTS,
    allowedRoles: ["employee", "pm", "admin"],
  },
  {
    path: "/assign-projects",
    label: "Assign Projects",
    routeId: RouteId.ASSIGN_PROJECTS,
    allowedRoles: ["pm", "admin"],
  },
  {
    path: "/management",
    label: "Manage Projects",
    routeId: RouteId.MANAGEMENT,
    allowedRoles: ["pm", "admin"],
  },
  {
    path: "/invoicing",
    label: "Invoicing",
    routeId: RouteId.INVOICING,
    allowedRoles: ["admin"],
  },
  {
    path: "/workload",
    label: "Workload",
    routeId: RouteId.WORKLOAD,
    allowedRoles: ["pm", "admin"],
  },
];

// Helper functions

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(
  role: UserRole | undefined,
  routeId: RouteIdType
): boolean {
  if (!role) return false;
  const allowedRoles = routeAccessMap[routeId];
  return allowedRoles.includes(role);
}

/**
 * Get project actions available for a role
 */
export function allowedProjectActions(role: UserRole | undefined): {
  canEdit: boolean;
  canComplete: boolean;
  canAssign: boolean;
  canRemoveTranslator: boolean;
  canDuplicate: boolean;
} {
  if (!role) {
    return {
      canEdit: false,
      canComplete: false,
      canAssign: false,
      canRemoveTranslator: false,
      canDuplicate: false,
    };
  }

  const isPmOrAdmin = role === "pm" || role === "admin";

  return {
    canEdit: isPmOrAdmin,
    canComplete: isPmOrAdmin,
    canAssign: isPmOrAdmin,
    canRemoveTranslator: isPmOrAdmin,
    canDuplicate: isPmOrAdmin,
  };
}

/**
 * Check if a role can manage assignments (add/remove translators)
 */
export function canManageAssignments(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === "pm" || role === "admin";
}

/**
 * Get filtered navigation items for a role
 */
export function getNavItemsForRole(role: UserRole | undefined): NavItem[] {
  if (!role) return [];
  return navItems.filter((item) => item.allowedRoles.includes(role));
}

/**
 * Check if a role can edit color settings (admin only)
 */
export function canEditColors(role: UserRole | undefined): boolean {
  return role === "admin";
}

/**
 * Check if a role is a translator (employee)
 */
export function isTranslator(role: UserRole | undefined): boolean {
  return role === "employee";
}

/**
 * Check if a role is PM or Admin
 */
export function isPmOrAdmin(role: UserRole | undefined): boolean {
  return role === "pm" || role === "admin";
}
