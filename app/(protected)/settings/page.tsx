"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ColorSettings } from "@/components/settings/ColorSettings";
import { ThemeSettings } from "@/components/settings/ThemeSettings";
import { UserRoleManagement } from "@/components/settings/UserRoleManagement";
import { InstructionExclusionSettings } from "@/components/settings/InstructionExclusionSettings";
import { DefaultFilterSettings } from "@/components/settings/DefaultFilterSettings";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, loading, canEditColors } = useRoleAccess();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  const isPmOrAdmin = user?.role === "admin" || user?.role === "pm";

  const { data: projectTypes = [] } = useQuery({
    queryKey: ["settings-project-types"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("project_type")
        .not("project_type", "is", null);

      if (error) throw new Error(error.message);

      const unique = new Set<string>();
      data?.forEach((row: { project_type: string | null }) => {
        if (row.project_type) unique.add(row.project_type);
      });
      return Array.from(unique).sort();
    },
    enabled: isPmOrAdmin,
  });

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error("Failed to logout");
        setLoggingOut(false);
        setShowLogoutModal(false);
      } else {
        // Clear all React Query cache to remove old user data
        queryClient.clear();
        toast.success("Logged out successfully");
        router.push("/login");
        router.refresh();
      }
    } catch {
      toast.error("Failed to logout");
      setLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Nenhum utilizador encontrado.
      </div>
    );
  }

  return (
    <div className="container px-5 py-10 space-y-8 text-center">
      <h1 className="text-4xl font-bold">Settings</h1>
      <Card className="p-6 text-left">
        <ThemeSettings />
      </Card>
      {/* Only show ColorSettings card for admins */}
      {canEditColors() && (
        <Card className="p-6">
          <ColorSettings userRole={user.role} />
        </Card>
      )}

      {/* User Role Management - Only for admins */}
      {user.role === "admin" && (
        <Card className="p-6 text-left">
          <UserRoleManagement />
        </Card>
      )}

      {/* Instruction Exclusions - PM/Admin only */}
      {isPmOrAdmin && (
        <InstructionExclusionSettings userId={user.id} />
      )}

      {/* Default Project Type Filter - PM/Admin only */}
      {isPmOrAdmin && (
        <DefaultFilterSettings
          userId={user.id}
          availableProjectTypes={projectTypes}
        />
      )}

      {/* Logout Section */}
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Sign Out
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Sign out of your account on this device
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowLogoutModal(true)}
            className="cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </Card>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => !loggingOut && setShowLogoutModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-900 dark:text-white font-semibold">
                Confirm Logout
              </h2>
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="p-1 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                type="button"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
              Are you sure you want to sign out? You will need to sign in again
              to access your account.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="px-4 py-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-4 py-2 cursor-pointer bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                type="button"
              >
                {loggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
                {loggingOut ? "Signing out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
