// /app/api/sap/projects/route.ts
// GET: List all SAP projects and subprojects

import { NextResponse } from 'next/server';
import { getSapClient } from '@/lib/sap/client';
import { createErrorResponse } from '@/lib/sap/errors';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import type { SapProjectListItem, SapSubProjectListItem } from '@/types/sap';
import { isBlockedSapProjectType } from '@/lib/sap/project-type-rules';

export async function GET() {
  try {
    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;
    const { supabase } = auth;

    // Fetch SAP projects
    const sapClient = getSapClient();
    const sapData = await sapClient.getProjects();

    // Get existing SAP projects from database for comparison
    // Fetch all SAP-sourced projects with composite matching fields
    const { data: existingProjects } = await supabase
      .from('projects')
      .select('id, sap_subproject_id, language_in, language_out, translation_area, system, last_synced_at')
      .not('sap_subproject_id', 'is', null);

    // Group existing projects by sap_subproject_id (one subproject can map to multiple local projects)
    const existingBySubId = new Map<string, typeof existingProjects>();
    for (const p of existingProjects || []) {
      const key = p.sap_subproject_id;
      if (!existingBySubId.has(key)) {
        existingBySubId.set(key, []);
      }
      existingBySubId.get(key)!.push(p);
    }

    // Transform to frontend format with local status
    const projects: SapProjectListItem[] = sapData.projects
      .map(project => ({
        projectId: project.projectId,
        projectName: project.projectName,
        account: project.account,
        subProjects: project.subProjects
          .filter(sub => !isBlockedSapProjectType(sub.projectType))
          .map(sub => {
            const existingList = existingBySubId.get(sub.subProjectId) || [];
            const hasLocal = existingList.length > 0;
            return {
              subProjectId: sub.subProjectId,
              subProjectName: sub.subProjectName,
              dmName: sub.dmName,
              pmName: sub.pmName,
              projectType: sub.projectType,
              existsLocally: hasLocal,
              localProjectId: hasLocal ? existingList[0].id : undefined,
              needsUpdate: hasLocal,
            } satisfies SapSubProjectListItem;
          }),
      }))
      .filter(project => project.subProjects.length > 0);

    return NextResponse.json({ projects });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch SAP projects');
  }
}
