import Dexie, { type EntityTable } from "dexie";
import type {
  AppBackup,
  BusinessProfile,
  Receipt,
  ReceiptDraft,
  ReceiptTemplateId,
} from "../types";
import {
  backupSchema,
  DEFAULT_PROFILE,
  normalizeStoredDraft,
  normalizeStoredReceipt,
} from "./receipt";

type SettingRecord =
  | { key: "business-profile"; value: BusinessProfile }
  | { key: "active-template"; value: ReceiptTemplateId };

interface DraftRecord {
  key: `draft:${ReceiptTemplateId}`;
  templateId: ReceiptTemplateId;
  value: ReceiptDraft;
  editingId?: string;
}

export class ReceiptDatabase extends Dexie {
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
    this.version(2)
      .stores({
        receipts:
          "&id, templateId, receiptNumber, &[templateId+receiptNumber], date, createdAt, updatedAt, vehicleNumber",
        settings: "&key",
        drafts: "&key, templateId",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table("receipts")
          .toCollection()
          .modify((receipt) => Object.assign(receipt, normalizeStoredReceipt(receipt)));

        const drafts = transaction.table("drafts");
        const legacyDraft = await drafts.get("current-draft");
        if (legacyDraft) {
          await drafts.put({
            key: "draft:evergreen",
            templateId: "evergreen",
            value: normalizeStoredDraft(legacyDraft.value),
            editingId: legacyDraft.editingId,
          });
          await drafts.delete("current-draft");
        }
      });
  }
}

export const db = new ReceiptDatabase();

export async function loadProfile() {
  const setting = await db.settings.get("business-profile");
  return setting?.key === "business-profile" ? setting.value : DEFAULT_PROFILE;
}

export async function saveProfile(profile: BusinessProfile) {
  await db.settings.put({ key: "business-profile", value: profile });
}

export async function loadActiveTemplate() {
  const setting = await db.settings.get("active-template");
  return setting?.key === "active-template" ? setting.value : "evergreen";
}

export async function saveActiveTemplate(value: ReceiptTemplateId) {
  await db.settings.put({ key: "active-template", value });
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

export async function findReceiptNumber(
  templateId: ReceiptTemplateId,
  receiptNumber: string,
) {
  return db.receipts
    .where("[templateId+receiptNumber]")
    .equals([templateId, receiptNumber.trim()])
    .first();
}

export async function loadDraft(templateId: ReceiptTemplateId) {
  return db.drafts.get(`draft:${templateId}`);
}

export async function saveDraft(value: ReceiptDraft, editingId?: string) {
  await db.drafts.put({
    key: `draft:${value.templateId}`,
    templateId: value.templateId,
    value,
    editingId,
  });
}

export async function clearDraft(templateId: ReceiptTemplateId) {
  await db.drafts.delete(`draft:${templateId}`);
}

export async function createBackup(): Promise<AppBackup> {
  return {
    version: 2,
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
    await db.settings.put({ key: "active-template", value: "evergreen" });
  });
  return backup;
}
