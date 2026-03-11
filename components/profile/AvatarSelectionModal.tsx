"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { useAvailableAvatars } from "@/hooks/user/useAvailableAvatars";
import {
  useUpdateAvatar,
  AvatarAlreadyTakenError,
} from "@/hooks/user/useUpdateAvatar";
import { useUploadAvatar } from "@/hooks/user/useUploadAvatar";
import { isCustomAvatar } from "@/components/profile/ProfileAvatar";
import {
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Upload,
  ImageIcon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AvatarSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar?: string | null;
  customAvatar?: string | null;
}

type TabType = "predefined" | "upload";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarSelectionModal({
  open,
  onOpenChange,
  currentAvatar,
  customAvatar,
}: AvatarSelectionModalProps) {
  const {
    data: availableAvatars,
    isLoading,
    error: fetchError,
    refetch,
  } = useAvailableAvatars();
  const updateAvatar = useUpdateAvatar();
  const uploadAvatar = useUploadAvatar();

  const [activeTab, setActiveTab] = useState<TabType>("predefined");
  const [selected, setSelected] = useState<string | null>(null);
  const [showConflictWarning, setShowConflictWarning] = useState(false);

  // Upload state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      const timeout = setTimeout(() => {
        setSelected(currentAvatar ?? null);
        setShowConflictWarning(false);
        setPreviewUrl(null);
        setSelectedFile(null);
        setUploadError(null);
        // Set initial tab based on current avatar type
        setActiveTab(isCustomAvatar(currentAvatar) ? "upload" : "predefined");
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [open, currentAvatar]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Handle avatar update error - specifically race conditions
  useEffect(() => {
    if (updateAvatar.error instanceof AvatarAlreadyTakenError) {
      const timeout = setTimeout(() => {
        setShowConflictWarning(true);
        refetch();
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [updateAvatar.error, refetch]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setUploadError(null);

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError("Only JPEG, PNG, and WebP images are allowed");
        return;
      }

      // Validate file size (before compression, allow larger for compression)
      if (file.size > MAX_FILE_SIZE * 2) {
        setUploadError("File size must be less than 4MB");
        return;
      }

      // Create preview
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
      setSelectedFile(file);
    },
    [previewUrl]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    disabled: uploadAvatar.isPending,
  });

  const handleConfirm = async () => {
    if (activeTab === "upload" && selectedFile) {
      // Handle custom upload
      try {
        await uploadAvatar.mutateAsync(selectedFile);
        onOpenChange(false);
      } catch {
        // Error is handled by the mutation
      }
    } else if (activeTab === "predefined") {
      // Handle predefined avatar selection
      if (!selected || selected === currentAvatar) {
        onOpenChange(false);
        return;
      }

      setShowConflictWarning(false);

      try {
        await updateAvatar.mutateAsync(selected);
        onOpenChange(false);
      } catch {
        // Error is handled by the mutation and the useEffect above
      }
    }
  };

  const handleAvatarSelect = (filename: string) => {
    setSelected(filename);
    setShowConflictWarning(false);
  };

  const handleRetry = () => {
    setShowConflictWarning(false);
    refetch();
  };

  const handleClearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setUploadError(null);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setUploadError(null);
  };

  // Handler to switch back to previously uploaded custom avatar
  const handleUseCustomAvatar = async () => {
    if (!customAvatar) return;

    try {
      await updateAvatar.mutateAsync(customAvatar);
      onOpenChange(false);
    } catch {
      // Error is handled by the mutation
    }
  };

  const isCurrentAvatarSelected = selected === currentAvatar;
  const hasNoChanges =
    activeTab === "predefined" ?
      !selected || isCurrentAvatarSelected
    : !selectedFile;
  const isPending = updateAvatar.isPending || uploadAvatar.isPending;

  // Check if current avatar is a custom upload
  const currentAvatarIsCustom = isCustomAvatar(currentAvatar);

  // Check if there's a saved custom avatar that's different from current avatar
  const hasSavedCustomAvatar = customAvatar && customAvatar !== currentAvatar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Your Avatar</DialogTitle>
          <DialogDescription>
            Select a predefined avatar or upload your own photo.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => handleTabChange("predefined")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "predefined" ?
                "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Predefined Avatars
          </button>
          <button
            onClick={() => handleTabChange("upload")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "upload" ?
                "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload Photo
          </button>
        </div>

        {/* Conflict Warning */}
        {showConflictWarning && activeTab === "predefined" && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Avatar no longer available
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Someone just selected this avatar. Please choose a different one
                from the available options below.
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 rounded transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>
        )}

        {/* Predefined Avatars Tab */}
        {activeTab === "predefined" && (
          <>
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading available avatars...
                </p>
              </div>
            )}

            {/* Error State */}
            {fetchError && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Failed to load avatars
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {fetchError.message || "Please try again later."}
                  </p>
                </div>
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            )}

            {/* Avatars Grid */}
            {!isLoading && !fetchError && (
              <div className="flex-1 overflow-y-auto py-2">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 p-1">
                  {/* Current avatar (only show if it's a predefined one) */}
                  {currentAvatar && !currentAvatarIsCustom && (
                    <button
                      onClick={() => handleAvatarSelect(currentAvatar)}
                      disabled={isPending}
                      className={`relative p-2 rounded-xl border-2 transition-all group ${
                        selected === currentAvatar ?
                          "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <Image
                        src={`/avatars/${currentAvatar}`}
                        alt="Your current avatar"
                        width={64}
                        height={64}
                        className="rounded-lg w-full h-auto"
                      />
                      {selected === currentAvatar && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block text-center truncate">
                        Current
                      </span>
                    </button>
                  )}

                  {/* Available avatars */}
                  {availableAvatars?.map((avatar) => (
                    <button
                      key={avatar.filename}
                      onClick={() => handleAvatarSelect(avatar.filename)}
                      disabled={isPending}
                      className={`relative p-2 rounded-xl border-2 transition-all group ${
                        selected === avatar.filename ?
                          "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <Image
                        src={`/avatars/${avatar.filename}`}
                        alt={avatar.display_name}
                        width={64}
                        height={64}
                        className="rounded-lg w-full h-auto"
                      />
                      {selected === avatar.filename && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 block text-center truncate">
                        {avatar.display_name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* No avatars available */}
                {availableAvatars?.length === 0 &&
                  !currentAvatar &&
                  !currentAvatarIsCustom && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        No avatars available.
                        <br />
                        All avatars have been taken by other users.
                        <br />
                        <button
                          onClick={() => handleTabChange("upload")}
                          className="text-blue-500 hover:underline mt-2"
                        >
                          Upload your own photo instead
                        </button>
                      </p>
                    </div>
                  )}
              </div>
            )}
          </>
        )}

        {/* Upload Tab */}
        {activeTab === "upload" && (
          <div className="flex-1 overflow-y-auto py-4">
            {/* Saved custom avatar option - show when user has one and it's not currently active */}
            {hasSavedCustomAvatar && !previewUrl && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                  Your uploaded photo
                </p>
                <div className="flex items-center gap-4">
                  <Image
                    src={customAvatar}
                    alt="Your uploaded photo"
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-300 dark:border-blue-600"
                    unoptimized
                  />
                  <div className="flex-1">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                      Switch back to your uploaded photo
                    </p>
                    <button
                      onClick={handleUseCustomAvatar}
                      disabled={isPending}
                      className="px-3 py-1.5 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isPending ? "Switching..." : "Use this photo"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current custom avatar display - only show when it's the active avatar */}
            {currentAvatarIsCustom && !previewUrl && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Current custom avatar:
                </p>
                <div className="flex items-center gap-4">
                  <Image
                    src={currentAvatar!}
                    alt="Current avatar"
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover"
                    unoptimized
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Upload a new photo to replace it
                  </p>
                </div>
              </div>
            )}

            {/* Upload Error */}
            {uploadError && (
              <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Upload Error
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    {uploadError}
                  </p>
                </div>
              </div>
            )}

            {/* Preview or Dropzone */}
            {previewUrl ?
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Image
                    src={previewUrl}
                    alt="Preview"
                    width={192}
                    height={192}
                    className="w-48 h-48 rounded-full object-cover border-4 border-blue-500"
                    unoptimized
                  />
                  <button
                    onClick={handleClearPreview}
                    disabled={isPending}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50"
                    aria-label="Remove preview"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFile?.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {selectedFile && (selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            : <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  isDragActive ?
                    "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                  {isDragActive ?
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      Drop the image here...
                    </p>
                  : <>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Drag & drop your photo here
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          or click to browse
                        </p>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        <p>JPEG, PNG, or WebP</p>
                        <p>Max 2MB • Will be resized to 512×512</p>
                      </div>
                    </>
                  }
                </div>
              </div>
            }
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={hasNoChanges || isPending || isLoading}
            className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isPending ?
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {activeTab === "upload" ? "Uploading..." : "Saving..."}
              </>
            : activeTab === "upload" && selectedFile ?
              "Upload & Save"
            : "Confirm Selection"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
