import { z } from "zod";
import type {
  AppBackup,
  BusinessProfile,
  EvergreenReceiptDraft,
  EvergreenReceiptSnapshot,
  LineItem,
  Receipt,
  ReceiptDraft,
  ReceiptSnapshot,
  ReceiptTemplateId,
  SknReceiptDraft,
} from "../types";

export const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "EVERGREEN FILLING STATION",
  dealerLine: "Dealers: BHARAT PETROLEUM CORPORATION LTD.",
  gstin: "03AAEFE7466J1ZB",
  address: "Lehli-Banur Road, Jalalpur, Teh. Dera Bassi (Pb.)",
  phonePrimary: "9815358789",
  phoneSecondary: "9855687200",
  taxNote: "Including taxes",
  footerNote: "E. & O.E.",
};

export const PRODUCT_SUGGESTIONS = ["Petrol (MS)", "Lts. H.S.D.", "Lts. M. Oil"];

export function createId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createLineItem(particulars = "Petrol (MS)"): LineItem {
  return {
    id: createId("item"),
    particulars,
    quantity: "",
    rate: "",
    manualAmount: "",
    useManualAmount: false,
  };
}

export function createEmptyEvergreenDraft(): EvergreenReceiptDraft {
  return {
    templateId: "evergreen",
    receiptNumber: "",
    date: "",
    paymentMode: "cash",
    customerName: "",
    vehicleNumber: "",
    items: PRODUCT_SUGGESTIONS.map((particulars) => createLineItem(particulars)),
  };
}

export function createEmptySknDraft(): SknReceiptDraft {
  return {
    templateId: "skn",
    receiptNumber: "",
    date: "",
    vehicleNumber: "",
    quantity: "",
    amount: "",
    total: "",
  };
}

export function createEmptyDraft(): EvergreenReceiptDraft;
export function createEmptyDraft(templateId: "evergreen"): EvergreenReceiptDraft;
export function createEmptyDraft(templateId: "skn"): SknReceiptDraft;
export function createEmptyDraft(templateId?: ReceiptTemplateId): ReceiptDraft;
export function createEmptyDraft(templateId: ReceiptTemplateId = "evergreen") {
  return templateId === "skn" ? createEmptySknDraft() : createEmptyEvergreenDraft();
}

export function parseMoney(value: string | number) {
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const parsed = typeof normalized === "number" ? normalized : Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineAmount(item: LineItem) {
  if (item.useManualAmount) return roundMoney(parseMoney(item.manualAmount));
  return roundMoney(parseMoney(item.quantity) * parseMoney(item.rate));
}

export function calculateTotal(items: LineItem[]) {
  return roundMoney(items.reduce((sum, item) => sum + calculateLineAmount(item), 0));
}

export function calculateDraftTotal(draft: ReceiptDraft) {
  if (draft.templateId === "evergreen") return calculateTotal(draft.items);
  return roundMoney(parseMoney(draft.total || draft.amount));
}

export function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function validateDraft(draft: ReceiptDraft) {
  const errors: string[] = [];
  if (!draft.receiptNumber.trim()) errors.push("Receipt number is required.");
  if (!draft.date) errors.push("Receipt date is required.");

  if (draft.templateId === "skn") {
    if (parseMoney(draft.amount) <= 0) errors.push("Enter a positive SKN amount.");
    if ([draft.quantity, draft.amount, draft.total].some((value) => parseMoney(value) < 0)) {
      errors.push("Quantity, amount, and total cannot be negative.");
    }
    return errors;
  }

  const validItems = draft.items.filter((item) => {
    if (!item.particulars.trim()) return false;
    if (item.useManualAmount) return parseMoney(item.manualAmount) > 0;
    return parseMoney(item.quantity) > 0 && parseMoney(item.rate) >= 0;
  });
  if (validItems.length === 0) errors.push("Add at least one complete line item.");
  if (
    draft.items.some(
      (item) =>
        parseMoney(item.quantity) < 0 ||
        parseMoney(item.rate) < 0 ||
        parseMoney(item.manualAmount) < 0,
    )
  ) {
    errors.push("Quantity, rate, and amount cannot be negative.");
  }
  return errors;
}

export function draftFromReceipt(receipt: Receipt): ReceiptDraft {
  if (receipt.templateId === "skn") {
    return {
      templateId: "skn",
      receiptNumber: receipt.receiptNumber,
      date: receipt.date,
      vehicleNumber: receipt.vehicleNumber,
      quantity: receipt.quantity,
      amount: receipt.amount,
      total: receipt.total,
    };
  }
  return {
    templateId: "evergreen",
    receiptNumber: receipt.receiptNumber,
    date: receipt.date,
    paymentMode: receipt.paymentMode,
    customerName: receipt.customerName,
    vehicleNumber: receipt.vehicleNumber,
    items: structuredClone(receipt.items),
  };
}

export function receiptSnapshot(receipt: Receipt): ReceiptSnapshot {
  const snapshot: Partial<Receipt> = structuredClone(receipt);
  delete snapshot.revisions;
  return snapshot as ReceiptSnapshot;
}

export function buildReceipt(
  draft: ReceiptDraft,
  profile: BusinessProfile,
  existing?: Receipt,
  revisionReason?: string,
): Receipt {
  const now = new Date().toISOString();
  const metadata = {
    id: existing?.id ?? createId("receipt"),
    totalValue: calculateDraftTotal(draft),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const snapshot: ReceiptSnapshot =
    draft.templateId === "evergreen"
      ? {
          ...structuredClone(draft),
          ...metadata,
          profileSnapshot:
            existing?.templateId === "evergreen"
              ? structuredClone(existing.profileSnapshot)
              : structuredClone(profile),
        }
      : { ...structuredClone(draft), ...metadata };

  if (!existing) return { ...snapshot, revisions: [] } as Receipt;
  if (existing.templateId !== draft.templateId) {
    throw new Error("A receipt cannot change templates.");
  }
  if (!revisionReason?.trim()) throw new Error("A revision reason is required.");
  return {
    ...snapshot,
    revisions: [
      ...existing.revisions,
      {
        id: createId("revision"),
        reason: revisionReason.trim(),
        revisedAt: now,
        previous: receiptSnapshot(existing),
      },
    ],
  } as Receipt;
}

export function createPreviewReceipt(
  draft: ReceiptDraft,
  profile: BusinessProfile,
  existing?: Receipt,
): Receipt {
  const now = new Date().toISOString();
  const metadata = {
    id: existing?.id ?? "preview",
    totalValue: calculateDraftTotal(draft),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    revisions: existing?.revisions ?? [],
  };
  if (draft.templateId === "skn") return { ...structuredClone(draft), ...metadata };
  return {
    ...structuredClone(draft),
    ...metadata,
    profileSnapshot:
      existing?.templateId === "evergreen" ? existing.profileSnapshot : profile,
  };
}

const profileSchema = z.object({
  businessName: z.string(),
  dealerLine: z.string(),
  gstin: z.string(),
  address: z.string(),
  phonePrimary: z.string(),
  phoneSecondary: z.string(),
  taxNote: z.string(),
  footerNote: z.string(),
  logoDataUrl: z.string().optional(),
});

const lineItemSchema = z.object({
  id: z.string(),
  particulars: z.string(),
  quantity: z.string(),
  rate: z.string(),
  manualAmount: z.string(),
  useManualAmount: z.boolean(),
});

const evergreenFields = {
  templateId: z.literal("evergreen"),
  receiptNumber: z.string(),
  date: z.string(),
  paymentMode: z.enum(["cash", "credit"]),
  customerName: z.string(),
  vehicleNumber: z.string(),
  items: z.array(lineItemSchema),
};

const sknFields = {
  templateId: z.literal("skn"),
  receiptNumber: z.string(),
  date: z.string(),
  vehicleNumber: z.string(),
  quantity: z.string(),
  amount: z.string(),
  total: z.string(),
};

const metadataFields = {
  id: z.string(),
  totalValue: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

const evergreenSnapshotSchema = z.object({
  ...evergreenFields,
  ...metadataFields,
  profileSnapshot: profileSchema,
});

const sknSnapshotSchema = z.object({ ...sknFields, ...metadataFields });
const snapshotSchema = z.discriminatedUnion("templateId", [evergreenSnapshotSchema, sknSnapshotSchema]);

const revisionSchema = z.object({
  id: z.string(),
  reason: z.string(),
  revisedAt: z.string(),
  previous: snapshotSchema,
});

const receiptSchema = z.discriminatedUnion("templateId", [
  evergreenSnapshotSchema.extend({ revisions: z.array(revisionSchema) }),
  sknSnapshotSchema.extend({ revisions: z.array(revisionSchema) }),
]);

const backupV2Schema = z.object({
  version: z.literal(2),
  exportedAt: z.string(),
  profile: profileSchema,
  receipts: z.array(receiptSchema),
});

const legacyDraftFields = {
  receiptNumber: z.string(),
  date: z.string(),
  paymentMode: z.enum(["cash", "credit"]),
  customerName: z.string(),
  vehicleNumber: z.string(),
  items: z.array(lineItemSchema),
};

const legacySnapshotSchema = z.object({
  ...legacyDraftFields,
  id: z.string(),
  total: z.number(),
  profileSnapshot: profileSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const legacyReceiptSchema = legacySnapshotSchema.extend({
  revisions: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
      revisedAt: z.string(),
      previous: legacySnapshotSchema,
    }),
  ),
});

const backupV1Schema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  profile: profileSchema,
  receipts: z.array(legacyReceiptSchema),
});

type LegacySnapshot = z.infer<typeof legacySnapshotSchema>;
type LegacyReceipt = z.infer<typeof legacyReceiptSchema>;

function migrateLegacySnapshot(snapshot: LegacySnapshot): EvergreenReceiptSnapshot {
  const { total, ...fields } = snapshot;
  return { ...fields, templateId: "evergreen", totalValue: total };
}

function migrateLegacyReceipt(receipt: LegacyReceipt): Receipt {
  const migrated = migrateLegacySnapshot(receipt);
  return {
    ...migrated,
    templateId: "evergreen",
    revisions: receipt.revisions.map((revision) => ({
      ...revision,
      previous: migrateLegacySnapshot(revision.previous),
    })),
  };
}

export const backupSchema: z.ZodType<AppBackup> = z.union([backupV2Schema, backupV1Schema]).transform((backup) => {
  if (backup.version === 2) return backup;
  return {
    version: 2 as const,
    exportedAt: backup.exportedAt,
    profile: backup.profile,
    receipts: backup.receipts.map(migrateLegacyReceipt),
  };
});

export function normalizeStoredDraft(input: unknown): ReceiptDraft {
  const draft = (input ?? {}) as Record<string, unknown>;
  if (draft.templateId === "skn") {
    return {
      ...createEmptySknDraft(),
      ...(draft as Partial<SknReceiptDraft>),
      templateId: "skn",
    };
  }
  return {
    ...createEmptyEvergreenDraft(),
    ...(draft as Partial<EvergreenReceiptDraft>),
    templateId: "evergreen",
  };
}

export function normalizeStoredReceipt(input: unknown): Receipt {
  const receipt = input as Record<string, unknown> & {
    templateId?: ReceiptTemplateId;
    total?: number;
    totalValue?: number;
    revisions?: Array<Record<string, unknown> & { previous?: unknown }>;
  };
  if (receipt.templateId === "skn" || receipt.templateId === "evergreen") {
    return receipt as unknown as Receipt;
  }
  const revisions = (receipt.revisions ?? []).map((revision) => ({
    ...revision,
    previous: receiptSnapshot(
      normalizeStoredReceipt({ ...(revision.previous as object), revisions: [] }),
    ),
  }));
  const { total, ...legacy } = receipt;
  return {
    ...legacy,
    templateId: "evergreen",
    totalValue: receipt.totalValue ?? total ?? 0,
    revisions,
  } as unknown as Receipt;
}

export function matchesReceipt(receipt: Receipt, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  const values =
    receipt.templateId === "evergreen"
      ? [
          "evergreen",
          receipt.receiptNumber,
          receipt.customerName,
          receipt.vehicleNumber,
          receipt.date,
        ]
      : ["skn", "cng", receipt.receiptNumber, receipt.vehicleNumber, receipt.date];
  return values.join(" ").toLocaleLowerCase().includes(normalized);
}
