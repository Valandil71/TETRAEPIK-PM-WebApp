/**
 * Converts technical error messages to user-friendly messages
 * Logs the original error to console for debugging
 */
export function getUserFriendlyError(error: Error | unknown, context?: string): string {
  // Log original error for debugging
  console.error(`Error${context ? ` in ${context}` : ""}:`, error);

  if (!(error instanceof Error)) {
    return "An unexpected error occurred. Please try again.";
  }

  const errorMessage = error.message.toLowerCase();
  const originalMessage = error.message;

  const extractDuplicateField = (message: string): string | null => {
    // Postgres duplicate format often includes: Key (field_name)=(value) already exists
    const keyMatch = message.match(/key\s*\(([^)]+)\)\s*=\s*\([^)]+\)\s*already exists/i);
    if (keyMatch?.[1]) return keyMatch[1].trim();

    // Fallback: parse constraint/index name, e.g. "users_TE-user_key"
    const constraintMatch = message.match(/constraint\s+"([^"]+)"/i);
    if (constraintMatch?.[1]) {
      const normalizedConstraint = constraintMatch[1]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
      if (normalizedConstraint.includes("c_user")) return "c_user";
      if (normalizedConstraint.includes("te_user")) return "te_user";
      if (normalizedConstraint.includes("avatar")) return "avatar";
      if (normalizedConstraint.includes("color")) return "color setting";
    }

    // Final fallback: raw message may include field names with mixed separators
    const lower = message.toLowerCase();
    if (lower.includes("c_user") || lower.includes("c-user")) return "c_user";
    if (lower.includes("te_user") || lower.includes("te-user")) return "te_user";
    if (lower.includes("avatar")) return "avatar";
    if (lower.includes("color")) return "color setting";

    return null;
  };

  const formatFieldLabel = (field: string): string => {
    if (field === "c_user") return "C_user";
    if (field === "te_user") return "TE_user";
    if (field === "avatar") return "Avatar";
    if (field === "color setting") return "Color setting";
    return field.replace(/_/g, " ");
  };

  // Database constraint errors
  if (errorMessage.includes("unique constraint") || errorMessage.includes("duplicate key")) {
    const duplicateField = extractDuplicateField(originalMessage);
    if (duplicateField) {
      const label = formatFieldLabel(duplicateField);
      return `${label} is already in use. Please choose a different value.`;
    }
    return "A value you entered is already in use. Please choose a different one.";
  }

  // Foreign key constraint errors
  if (errorMessage.includes("foreign key constraint") || errorMessage.includes("violates foreign key")) {
    return "Cannot perform this action. The item may have been deleted or is in use.";
  }

  // Not found errors
  if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
    return "The requested item could not be found. It may have been deleted.";
  }

  // Permission/authentication errors
  if (errorMessage.includes("permission") || errorMessage.includes("unauthorized") || errorMessage.includes("not authenticated")) {
    return "You don't have permission to perform this action. Please contact an administrator.";
  }

  // Network/connection errors
  if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("connection")) {
    return "Connection error. Please check your internet connection and try again.";
  }

  // Database column errors (configuration issues)
  if (errorMessage.includes("column") && errorMessage.includes("does not exist")) {
    return "Configuration error. Please contact support.";
  }

  // Validation errors
  if (errorMessage.includes("required") || errorMessage.includes("invalid")) {
    return originalMessage; // Keep validation messages as-is
  }

  // Generic Supabase errors
  if (errorMessage.includes("failed to")) {
    // Extract the action from the error message
    const match = originalMessage.match(/failed to (.+?)(?:\.|:)/i);
    if (match) {
      return `Unable to ${match[1]}. Please try again.`;
    }
  }

  // If we can't make it user-friendly, return a generic message
  // but still log the original
  return "An error occurred. Please try again or contact support if the problem persists.";
}
