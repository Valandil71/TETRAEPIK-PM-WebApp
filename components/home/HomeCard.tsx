"use client";

import { useRouter } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { formatNumber } from "@/utils/formatters";

interface HomeCardProps {
  title: string;
  icon: LucideIcon;
  path: string;
  color: string;
  description: string;
  count?: number;
}

export function HomeCard({
  title,
  icon: Icon,
  path,
  color,
  description,
  count,
}: HomeCardProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(path)}
      className="p-6 cursor-pointer bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:scale-105 transition-all duration-200 text-left group"
      type="button"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        {count !== undefined && (
          <span className="text-2xl text-gray-900 dark:text-white font-semibold">
            {formatNumber(count)}
          </span>
        )}
      </div>
      <h3 className="text-gray-900 dark:text-white mb-1 font-semibold">
        {title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-sm">
        {description}
      </p>
    </button>
  );
}

