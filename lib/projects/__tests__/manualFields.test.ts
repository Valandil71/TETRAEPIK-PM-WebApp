import { describe, expect, it } from "vitest";
import { hasManualInstructions, nextManualFields } from "@/lib/projects/manualFields";

const sapProject = {
  instructions: "TK: 000614",
  terminology_key: ["000614"],
  translation_area: null,
  work_list: ["0001"],
  graph_id: ["00001", "00002"],
  lxe_project: null,
  lxe_projects: null,
  manual_fields: [] as string[],
};

const unchangedForm = {
  instructions: "TK: 000614",
  terminology_key: ["000614"],
  translation_area: null,
  work_list: ["0001"],
  graph_id: ["00002", "00001"],
  lxe_project: null,
  lxe_projects: null,
};

describe("nextManualFields", () => {
  it("marks nothing when the SAP fields were not changed", () => {
    expect(nextManualFields(sapProject, unchangedForm)).toEqual([]);
  });

  it("marks the fields the PM changed", () => {
    const next = { ...unchangedForm, instructions: "WL: 0001, partner system", work_list: ["0002"] };
    expect(nextManualFields(sapProject, next).sort()).toEqual(["instructions", "work_list"]);
  });

  it("keeps earlier manual fields that were not touched", () => {
    const current = { ...sapProject, instructions: "WL: 0001, partner system", manual_fields: ["instructions"] };
    const next = { ...unchangedForm, instructions: "WL: 0001, partner system" };
    expect(nextManualFields(current, next)).toEqual(["instructions"]);
  });

  it("unmarks a field the PM cleared, so SAP fills it again", () => {
    const current = { ...sapProject, instructions: "WL: 0001, partner system", manual_fields: ["instructions"] };
    expect(nextManualFields(current, { ...unchangedForm, instructions: null })).toEqual([]);
  });
});

describe("hasManualInstructions", () => {
  it("is true only for text written by a person", () => {
    expect(hasManualInstructions({ instructions: "TK: 000614", manual_fields: [], api_source: "TPM_sap_api" })).toBe(false);
    expect(
      hasManualInstructions({ instructions: "partner system", manual_fields: ["instructions"], api_source: "TPM_sap_api" })
    ).toBe(true);
    expect(hasManualInstructions({ instructions: "Check glossary", manual_fields: null, api_source: "manual" })).toBe(true);
    expect(hasManualInstructions({ instructions: "  ", manual_fields: ["instructions"], api_source: "manual" })).toBe(false);
  });
});
