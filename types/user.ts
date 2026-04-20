export type UserRole = "employee" | "admin" | "pm";
export type UserThemePreference = "system" | "light" | "dark";
export type UserGroupExpansionMode = "expandAll" | "collapseAll";


export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  C_user: string;
  TE_user: string;
  short_name?: string | null;
  avatar?: string | null;
  custom_avatar?: string | null;
  words_per_hour?: number | null;
  lines_per_hour?: number | null;
  theme_preference?: UserThemePreference | null;
  expansion_mode?: UserGroupExpansionMode | null;
}
