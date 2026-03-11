// Barrel export for hooks
// This provides a cleaner import experience: import { useUser, useMyProjects } from '@/hooks';

// Core hooks
export { useSupabase } from './core/useSupabase';
export { usePagination } from './core/usePagination';
export { useConcurrencySafeMutation } from './core/useConcurrencySafeMutation';

// User hooks
export { useUser } from './user/useUser';
export { useUsers } from './user/useUsers';
export { useUpdateProfile } from './user/useUpdateProfile';
export { useUpdateAvatar, AvatarAlreadyTakenError } from './user/useUpdateAvatar';
export { useUploadAvatar } from './user/useUploadAvatar';
export { useAvailableAvatars } from './user/useAvailableAvatars';
export { useRoleAccess } from './user/useRoleAccess';
export { useUpdateUserRole } from './user/useUpdateUserRole';
export { useUserWorkload } from './user/useUserWorkload';

// Project hooks
export { useProject } from './project/useProject';
export { useMyProjects } from './project/useMyProjects';
export { useProjectsWithTranslators } from './project/useProjectsWithTranslators';
export { useUpdateProject } from './project/useUpdateProject';
export { useUpdateAssignment } from './project/useUpdateAssignment';
export { useProjectFilters } from './project/useProjectFilters';

// SAP integration hooks
export { useSapProjects } from './sap/useSapProjects';
export type { SapProject, SapSubProject } from './sap/useSapProjects';
export { useSapImportStatus } from './sap/useSapImportStatus';
export type { SapImportStatusResponse } from './sap/useSapImportStatus';
export { useSapSubProjectDetails } from './sap/useSapSubProjectDetails';
export type { SapSubProjectDetails, SapStep, SapVolume, SapEnvironment } from './sap/useSapSubProjectDetails';
export { useSyncSapProjects } from './sap/useSyncSapProjects';
export type { SyncSapProjectsRequest, SyncSapProjectsResponse } from './sap/useSyncSapProjects';
export { useImportReports } from './sap/useImportReports';

// Settings hooks
export { useColorSettings } from './settings/useColorSettings';
export { useDefaultFilters } from './settings/useDefaultFilters';
export { useInstructionExclusions } from './settings/useInstructionExclusions';
export { useThemePreference, resolveTheme, type ThemePreference } from './settings/useThemePreference';

// UI hooks
export { useHomeCounts } from './ui/useHomeCounts';
export { useToast, toast } from './ui/use-toast';
