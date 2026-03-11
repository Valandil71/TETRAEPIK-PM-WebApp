"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  Home,
  FolderKanban,
  UserPlus,
  Settings,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Receipt,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";
import { useLayoutStore } from "@/lib/stores/useLayoutStore";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UserRole } from "@/types/user";

interface NavItemConfig {
  path: string;
  icon: LucideIcon;
  label: string;
  allowedRoles: UserRole[];
}

// All navigation items with role restrictions
const allNavItems: NavItemConfig[] = [
  {
    path: "/",
    icon: Home,
    label: "Home",
    allowedRoles: ["employee", "pm", "admin"],
  },
  {
    path: "/my-projects",
    icon: ClipboardList,
    label: "My Projects",
    allowedRoles: ["employee", "pm", "admin"],
  },
  {
    path: "/assign-projects",
    icon: UserPlus,
    label: "Assign Projects",
    allowedRoles: ["pm", "admin"],
  },
  {
    path: "/management",
    icon: FolderKanban,
    label: "Manage Projects",
    allowedRoles: ["pm", "admin"],
  },
  {
    path: "/invoicing",
    icon: Receipt,
    label: "Invoicing",
    allowedRoles: ["admin"],
  },
  {
    path: "/workload",
    icon: BarChart3,
    label: "Workload",
    allowedRoles: ["pm", "admin"],
  },
];

export function Sidebar() {
  const { collapsed, toggleCollapsed } = useLayoutStore();
  const pathname = usePathname();
  const { user, loading: userLoading, role } = useRoleAccess();

  const roleLabel =
    role === "admin" ? "Administrator"
    : role === "pm" ? "Project Manager"
    : role === "employee" ? "Collaborator"
    : role ? "Account"
    : "Account";

  // Filter nav items based on user role
  const navItems = useMemo(() => {
    if (!role) return [];
    return allNavItems.filter((item) => item.allowedRoles.includes(role));
  }, [role]);

  // Controls when text labels are visible (for smooth transition)
  const [showLabels, setShowLabels] = useState(!collapsed);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let collapseTimeout: ReturnType<typeof setTimeout> | undefined;

    if (!collapsed) {
      // expanding → wait before showing labels and starting animation
      timeout = setTimeout(() => {
        setShowLabels(true);
        setShouldAnimate(true);
      }, 115);
    } else {
      // collapsing → hide labels immediately and reset animation
      collapseTimeout = setTimeout(() => {
        setShowLabels(false);
        setShouldAnimate(false);
      }, 0);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
      if (collapseTimeout) clearTimeout(collapseTimeout);
    };
  }, [collapsed]);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
        collapsed ? "w-20" : "w-52"
      } z-50`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {showLabels && (
              <span className="text-gray-900 dark:text-white font-medium">
                {shouldAnimate ?
                  <TypewriterText text="TETRAEPIK" speed={30} delay={0} />
                : "TETRAEPIK"}
              </span>
            )}
          </div>
          <button
            onClick={toggleCollapsed}
            className="p-2 cursor-pointer rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            type="button"
          >
            {collapsed ?
              <ChevronRight className="w-5 h-5" />
            : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item, index) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ?
                    "bg-blue-500 text-white shadow-sm"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {showLabels && (
                  <span>
                    {shouldAnimate ?
                      <TypewriterText
                        text={item.label}
                        speed={30}
                        delay={50 + index * 40}
                      />
                    : item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile Section */}
        <div className="px-3 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Link
            href="/profile"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname === "/profile" ?
                "bg-blue-500 text-white shadow-sm"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            title={collapsed ? "Profile" : undefined}
          >
            {userLoading ?
              <>
                {/* Avatar skeleton */}
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse shrink-0" />
                {showLabels && (
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Name skeleton */}
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    {/* Role skeleton */}
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                )}
              </>
            : <>
                <ProfileAvatar
                  name={user?.name || ""}
                  avatar={user?.avatar}
                  size="sm"
                  showEditButton={false}
                />
                {showLabels && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {shouldAnimate && user?.name ?
                        <TypewriterText
                          text={user.name}
                          speed={30}
                          delay={250}
                        />
                      : user?.name || "Profile"}
                    </p>
                    <p className="text-xs opacity-70 truncate">
                      {shouldAnimate ?
                        <TypewriterText
                          text={roleLabel}
                          speed={30}
                          delay={300}
                        />
                      : roleLabel}
                    </p>
                  </div>
                )}
              </>
            }
          </Link>
        </div>

        {/* Settings */}
        <div className="px-3 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              pathname === "/settings" ?
                "bg-blue-500 text-white shadow-sm"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {showLabels && (
              <span>
                {shouldAnimate ?
                  <TypewriterText text="Settings" speed={30} delay={350} />
                : "Settings"}
              </span>
            )}
          </Link>
        </div>
      </div>
    </aside>
  );
}
