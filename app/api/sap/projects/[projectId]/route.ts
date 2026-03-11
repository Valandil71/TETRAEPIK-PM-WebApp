// /app/api/sap/projects/[projectId]/route.ts
// GET: Get SAP project details

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSapClient } from '@/lib/sap/client';
import { createErrorResponse } from '@/lib/sap/errors';
import { getAuthenticatedSupabase } from '@/lib/api/withAuth';
import { isBlockedSapProjectType } from '@/lib/sap/project-type-rules';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectIdNum = parseInt(projectId, 10);

    if (isNaN(projectIdNum)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    const auth = await getAuthenticatedSupabase();
    if ('error' in auth) return auth.error;

    // Fetch SAP project details
    // Note: The SAP API doesn't have a separate project details endpoint
    // We need to get the project from the list and filter
    const sapClient = getSapClient();
    const sapData = await sapClient.getProjects();

    const project = sapData.projects.find(p => p.projectId === projectIdNum);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    project.subProjects = project.subProjects.filter(
      sub => !isBlockedSapProjectType(sub.projectType)
    );

    return NextResponse.json({ project });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch SAP project details');
  }
}
