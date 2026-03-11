import type { SapInstructionEntry } from "@/types/project";
import { filterSapInstructions } from "@/lib/sap/instruction-exclusions";

interface InstructionsPreviewInput {
  instructions?: string | null;
  sapInstructions?: SapInstructionEntry[] | null;
  exclusionSet?: Set<string>;
}

interface InstructionsPreviewResult {
  displayText: string;
  hasAnyInstructions: boolean;
}

export function getInstructionsPreview({
  instructions,
  sapInstructions,
  exclusionSet = new Set<string>(),
}: InstructionsPreviewInput): InstructionsPreviewResult {
  const hasManualInstructions = !!instructions && instructions.trim() !== "";
  const visibleSapInstructions = filterSapInstructions(sapInstructions, exclusionSet);

  if (hasManualInstructions) {
    return {
      displayText: instructions,
      hasAnyInstructions: true,
    };
  }

  if (visibleSapInstructions.length > 0) {
    return {
      displayText: "SAP instructions",
      hasAnyInstructions: true,
    };
  }

  return {
    displayText: "No instructions",
    hasAnyInstructions: false,
  };
}