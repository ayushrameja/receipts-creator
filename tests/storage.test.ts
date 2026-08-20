import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildReceipt, createEmptyDraft, createLineItem, DEFAULT_PROFILE } from "../app/lib/receipt";
import {
  db,
  findReceiptNumber,
  loadDraft,
  loadReceipts,
  saveDraft,
  saveReceipt,
} from "../app/lib/storage";

const DATABASE_NAME = "evergreen-receipts";

describe("template-aware IndexedDB storage", () => {
  beforeEach(async () => {
    db.close();
    await Dexie.delete(DATABASE_NAME);
  });

  afterEach(() => db.close());

  it("keeps an independently editable draft for each template", async () => {
    await db.open();
    await saveDraft({ ...createEmptyDraft("evergreen"), receiptNumber: "E-1" });
    await saveDraft({ ...createEmptyDraft("skn"), receiptNumber: "S-1" });
    expect((await loadDraft("evergreen"))?.value.receiptNumber).toBe("E-1");
    expect((await loadDraft("skn"))?.value.receiptNumber).toBe("S-1");
  });

  it("allows the same receipt number in different templates", async () => {
    await db.open();
    await saveReceipt(
      buildReceipt({ ...createEmptyDraft("evergreen"), receiptNumber: "100" }, DEFAULT_PROFILE),
    );
    await saveReceipt(
      buildReceipt({ ...createEmptyDraft("skn"), receiptNumber: "100" }, DEFAULT_PROFILE),
    );
    expect(await findReceiptNumber("evergreen", "100")).toMatchObject({
      templateId: "evergreen",
    });
    expect(await findReceiptNumber("skn", "100")).toMatchObject({ templateId: "skn" });
  });

  it("migrates legacy receipts, revisions, and the current draft to Evergreen", async () => {
    const legacyDb = new Dexie(DATABASE_NAME);
    legacyDb.version(1).stores({
      receipts: "&id, &receiptNumber, date, createdAt, updatedAt, customerName, vehicleNumber",
      settings: "&key",
      drafts: "&key",
    });
    const legacySnapshot = {
      id: "receipt-legacy",
      receiptNumber: "5321",
      date: "2026-08-02",
      paymentMode: "cash",
      customerName: "Ayush",
      vehicleNumber: "PB70AB1234",
      items: [{ ...createLineItem(), quantity: "1", rate: "100" }],
      total: 100,
      profileSnapshot: DEFAULT_PROFILE,
      createdAt: "2026-08-20T00:00:00.000Z",
      updatedAt: "2026-08-20T00:00:00.000Z",
    };
    await legacyDb.table("receipts").put({
      ...legacySnapshot,
      revisions: [
        {
          id: "revision-1",
          reason: "Legacy revision",
          revisedAt: "2026-08-20T00:00:00.000Z",
          previous: legacySnapshot,
        },
      ],
    });
    await legacyDb.table("drafts").put({
      key: "current-draft",
      value: {
        receiptNumber: "draft-1",
        date: "",
        paymentMode: "cash",
        customerName: "",
        vehicleNumber: "",
        items: [createLineItem()],
      },
    });
    legacyDb.close();

    await db.open();
    const receipts = await loadReceipts();
    expect(receipts[0].templateId).toBe("evergreen");
    expect(receipts[0].totalValue).toBe(100);
    expect(receipts[0].revisions[0].previous.templateId).toBe("evergreen");
    expect((await loadDraft("evergreen"))?.value).toMatchObject({
      templateId: "evergreen",
      receiptNumber: "draft-1",
    });
  });
});
