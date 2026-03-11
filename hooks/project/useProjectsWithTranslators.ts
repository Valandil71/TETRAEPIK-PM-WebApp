"use client";

import { useQuery } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/core/useSupabase';
import type { ProjectWithTranslators, ProjectTranslator } from '@/types/project';
import { queryKeys } from "@/lib/queryKeys";

interface AssignmentUserRow {
  id: string;
  name: string;
  short_name: string | null;
  role: string;
  avatar: string | null;
}

interface ProjectAssignmentRow {
  project_id: number;
  assignment_status: ProjectTranslator["assignment_status"];
  done_message: string | null;
  users: AssignmentUserRow | null;
}

export function useProjectsWithTranslators(
  showPast: boolean = false,
  showAll: boolean = false,
  includeAllStatuses: boolean = false
) {
  const supabase = useSupabase();

  return useQuery({
    queryKey: queryKeys.projectsWithTranslators(showPast, showAll, includeAllStatuses),
    queryFn: async (): Promise<ProjectWithTranslators[]> => {
      // Build the query
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      // Only filter by active status unless includeAllStatuses is true
      // (invoicing page needs complete projects)
      if (!includeAllStatuses) {
        query = query.eq('status', 'active');
      }

      const { data: projects, error: projectsError } = await query;

      if (projectsError) {
        throw new Error(`Failed to fetch projects: ${projectsError.message}`);
      }

      if (!projects || projects.length === 0) {
        return [];
      }

      // Get all project assignments with user data
      const { data: assignments, error: assignmentsError } = await supabase
        .from('projects_assignment')
        .select(`
          project_id,
          assignment_status,
          done_message,
          users (
            id,
            name,
            short_name,
            role,
            avatar
          )
        `);

      if (assignmentsError) {
        throw new Error(`Failed to fetch project assignments: ${assignmentsError.message}`);
      }

      // Group assignments by project_id
      const assignmentsByProject = ((assignments ?? []) as ProjectAssignmentRow[]).reduce((acc: Record<number, ProjectTranslator[]>, assignment) => {
        const projectId = assignment.project_id;
        if (!acc[projectId]) {
          acc[projectId] = [];
        }
        if (assignment.users) {
          acc[projectId].push({
            id: assignment.users.id,
            name: assignment.users.name,
            short_name: assignment.users.short_name || null,
            role: assignment.users.role,
            assignment_status: assignment.assignment_status,
            avatar: assignment.users.avatar || null,
            done_message: assignment.done_message || null,
          });
        }
        return acc;
      }, {});

      // Combine projects with their translators
      const typedProjects = projects as Omit<ProjectWithTranslators, "translators">[];
      const projectsWithTranslators: ProjectWithTranslators[] = typedProjects.map((project) => ({
        ...project,
        translators: assignmentsByProject[project.id] || []
      }));

      // Filter and sort projects based on showPast parameter
      const now = new Date();
      
      const getClosestDeadline = (p: ProjectWithTranslators) => {
        const validDates = [p.initial_deadline, p.interim_deadline, p.final_deadline]
          .filter(Boolean)
          .map((d) => {
            const date = new Date(d!);
            return isNaN(date.getTime()) ? null : date;
          })
          .filter(Boolean);
        
        if (validDates.length === 0) return null;
        return new Date(Math.min(...validDates.map((d) => d!.getTime())));
      };

      // Filter projects based on their closest deadline
      // If showAll is true, return all projects without filtering
      const filteredProjects = showAll
        ? projectsWithTranslators // Show all projects
        : projectsWithTranslators.filter((p) => {
            const closest = getClosestDeadline(p);
            if (!closest) return false; // Exclude projects without valid deadlines
            
            const isPast = closest.getTime() < now.getTime();
            const shouldInclude = showPast ? isPast : !isPast;
            
            return shouldInclude;
          });

      // Sort projects
      const sortedProjects = filteredProjects.sort((a, b) => {
        const da = getClosestDeadline(a);
        const db = getClosestDeadline(b);
        
        // Handle projects without deadlines
        if (!da && !db) return 0;
        if (!da) return 1; // Put projects without deadlines at the end
        if (!db) return -1;
        
        if (showPast) {
          // For past projects: most recent first (reverse chronological order)
          return db.getTime() - da.getTime();
        } else {
          // For future projects: closest deadline first (chronological order)
          return da.getTime() - db.getTime();
        }
      });

      return sortedProjects;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
