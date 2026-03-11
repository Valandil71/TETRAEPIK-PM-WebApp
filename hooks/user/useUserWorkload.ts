"use client";

import { useMemo } from "react";
import { useUsers } from '@/hooks/user/useUsers';
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";

export interface ProjectTranslatorInfo {
  id: string;
  name: string;
  shortName: string | null;
  avatar: string | null;
}

export interface UserWorkloadProject {
  id: number;
  name: string;
  system: string;
  wordsShare: number;
  linesShare: number;
  deadline: Date | null;
  initialDeadline: string | null;
  interimDeadline: string | null;
  finalDeadline: string | null;
  translators: ProjectTranslatorInfo[];
}

export interface UserWorkload {
  userId: string;
  userName: string;
  shortName: string | null;
  avatar: string | null;
  wordsPerHour: number;
  linesPerHour: number;
  totalWords: number;
  totalLines: number;
  estimatedHours: number;
  earliestDeadline: Date | null;
  isFeasible: boolean;
  // Next week stats (projects due within 7 days)
  nextWeekWords: number;
  nextWeekLines: number;
  nextWeekEstimatedHours: number;
  nextWeekIsFeasible: boolean;
  projects: UserWorkloadProject[];
}

const DEFAULT_WORDS_PER_HOUR = 500;
const DEFAULT_LINES_PER_HOUR = 50;
const HOURS_PER_WORKDAY = 8;

/**
 * Count the number of working days (Mon-Fri) between two dates
 */
function countWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Count working days in the next 7 calendar days from now
 */
function getNextWeekWorkingDays(): number {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return countWorkingDays(now, nextWeek);
}

export function useUserWorkload() {
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: projects = [], isLoading: projectsLoading } = useProjectsWithTranslators(false, true);

  const workloads = useMemo(() => {
    const workloadMap = new Map<string, UserWorkload>();

    // Filter to only active projects (not complete)
    const activeProjects = projects.filter((p) => p.status !== "complete");

    // Calculate the date 7 days from now for next week filter
    const now = new Date();
    const nextWeekDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Initialize workload for each user
    users.forEach((user) => {
      workloadMap.set(user.id, {
        userId: user.id,
        userName: user.name,
        shortName: user.short_name || null,
        avatar: user.avatar || null,
        wordsPerHour: user.words_per_hour || DEFAULT_WORDS_PER_HOUR,
        linesPerHour: user.lines_per_hour || DEFAULT_LINES_PER_HOUR,
        totalWords: 0,
        totalLines: 0,
        estimatedHours: 0,
        earliestDeadline: null,
        isFeasible: true,
        nextWeekWords: 0,
        nextWeekLines: 0,
        nextWeekEstimatedHours: 0,
        nextWeekIsFeasible: true,
        projects: [],
      });
    });

    // Calculate workload for each project
    activeProjects.forEach((project) => {
      const translatorCount = project.translators.length;
      if (translatorCount === 0) return;

      // Calculate share per translator
      const wordsShare = Math.ceil((project.words || 0) / translatorCount);
      const linesShare = Math.ceil((project.lines || 0) / translatorCount);

      // Use only final deadline
      const projectDeadline = project.final_deadline
        ? (() => {
            const date = new Date(project.final_deadline);
            return isNaN(date.getTime()) ? null : date;
          })()
        : null;

      // Map translator info for this project
      const projectTranslators: ProjectTranslatorInfo[] = project.translators.map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.short_name || null,
        avatar: t.avatar || null,
      }));

      // Check if project is due within next week
      const isDueNextWeek = projectDeadline && projectDeadline <= nextWeekDate;

      // Add share to each assigned translator
      project.translators.forEach((translator) => {
        const userWorkload = workloadMap.get(translator.id);
        if (!userWorkload) return;

        userWorkload.totalWords += wordsShare;
        userWorkload.totalLines += linesShare;

        // Add to next week stats if deadline is within 7 days
        if (isDueNextWeek) {
          userWorkload.nextWeekWords += wordsShare;
          userWorkload.nextWeekLines += linesShare;
        }

        userWorkload.projects.push({
          id: project.id,
          name: project.name,
          system: project.system,
          wordsShare,
          linesShare,
          deadline: projectDeadline,
          initialDeadline: project.initial_deadline,
          interimDeadline: project.interim_deadline,
          finalDeadline: project.final_deadline,
          translators: projectTranslators,
        });

        // Update earliest deadline
        if (projectDeadline) {
          if (!userWorkload.earliestDeadline || projectDeadline < userWorkload.earliestDeadline) {
            userWorkload.earliestDeadline = projectDeadline;
          }
        }
      });
    });

    // Calculate estimated hours and feasibility for each user
    workloadMap.forEach((workload) => {
      // Total workload calculations
      const wordHours = workload.totalWords / workload.wordsPerHour;
      const lineHours = workload.totalLines / workload.linesPerHour;
      workload.estimatedHours = Math.round((wordHours + lineHours) * 10) / 10;

      // Next week workload calculations
      const nextWeekWordHours = workload.nextWeekWords / workload.wordsPerHour;
      const nextWeekLineHours = workload.nextWeekLines / workload.linesPerHour;
      workload.nextWeekEstimatedHours = Math.round((nextWeekWordHours + nextWeekLineHours) * 10) / 10;

      // Calculate feasibility based on working days until deadline (excludes weekends)
      if (workload.earliestDeadline) {
        const workingDaysUntilDeadline = countWorkingDays(now, workload.earliestDeadline);
        const workingHoursUntilDeadline = workingDaysUntilDeadline * HOURS_PER_WORKDAY;
        workload.isFeasible = workload.estimatedHours <= workingHoursUntilDeadline;
      } else {
        workload.isFeasible = true; // No deadline means feasible
      }

      // Next week feasibility: can they complete next week work within working days?
      // Uses actual weekdays in the next 7 calendar days (typically 5 days = 40h)
      const nextWeekWorkingDays = getNextWeekWorkingDays();
      const nextWeekWorkingHours = nextWeekWorkingDays * HOURS_PER_WORKDAY;
      workload.nextWeekIsFeasible = workload.nextWeekEstimatedHours <= nextWeekWorkingHours;
    });

    return workloadMap;
  }, [users, projects]);

  return {
    workloads,
    isLoading: usersLoading || projectsLoading,
  };
}

