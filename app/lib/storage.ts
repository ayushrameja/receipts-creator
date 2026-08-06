import Dexie, { type EntityTable } from "dexie";
import type { AppBackup, BusinessProfile, Receipt, ReceiptDraft } from "../types";
import { backupSchema, DEFAULT_PROFILE } from "./receipt";

interface SettingRecord {
  key: "business-profile";
  value: BusinessProfile;
}

interface DraftRecord {
  key: "current-draft";
  value: ReceiptDraft;
  editingId?: string;
}

class ReceiptDatabase extends Dexie {
  receipts!: EntityTable<Receipt, "id">;
  settings!: EntityTable<SettingRecord, "key">;
  drafts!: EntityTable<DraftRecord, "key">;

  constructor() {
    super("evergreen-receipts");
    this.version(1).stores({
      receipts: "&id, &receiptNumber, date, createdAt, updatedAt, customerName, vehicleNumber",
      settings: "&key",
      drafts: "&key",
    });
  }
}

export const db = new ReceiptDatabase();

export async function loadProfile() {
  return (await db.settings.get("business-profile"))?.value ?? DEFAULT_PROFILE;
}

export async function saveProfile(profile: BusinessProfile) {
  await db.settings.put({ key: "business-profile", value: profile });
}

export async function loadReceipts() {
  return db.receipts.orderBy("updatedAt").reverse().toArray();
}

export async function saveReceipt(receipt: Receipt) {
  await db.receipts.put(receipt);
}

export async function deleteReceipt(id: string) {
  await db.receipts.delete(id);
}

export async function findReceiptNumber(receiptNumber: string) {
  return db.receipts.where("receiptNumber").equals(receiptNumber.trim()).first();
}

export async function loadDraft() {
  return db.drafts.get("current-draft");
}

export async function saveDraft(value: ReceiptDraft, editingId?: string) {
  await db.drafts.put({ key: "current-draft", value, editingId });
}

export async function clearDraft() {
  await db.drafts.delete("current-draft");
}

export async function createBackup(): Promise<AppBackup> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: await loadProfile(),
    receipts: await db.receipts.toArray(),
  };
}

export async function restoreBackup(input: unknown) {
  const backup = backupSchema.parse(input);
  await db.transaction("rw", db.receipts, db.settings, db.drafts, async () => {
    await db.receipts.clear();
    await db.settings.clear();
    await db.drafts.clear();
    await db.receipts.bulkPut(backup.receipts);
    await db.settings.put({ key: "business-profile", value: backup.profile });
  });
  return backup;
}

