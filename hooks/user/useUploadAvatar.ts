"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from '@/hooks/core/useSupabase';
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import imageCompression from "browser-image-compression";
import { queryKeys } from "@/lib/queryKeys";

interface UploadResult {
  success: boolean;
  url: string;
}

interface StorageFileRow {
  name: string;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_WIDTH_HEIGHT = 512; // Max dimensions for avatar

export function useUploadAvatar() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File): Promise<UploadResult> => {

      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 2. Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Only JPEG, PNG, and WebP images are allowed");
      }

      // 3. Validate file size (before compression)
      if (file.size > MAX_FILE_SIZE * 2) {
        throw new Error("File size must be less than 4MB before compression");
      }

      // 4. Compress and resize image
      let compressedFile: File;
      try {
        compressedFile = await imageCompression(file, {
          maxSizeMB: 0.5, // 500KB max after compression
          maxWidthOrHeight: MAX_WIDTH_HEIGHT,
          useWebWorker: true,
          fileType: file.type as "image/jpeg" | "image/png" | "image/webp",
        });
      } catch {
        throw new Error("Failed to process image. Please try a different file.");
      }

      // 5. Validate compressed file size
      if (compressedFile.size > MAX_FILE_SIZE) {
        throw new Error("File size must be less than 2MB after compression");
      }

      // 6. Create unique filename with timestamp to bust cache
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const timestamp = Date.now();
      const fileName = `${user.id}/avatar-${timestamp}.${fileExt}`;

      // 7. List and delete old avatars in user's folder
      const { data: existingFiles } = await supabase.storage
        .from("user-avatars")
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = (existingFiles as StorageFileRow[]).map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from("user-avatars").remove(filesToDelete);
      }

      // 8. Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(fileName, compressedFile, {
          upsert: true,
          contentType: compressedFile.type,
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // 9. Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("user-avatars").getPublicUrl(fileName);

      // 10. Update user profile with new avatar URL (both avatar and custom_avatar)
      const { error: updateError } = await supabase
        .from("users")
        .update({ 
          avatar: publicUrl,
          custom_avatar: publicUrl 
        })
        .eq("id", user.id);

      if (updateError)
        throw new Error(`Failed to update profile: ${updateError.message}`);

      return { success: true, url: publicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
      queryClient.invalidateQueries({ queryKey: queryKeys.user() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      queryClient.invalidateQueries({ queryKey: queryKeys.availableAvatars() });
      toast.success("Avatar uploaded successfully!");
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "avatar upload"));
    },
  });
}
