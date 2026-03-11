import { Project, AssignmentStatus } from './project';

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  assignment_status: AssignmentStatus;
  initial_message?: string | null;
  refusal_message?: string | null;
  done_message?: string | null;
  projects: Project;
}