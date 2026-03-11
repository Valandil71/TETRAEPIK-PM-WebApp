"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Save, Loader2, SlidersHorizontal, Pencil, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/hooks/user/useUser";
import { useUpdateProfile } from "@/hooks/user/useUpdateProfile";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileStatus } from "./ProfileStatus";
import { AvatarSelectionModal } from "./AvatarSelectionModal";
import { Loader2 as LoaderIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  short_name: z.string().optional(),
  email: z.string().email("Invalid email address"),
  C_user: z.string().optional(),
  TE_user: z.string().optional(),
  role: z.string(), // Read-only, but included in schema
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePageContent() {
  const { user, loading: userLoading } = useUser();
  const updateProfile = useUpdateProfile();
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      short_name: "",
      email: "",
      C_user: "",
      TE_user: "",
      role: "",
    },
  });

  // Initialize form data when user loads
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        short_name: user.short_name || "",
        email: user.email || "",
        C_user: user.C_user || "",
        TE_user: user.TE_user || "",
        role:
          user.role === "admin" ? "Administrator"
          : user.role === "pm" ? "Project Manager"
          : "Collaborator",
      });
    }
  }, [user, form]);

  const initialData = useMemo(() => {
    if (!user) return form.getValues();
    return {
      name: user.name || "",
      short_name: user.short_name || "",
      email: user.email || "",
      C_user: user.C_user || "",
      TE_user: user.TE_user || "",
      role:
        user.role === "admin" ? "Administrator"
        : user.role === "pm" ? "Project Manager"
        : "Collaborator",
    };
  }, [user, form]);

  const hasChanges = useMemo(() => {
    const currentValues = form.getValues();
    return JSON.stringify(currentValues) !== JSON.stringify(initialData);
  }, [form, initialData]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!hasChanges) return;

    try {
      await updateProfile.mutateAsync({
        name: data.name,
        short_name: data.short_name || null, // Hook will convert empty string to null
        C_user: data.C_user || "",
        TE_user: data.TE_user || "",
        email: data.email,
      });
      setIsEditing(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleCancel = () => {
    form.reset(initialData);
    setIsEditing(false);
  };

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (!isEditing || updateProfile.isPending) return;
    if ("isComposing" in event.nativeEvent && event.nativeEvent.isComposing) return;

    if (event.key === "Enter") {
      const target = event.target as HTMLElement;
      if (target instanceof HTMLTextAreaElement) return;

      event.preventDefault();
      void form.handleSubmit(onSubmit)();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  };

  const formValues = useWatch({ control: form.control });
  const handleCopyUsername = async (label: "Full Name" | "Email Address" | "C Username" | "TE Username", value?: string) => {
    const text = (value ?? "").trim();
    if (!text) {
      toast.error(`No ${label} to copy`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error(`Failed to copy ${label}`);
    }
  };

  if (userLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoaderIcon className="animate-spin w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-muted-foreground">
          Please log in to view your profile
        </p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2 text-3xl font-bold">
          Profile Settings
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Update your personal information and account details
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Avatar Section */}
        <div className="p-8 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <ProfileAvatar
              name={formValues.name || ""}
              avatar={user?.avatar}
              onAvatarClick={() => setAvatarModalOpen(true)}
            />
            <div>
              <h2 className="text-gray-900 dark:text-white mb-1 text-lg font-semibold">
                {formValues.name || ""}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {formValues.email || ""}
              </p>
            </div>
          </div>

          <ProfileStatus hasChanges={hasChanges} lastSavedAt={updateProfile.isSuccess ? new Date() : null} isEditing={isEditing} />
        </div>

        {/* Form Section */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleFormKeyDown}>
            <div className="p-8 space-y-8">
              {/* Personal info */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Personal information
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This will be visible to project managers and colleagues.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly={!isEditing}
                            onClick={() => {
                              if (!isEditing) {
                                void handleCopyUsername("Full Name", field.value);
                              }
                            }}
                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isEditing
                                ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer"
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Short Name */}
                  <FormField
                    control={form.control}
                    name="short_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preferred Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={!isEditing}
                            placeholder="This is how your name will appear in project views."
                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isEditing
                                ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Email */}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            readOnly={!isEditing}
                            onClick={() => {
                              if (!isEditing) {
                                void handleCopyUsername("Email Address", field.value);
                              }
                            }}
                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                              isEditing
                                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-gray-900 dark:text-white focus:ring-amber-500"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer"
                            }`}
                          />
                        </FormControl>
                        {isEditing && (
                          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                            <AlertTriangle className="w-3 h-3" />
                            Changing email requires confirmation. A verification email will be sent to the new address.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Role (Read-only) */}
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled
                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              <hr className="border-gray-200 dark:border-gray-700" />

              {/* Account details */}
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Account details
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Integration usernames for your CAT tools.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* C User */}
                  <FormField
                    control={form.control}
                    name="C_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>C Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly={!isEditing}
                            onClick={() => {
                              if (!isEditing) {
                                void handleCopyUsername("Full Name", field.value);
                              }
                            }}
                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isEditing
                                ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer"
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* TE User */}
                  <FormField
                    control={form.control}
                    name="TE_user"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TE Username</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            readOnly={!isEditing}
                            onClick={() => {
                              if (!isEditing) {
                                void handleCopyUsername("TE Username", field.value);
                              }
                            }}
                            className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isEditing
                                ? "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer"
                            }`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                {!isEditing ? (
                  <Button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateProfile.isPending}
                      className="px-6 py-3"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!hasChanges || updateProfile.isPending}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {updateProfile.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>

      {/* Link to Settings */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-300" />
          <p className="text-gray-700 dark:text-gray-200 text-sm">
            You can manage app preferences and account options in{" "}
            <span className="font-medium">Settings</span>.
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
        >
          Open Settings
        </Link>
      </div>

      {/* Additional Info Card - Only for collaborators */}
      {user.role === "employee" && (
        <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <p className="text-blue-900 dark:text-blue-200 text-sm">
            Your role is assigned by administrators and cannot be changed here.
            Contact an admin if you believe your role needs updating.
          </p>
        </div>
      )}

      {/* Avatar Selection Modal */}
      <AvatarSelectionModal
        open={avatarModalOpen}
        onOpenChange={setAvatarModalOpen}
        currentAvatar={user?.avatar}
        customAvatar={user?.custom_avatar}
      />
    </div>
  );
}











