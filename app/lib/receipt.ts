import { z } from "zod";
import type {
  AppBackup,
  BusinessProfile,
  LineItem,
  Receipt,
  ReceiptDraft,
  ReceiptSnapshot,
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

export function todayIso() {
  return new Date().toLocaleDateString("en-CA");
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

export function createEmptyDraft(): ReceiptDraft {
  return {
    receiptNumber: "",
    date: todayIso(),
    paymentMode: "cash",
    customerName: "",
    vehicleNumber: "",
    items: PRODUCT_SUGGESTIONS.map((particulars) => createLineItem(particulars)),
  };
}

export function parseMoney(value: string | number) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
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
  const validItems = draft.items.filter((item) => {
    if (!item.particulars.trim()) return false;
    if (item.useManualAmount) return parseMoney(item.manualAmount) > 0;
    return parseMoney(item.quantity) > 0 && parseMoney(item.rate) >= 0;
  });
  if (validItems.length === 0) errors.push("Add at least one complete line item.");
  if (draft.items.some((item) => parseMoney(item.quantity) < 0 || parseMoney(item.rate) < 0)) {
    errors.push("Quantity and rate cannot be negative.");
  }
  return errors;
}

export function receiptSnapshot(receipt: Receipt): ReceiptSnapshot {
  const snapshot = structuredClone(receipt) as Receipt & { revisions?: Receipt["revisions"] };
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
  if (!existing) {
    return {
      ...structuredClone(draft),
      id: createId("receipt"),
      total: calculateTotal(draft.items),
      profileSnapshot: structuredClone(profile),
      createdAt: now,
      updatedAt: now,
      revisions: [],
    };
  }

  if (!revisionReason?.trim()) throw new Error("A revision reason is required.");
  return {
    ...existing,
    ...structuredClone(draft),
    total: calculateTotal(draft.items),
    updatedAt: now,
    revisions: [
      ...existing.revisions,
      {
        id: createId("revision"),
        reason: revisionReason.trim(),
        revisedAt: now,
        previous: receiptSnapshot(existing),
      },
    ],
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

const draftFields = {
  receiptNumber: z.string(),
  date: z.string(),
  paymentMode: z.enum(["cash", "credit"]),
  customerName: z.string(),
  vehicleNumber: z.string(),
  items: z.array(lineItemSchema),
};

const snapshotSchema = z.object({
  ...draftFields,
  id: z.string(),
  total: z.number(),
  profileSnapshot: profileSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const receiptSchema: z.ZodType<Receipt> = snapshotSchema.extend({
  revisions: z.array(
    z.object({
      id: z.string(),
      reason: z.string(),
      revisedAt: z.string(),
      previous: snapshotSchema,
    }),
  ),
});

export const backupSchema: z.ZodType<AppBackup> = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  profile: profileSchema,
  receipts: z.array(receiptSchema),
});

export function matchesReceipt(receipt: Receipt, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [receipt.receiptNumber, receipt.customerName, receipt.vehicleNumber, receipt.date]
    .join(" ")
    .toLocaleLowerCase()
    .includes(normalized);
}
