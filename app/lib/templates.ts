import type { ReceiptDraft, ReceiptTemplateId } from "../types";
import { createEmptyDraft, validateDraft } from "./receipt";

export interface ReceiptTemplateDefinition {
  id: ReceiptTemplateId;
  label: string;
  description: string;
  exportSizeMm: { width: number; height: number };
  createDraft: () => ReceiptDraft;
  validate: (draft: ReceiptDraft) => string[];
}

export const RECEIPT_TEMPLATE_IDS: ReceiptTemplateId[] = ["evergreen", "skn"];

export const RECEIPT_TEMPLATES: Record<ReceiptTemplateId, ReceiptTemplateDefinition> = {
  evergreen: {
    id: "evergreen",
    label: "Evergreen",
    description: "Filling station cash or credit memo",
    exportSizeMm: { width: 105, height: 148 },
    createDraft: () => createEmptyDraft("evergreen"),
    validate: validateDraft,
  },
  skn: {
    id: "skn",
    label: "SKN",
    description: "Natural gas retail invoice",
    exportSizeMm: { width: 105, height: 132 },
    createDraft: () => createEmptyDraft("skn"),
    validate: validateDraft,
  },
};

export function getReceiptTemplate(templateId: ReceiptTemplateId) {
  return RECEIPT_TEMPLATES[templateId];
}
