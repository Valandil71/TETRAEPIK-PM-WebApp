"use client";

import { Camera } from "lucide-react";
import { useMemo, useState } from "react";
import Image from "next/image";

interface ProfileAvatarProps {
  name: string;
  avatar?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  onAvatarClick?: () => void;
  showEditButton?: boolean;
}

const sizeClasses = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-10 h-10 text-sm",
  md: "w-16 h-16 text-lg",
  lg: "w-24 h-24 text-2xl",
};

const editButtonSizeClasses = {
  xs: "w-4 h-4",
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

const editIconSizeClasses = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-4 h-4",
};

/**
 * Get the correct image source for an avatar.
 * - If it's a full URL (custom upload), use it directly
 * - Otherwise, it's a predefined avatar filename, so prefix with /avatars/
 */
function getAvatarSrc(avatar: string | null | undefined): string | null {
  if (!avatar) return null;

  // If it's a full URL (custom upload from Supabase Storage), use it directly
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  // Otherwise, it's a predefined avatar filename
  return `/avatars/${avatar}`;
}

/**
 * Check if an avatar is a custom upload (URL) vs predefined (filename)
 */
export function isCustomAvatar(avatar: string | null | undefined): boolean {
  if (!avatar) return false;
  return avatar.startsWith("http://") || avatar.startsWith("https://");
}

export function ProfileAvatar({
  name,
  avatar,
  size = "lg",
  onAvatarClick,
  showEditButton = true,
}: ProfileAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const initials = useMemo(() => {
    if (!name?.trim()) return "??";
    const parts = name.trim().split(" ");
    const first = parts[0]?.[0] ?? "";
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return (first + last).toUpperCase();
  }, [name]);

  const avatarSrc = getAvatarSrc(avatar);
  const showImage = !!avatarSrc && avatarSrc !== failedSrc;
  const isExternal = isCustomAvatar(avatar);

  return (
    <div className="relative inline-block">
      {showImage ?
        <Image
          src={avatarSrc}
          alt={`${name}'s avatar`}
          width={96}
          height={96}
          className={`${sizeClasses[size]} rounded-full object-cover bg-gray-100 dark:bg-gray-800`}
          onError={() => setFailedSrc(avatarSrc)}
          priority={size === "lg"}
          unoptimized={isExternal}
        />
      : <div
          className={`${sizeClasses[size]} bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold`}
        >
          {initials}
        </div>
      }

      {onAvatarClick && showEditButton && (
        <button
          onClick={onAvatarClick}
          className={`absolute bottom-0 right-0 ${editButtonSizeClasses[size]} cursor-pointer bg-gray-900 dark:bg-gray-100 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm`}
          type="button"
          aria-label="Change avatar"
        >
          <Camera
            className={`${editIconSizeClasses[size]} text-white dark:text-gray-900`}
          />
        </button>
      )}
    </div>
  );
}
