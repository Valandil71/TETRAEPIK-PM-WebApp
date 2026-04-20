// /app/api/sap/projects/route.ts
// GET: List all SAP projects and subprojects

import { NextResponse } from 'next/server';
import { getSapClient } from '@/lib/sap/client';
import { createErrorResponse } from '@/lib/sap/errors';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import type { SapProjectListItem } from '@/types/sap';
import { isBlockedSapProjectType } from '@/lib/sap/project-type-rules';

export async function GET() {
  try {
    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;

    // Fetch SAP projects
    const sapClient = getSapClient();
    const sapData = await sapClient.getProjects();

    // Transform to frontend format
    const projects: SapProjectListItem[] = sapData.projects
      .map(project => ({
        projectId: project.projectId,
        projectName: project.projectName,
        account: project.account,
        subProjects: project.subProjects
          .filter(sub => !isBlockedSapProjectType(sub.projectType))
          .map(sub => ({
            subProjectId: sub.subProjectId,
            subProjectName: sub.subProjectName,
            dmName: sub.dmName,
            pmName: sub.pmName,
            projectType: sub.projectType,
          })),
      }))
      .filter(project => project.subProjects.length > 0);

    return NextResponse.json({ projects });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch SAP projects');
  }
}
