"use client";

import { useState, useRef } from "react";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { useUsers } from "@/hooks/user/useUsers";
import { useUser } from "@/hooks/user/useUser";
import { useUpdateUserRole } from "@/hooks/user/useUpdateUserRole";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import type { UserRole } from "@/types/user";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "pm", label: "Project Manager" },
  { value: "employee", label: "Collaborator" },
];

interface PendingRoleChange {
  userId: string;
  userName: string;
  currentRole: UserRole;
  newRole: UserRole;
}

export function UserRoleManagement() {
  const { data: users = [], isLoading } = useUsers();
  const { user: currentUser } = useUser();
  const updateUserRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);
  const pendingMutations = useRef<Set<string>>(new Set());

  // Filter users based on search term (name, email, or short_name)
  const filteredUsers = users.filter((user) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.short_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleRoleSelect = (userId: string, userName: string, newRole: UserRole, currentRole: UserRole) => {
    // Prevent update if role hasn't actually changed
    if (newRole === currentRole) {
      console.log("Role unchanged, skipping update");
      return;
    }

    // Show confirmation modal
    setPendingRoleChange({
      userId,
      userName,
      currentRole,
      newRole,
    });
  };

  const confirmRoleChange = () => {
    if (!pendingRoleChange) return;

    const { userId, newRole } = pendingRoleChange;

    // Prevent duplicate mutations for the same user
    const mutationKey = `${userId}-${newRole}`;
    if (pendingMutations.current.has(mutationKey)) {
      console.log("Mutation already in progress, skipping duplicate call");
      return;
    }

    // Mark mutation as pending
    pendingMutations.current.add(mutationKey);
    setUpdatingUserId(userId);
    setPendingRoleChange(null);

    // Optimistic update
    queryClient.setQueryData(["users"], (oldUsers: typeof users) => {
      if (!oldUsers) return oldUsers;
      return oldUsers.map((user) =>
        user.id === userId ? { ...user, role: newRole } : user
      );
    });

    updateUserRole.mutate(
      { userId, newRole },
      {
        onSettled: () => {
          setUpdatingUserId(null);
          // Remove from pending set
          pendingMutations.current.delete(mutationKey);
          // Refetch to ensure we have the latest data
          queryClient.invalidateQueries({ queryKey: queryKeys.users() });
        },
        onError: () => {
          // Remove from pending set
          pendingMutations.current.delete(mutationKey);
          // Revert optimistic update on error
          queryClient.invalidateQueries({ queryKey: queryKeys.users() });
        },
      }
    );
  };

  const getRoleLabel = (role: UserRole): string => {
    return ROLE_OPTIONS.find(opt => opt.value === role)?.label || role;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-gray-900 dark:text-white" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          User Role Management
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Manage user roles for all users in the system. Changes take effect
        immediately.
      </p>

      {/* Search Input */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder="Search by name, email, or short name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? "No users found matching your search." : "No users found."}
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isCurrentUser = currentUser?.id === user.id;
            return (
              <div
                key={user.id}
                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  isCurrentUser
                    ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      name={user.name || "User"}
                      avatar={user.avatar}
                      size="sm"
                      showEditButton={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {user.name}
                        {user.short_name && (
                          <span className="text-muted-foreground ml-2">
                            ({user.short_name})
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="text-blue-600 dark:text-blue-400 ml-2 text-sm font-normal">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                  <Select
                    value={user.role}
                    onValueChange={(value) =>
                      handleRoleSelect(user.id, user.name || "User", value as UserRole, user.role)
                    }
                    disabled={isCurrentUser || updateUserRole.isPending || updatingUserId === user.id}
                  >
                    <SelectTrigger className={`w-[180px] ${isCurrentUser ? "opacity-60 cursor-not-allowed" : ""}`}>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {updatingUserId === user.id && (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {updateUserRole.isError && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <span>
            {updateUserRole.error instanceof Error
              ? updateUserRole.error.message
              : "Failed to update user role"}
          </span>
        </div>
      )}

      {/* Confirmation Modal */}
      <Dialog open={!!pendingRoleChange} onOpenChange={(open) => !open && setPendingRoleChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Role Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change <span className="font-medium text-gray-900 dark:text-white">{pendingRoleChange?.userName}</span>&apos;s role from{" "}
              <span className="font-medium text-gray-900 dark:text-white">{pendingRoleChange && getRoleLabel(pendingRoleChange.currentRole)}</span> to{" "}
              <span className="font-medium text-gray-900 dark:text-white">{pendingRoleChange && getRoleLabel(pendingRoleChange.newRole)}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingRoleChange(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRoleChange}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
