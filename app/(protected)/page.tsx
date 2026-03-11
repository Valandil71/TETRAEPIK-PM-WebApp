"use client";

import { useMemo, useState } from "react";
import {
  FolderKanban,
  UserPlus,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRoleAccess } from "@/hooks/user/useRoleAccess";
import { useHomeCounts } from "@/hooks/ui/useHomeCounts";
import { TypewriterText } from "@/components/ui/TypewriterText";
import { HomeCard } from "@/components/home/HomeCard";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { CurrentProjectsTable } from "@/components/home/CurrentProjectsTable";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/types/user";

interface HomeCardConfig {
  title: string;
  icon: LucideIcon;
  path: string;
  color: string;
  description: string;
  count?: number;
  allowedRoles: UserRole[];
}

export default function HomePage() {
  const { user, loading: userLoading, role } = useRoleAccess();
  const {
    myProjectsCount,
    manageProjectsCount,
    loading: countsLoading,
  } = useHomeCounts();
  const router = useRouter();
  const [showProjectsTable, setShowProjectsTable] = useState(false);
  const { data: allProjects = [], isLoading: projectsLoading } =
    useProjectsWithTranslators(false, true);

  // Filter and sort by deadline (same as Manage Projects)
  const currentProjects = useMemo(() => {
    const now = new Date();

    // Filter: only projects with final_deadline after today
    const filtered = allProjects.filter((project) => {
      if (!project.final_deadline) return false;
      const finalDate = new Date(project.final_deadline);
      if (isNaN(finalDate.getTime())) return false;
      return finalDate.getTime() > now.getTime();
    });

    // Sort by final deadline (earliest first) - same as Manage Projects
    return filtered.sort((a, b) => {
      const dateA = new Date(a.final_deadline || "").getTime();
      const dateB = new Date(b.final_deadline || "").getTime();
      // Handle projects without final_deadline - put them at the end
      if (!a.final_deadline && !b.final_deadline) return 0;
      if (!a.final_deadline) return 1;
      if (!b.final_deadline) return -1;
      return dateA - dateB;
    });
  }, [allProjects]);

  const loading = userLoading || countsLoading || projectsLoading;

  const userName = user?.name || user?.short_name || "User";

  // All home cards with role restrictions
  const allHomeCards: HomeCardConfig[] = useMemo(
    () => [
      {
        title: "Manage Projects",
        icon: FolderKanban,
        path: "/management",
        color: "bg-green-500",
        description: "Oversee all active projects",
        count: manageProjectsCount,
        allowedRoles: ["pm", "admin"],
      },
      {
        title: "My Projects",
        icon: ClipboardList,
        path: "/my-projects",
        color: "bg-blue-500",
        description: "View and manage your assignments",
        count: myProjectsCount,
        allowedRoles: ["employee", "pm", "admin"],
      },
      {
        title: "Assign Projects",
        icon: UserPlus,
        path: "/assign-projects",
        color: "bg-purple-500",
        description: "Distribute work to collaborators",
        allowedRoles: ["pm", "admin"],
      },
    ],
    [myProjectsCount, manageProjectsCount]
  );

  // Filter cards based on user role
  const homeCards = useMemo(() => {
    if (!role) return [];
    return allHomeCards.filter((card) => card.allowedRoles.includes(role));
  }, [role, allHomeCards]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome Section */}
      <div className="mb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/5 dark:via-purple-500/5 dark:to-pink-500/5 rounded-3xl" />
        <div className="relative p-8 md:p-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-600 dark:text-green-400 text-sm">
              Online
            </span>
          </div>
          <h1 className="text-gray-900 dark:text-white mb-3 text-4xl md:text-5xl font-bold">
            <TypewriterText text="Welcome back, " speed={50} delay={0} />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              <TypewriterText text={userName} speed={50} delay={700} />
            </span>
            <TypewriterText
              text="! 👋"
              speed={50}
              delay={900 + userName.length * 50}
            />
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            You&apos;re doing great! Keep up the excellent work.
          </p>
        </div>
      </div>

      {/* Section Header */}
      <div className="mb-8">
        <h2 className="text-gray-900 dark:text-white text-2xl mb-2 font-semibold">
          What are we doing today?
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Quick access to your most used features
        </p>
      </div>

      {/* Home Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {homeCards.map((card) => (
          <HomeCard key={card.title} {...card} />
        ))}

        {/* My Profile Card with Avatar - always visible */}
        <button
          onClick={() => router.push("/profile")}
          className="p-6 cursor-pointer bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:scale-105 transition-all duration-200 text-left group"
          type="button"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="group-hover:scale-110 transition-transform duration-200">
              <ProfileAvatar
                name={userName}
                avatar={user?.avatar}
                size="md"
                showEditButton={false}
              />
            </div>
          </div>
          <h3 className="text-gray-900 dark:text-white mb-1 font-semibold">
            My Profile
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Update your information
          </p>
        </button>
      </div>

      {/* Current Projects Table Section */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-gray-900 dark:text-white text-2xl mb-2 font-semibold">
              Current Projects
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Projects with final deadline after today, sorted by closest
              deadline
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowProjectsTable(!showProjectsTable)}
            className="flex items-center gap-2"
          >
            {showProjectsTable ?
              <>
                <ChevronUp className="w-4 h-4" />
                Hide
              </>
            : <>
                <ChevronDown className="w-4 h-4" />
                Show
              </>
            }
          </Button>
        </div>

        {showProjectsTable && (
          <div className="mt-4 transition-all duration-300 ease-in-out">
            <div className="max-h-[600px] overflow-y-auto">
              <CurrentProjectsTable projects={currentProjects} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

