export interface ProjectFilterState {
  searchTerm: string;
  systemFilter: string | null;
  dueDateFilter: string | null;
  customDueDate: string;
  assignmentStatusFilter: string | null;
  sourceLangFilter: string | null;
  targetLangFilter: string | null;
  lengthFilter: string | null;
}

export type ProjectFilterUpdate =
  | ProjectFilterState
  | ((filters: ProjectFilterState) => ProjectFilterState);

export const DEFAULT_PROJECT_FILTER_STATE: ProjectFilterState = {
  searchTerm: "",
  systemFilter: null,
  dueDateFilter: null,
  customDueDate: "",
  assignmentStatusFilter: null,
  sourceLangFilter: null,
  targetLangFilter: null,
  lengthFilter: null,
};

export function createDefaultProjectFilterState(): ProjectFilterState {
  return { ...DEFAULT_PROJECT_FILTER_STATE };
}
