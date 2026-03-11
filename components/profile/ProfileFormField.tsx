"use client";

import { ReactNode } from "react";

interface ProfileFormFieldProps {
  label: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
}

export function ProfileFormField({
  label,
  required = false,
  description,
  children,
}: ProfileFormFieldProps) {
  return (
    <div>
      <label className="block text-gray-700 dark:text-gray-300 mb-2 text-sm">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  );
}

