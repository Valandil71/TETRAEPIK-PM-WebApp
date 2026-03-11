// /app/api/sap/subprojects/[projectId]/[subProjectId]/route.ts
// GET: Get SAP subproject details with instructions

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSapClient } from '@/lib/sap/client';
import { createErrorResponse } from '@/lib/sap/errors';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { mapSapToSubProjectDetails } from '@/lib/sap/mappers';
import { isBlockedSapProjectType } from '@/lib/sap/project-type-rules';

interface RouteParams {
  params: Promise<{ projectId: string; subProjectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId, subProjectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    if (!subProjectId) {
      return NextResponse.json(
        { error: 'Invalid subproject ID' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;

    const sapClient = getSapClient();

    // Fetch subproject details and instructions in parallel
    const [detailsResponse, instructionsResponse, projectsResponse] = await Promise.all([
      sapClient.getSubProjectDetails(projectIdNum, subProjectId),
      sapClient.getInstructions(projectIdNum, subProjectId).catch(() => ({ instructions: [] })),
      sapClient.getProjects(), // Need this to get dmName from subproject list
    ]);

    // Find the subproject in the project list to get dmName
    const project = projectsResponse.projects.find(p => p.projectId === projectIdNum);
    const subProjectSummary = project?.subProjects.find(s => s.subProjectId === subProjectId);

    if (!subProjectSummary) {
      return NextResponse.json(
        { error: 'Subproject not found' },
        { status: 404 }
      );
    }
    if (isBlockedSapProjectType(subProjectSummary.projectType)) {
      return NextResponse.json(
        { error: 'Subproject not found' },
        { status: 404 }
      );
    }

    // Map to frontend details format
    const details = mapSapToSubProjectDetails(
      subProjectSummary,
      detailsResponse,
      instructionsResponse.instructions
    );

    return NextResponse.json({ details });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch SAP subproject details');
  }
}
