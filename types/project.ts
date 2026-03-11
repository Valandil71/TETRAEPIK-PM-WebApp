// /types/project.ts
import type { ApiSource } from './sap';

export type ProjectStatus = "complete" | "active" | "cancelled" /* | "pending" */;

export type AssignmentStatus = "unclaimed" | "claimed" | "done" | "rejected";

export interface Project {
  id: number;
  name: string;
  interim_deadline: string | null;
  initial_deadline: string | null;
  final_deadline: string | null;
  system: string;
  words: number | null;
  lines: number | null;
  status: ProjectStatus;
  language_in: string;
  language_out: string;
  instructions?: string | null;
  paid?: boolean | null;
  invoiced?: boolean | null;
  created_at?: string;
  updated_at?: string;

  // SAP Integration Fields
  sap_subproject_id?: string | null;
  sap_import_key?: string | null;
  api_source?: ApiSource;
  last_synced_at?: string | null;
  sap_instructions?: SapInstructionEntry[] | null;
  sap_pm?: string | null;

  // New fields
  project_type?: string | null;
  terminology_key?: string[] | null;
  lxe_project?: string[] | null;
  translation_area?: string[] | null;
  work_list?: string[] | null;
  graph_id?: string[] | null;
  lxe_projects?: string[] | null;
  url?: string | null;
  hours?: number | null;
  project_notes?: string | null;
}

/** SAP instruction entry stored in sap_instructions JSONB column */
export interface SapInstructionEntry {
  /** Title/summary from SAP */
  instructionShort: string;
  /** Full body from SAP */
  instructionLong: string;
  slsLang?: string;
  contentId?: string;
  /** @deprecated Use instructionLong or instructionShort. Kept for backward compat with existing DB data. */
  text?: string;
}

/** Translator info for project lists */
export interface ProjectTranslator {
  id: string;
  name: string;
  short_name?: string | null;
  role: string;
  assignment_status: AssignmentStatus;
  avatar?: string | null;
  done_message?: string | null;
}

/** Extended translator info with messages (for detail views) */
export interface ProjectTranslatorWithMessages extends ProjectTranslator {
  initial_message?: string | null;
  refusal_message?: string | null;
  done_message?: string | null;
}

/** Project with basic translator info (for lists) */
export interface ProjectWithTranslators extends Project {
  translators: ProjectTranslator[];
}

/** Project with detailed translator info including messages (for detail/edit views) */
export interface ProjectWithTranslatorDetails extends Project {
  translators: ProjectTranslatorWithMessages[];
}
