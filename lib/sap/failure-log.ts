// /lib/sap/failure-log.ts
// Failure tracking for SAP imports

export type FailureStage = 'lookup' | 'details' | 'match' | 'update' | 'insert' | 'process';

export interface FailedImportItem {
  projectId: number | null;
  subProjectId: string | null;
  stage: FailureStage;
  message: string;
  explanation: string;
  timestamp: string;
}

function explainFailure(stage: FailureStage): string {
  switch (stage) {
    case 'lookup':
      return 'The SAP project or subproject could not be found in the fetched SAP project list for this import run.';
    case 'details':
      return 'The SAP subproject details or instructions could not be fetched before local processing started.';
    case 'match':
      return 'The local project lookup failed before the importer could decide whether to update an existing row or create a new one.';
    case 'update':
      return 'A local project row was found, but updating the SAP-owned fields in the database failed.';
    case 'insert':
      return 'The importer generated a local project row, but inserting it into the database failed.';
    case 'process':
    default:
      return 'An unexpected error occurred while processing this SAP subproject during the import run.';
  }
}

/** Creates a failure recorder that accumulates failures during an import run */
export function createFailureRecorder() {
  const items: FailedImportItem[] = [];
  let failedCount = 0;
  const errorMessages: string[] = [];

  return {
    record(
      stage: FailureStage,
      message: string,
      projectId: number | null,
      subProjectId: string | null,
    ) {
      failedCount++;
      errorMessages.push(message);
      items.push({
        projectId,
        subProjectId,
        stage,
        message,
        explanation: explainFailure(stage),
        timestamp: new Date().toISOString(),
      });
    },
    get items() { return items; },
    get failedCount() { return failedCount; },
    get errorMessages() { return errorMessages; },
  };
}
