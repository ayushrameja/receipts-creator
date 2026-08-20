import { describe, expect, it } from "vitest";
import {
  backupSchema,
  buildReceipt,
  calculateDraftTotal,
  calculateLineAmount,
  calculateTotal,
  createEmptyDraft,
  createLineItem,
  DEFAULT_PROFILE,
  matchesReceipt,
  validateDraft,
} from "../app/lib/receipt";
import { receiptPdfFilename } from "../app/lib/export";

describe("receipt draft factories and calculations", () => {
  it("creates independent empty drafts for both templates", () => {
    const evergreen = createEmptyDraft("evergreen");
    const skn = createEmptyDraft("skn");
    expect(evergreen.templateId).toBe("evergreen");
    expect(evergreen.date).toBe("");
    expect(evergreen.items).toHaveLength(3);
    expect(skn).toEqual({
      templateId: "skn",
      receiptNumber: "",
      date: "",
      vehicleNumber: "",
      quantity: "",
      amount: "",
      total: "",
    });
  });

  it("multiplies quantity and rate with currency rounding", () => {
    const item = { ...createLineItem(), quantity: "12.345", rate: "96.78" };
    expect(calculateLineAmount(item)).toBe(1194.75);
  });

  it("uses a manual amount when enabled", () => {
    const item = {
      ...createLineItem(),
      quantity: "10",
      rate: "100",
      manualAmount: "975.555",
      useManualAmount: true,
    };
    expect(calculateLineAmount(item)).toBe(975.56);
  });

  it("sums Evergreen items and uses SKN total with amount fallback", () => {
    const items = [
      { ...createLineItem("Petrol (MS)"), quantity: "2", rate: "100" },
      { ...createLineItem("M. Oil"), manualAmount: "99.99", useManualAmount: true },
    ];
    expect(calculateTotal(items)).toBe(299.99);
    expect(calculateDraftTotal({ ...createEmptyDraft("skn"), amount: "595" })).toBe(595);
    expect(
      calculateDraftTotal({ ...createEmptyDraft("skn"), amount: "595", total: "600" }),
    ).toBe(600);
  });
});

describe("receipt validation, history, and revision", () => {
  it("requires the template-specific core fields only when saving", () => {
    expect(validateDraft(createEmptyDraft("evergreen"))).toEqual([
      "Receipt number is required.",
      "Receipt date is required.",
      "Add at least one complete line item.",
    ]);
    expect(validateDraft(createEmptyDraft("skn"))).toEqual([
      "Receipt number is required.",
      "Receipt date is required.",
      "Enter a positive SKN amount.",
    ]);
    expect(
      validateDraft({
        ...createEmptyDraft("skn"),
        receiptNumber: "8326",
        date: "2026-08-02",
        amount: "595",
      }),
    ).toEqual([]);
  });

  it("keeps the previous template snapshot when revising", () => {
    const draft = createEmptyDraft("evergreen");
    draft.receiptNumber = "5321";
    draft.date = "2026-08-02";
    draft.items[0].quantity = "10";
    draft.items[0].rate = "100";
    const original = buildReceipt(draft, DEFAULT_PROFILE);
    const revised = buildReceipt(
      { ...draft, vehicleNumber: "PB70AB1234" },
      DEFAULT_PROFILE,
      original,
      "Added vehicle",
    );
    expect(revised.revisions).toHaveLength(1);
    expect(revised.revisions[0].reason).toBe("Added vehicle");
    expect(revised.revisions[0].previous.vehicleNumber).toBe("");
    expect(revised.templateId).toBe("evergreen");
    if (revised.templateId === "evergreen" && original.templateId === "evergreen") {
      expect(revised.profileSnapshot).toEqual(original.profileSnapshot);
    }
  });

  it("searches shared template-specific metadata", () => {
    const evergreenDraft = createEmptyDraft("evergreen");
    evergreenDraft.receiptNumber = "5321";
    evergreenDraft.customerName = "Ayush";
    evergreenDraft.vehicleNumber = "PB70AB1234";
    evergreenDraft.items[0].quantity = "1";
    evergreenDraft.items[0].rate = "100";
    const evergreen = buildReceipt(evergreenDraft, DEFAULT_PROFILE);
    const skn = buildReceipt(
      {
        ...createEmptyDraft("skn"),
        receiptNumber: "8326",
        vehicleNumber: "RJ02AB2585",
        amount: "595",
      },
      DEFAULT_PROFILE,
    );
    expect(matchesReceipt(evergreen, "ayush")).toBe(true);
    expect(matchesReceipt(evergreen, "evergreen")).toBe(true);
    expect(matchesReceipt(skn, "CNG")).toBe(true);
    expect(matchesReceipt(skn, "RJ02")).toBe(true);
    expect(matchesReceipt(skn, "not-there")).toBe(false);
  });

  it("prefixes export names with the receipt template", () => {
    const skn = buildReceipt(
      { ...createEmptyDraft("skn"), receiptNumber: "8326", date: "2026-08-02" },
      DEFAULT_PROFILE,
    );
    expect(receiptPdfFilename(skn)).toBe("skn-receipt-8326-2026-08-02.pdf");
  });
});

describe("backup compatibility", () => {
  it("migrates a version 1 Evergreen backup to version 2", () => {
    const legacy = {
      version: 1,
      exportedAt: "2026-08-20T00:00:00.000Z",
      profile: DEFAULT_PROFILE,
      receipts: [
        {
          receiptNumber: "5321",
          date: "2026-08-02",
          paymentMode: "cash",
          customerName: "Ayush",
          vehicleNumber: "PB70AB1234",
          items: [{ ...createLineItem(), quantity: "1", rate: "100" }],
          id: "receipt-1",
          total: 100,
          profileSnapshot: DEFAULT_PROFILE,
          createdAt: "2026-08-20T00:00:00.000Z",
          updatedAt: "2026-08-20T00:00:00.000Z",
          revisions: [],
        },
      ],
    };
    const migrated = backupSchema.parse(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.receipts[0].templateId).toBe("evergreen");
    expect(migrated.receipts[0].totalValue).toBe(100);
  });
});
