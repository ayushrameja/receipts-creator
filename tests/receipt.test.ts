import { describe, expect, it } from "vitest";
import {
  buildReceipt,
  calculateLineAmount,
  calculateTotal,
  createEmptyDraft,
  createLineItem,
  DEFAULT_PROFILE,
  matchesReceipt,
  validateDraft,
} from "../app/lib/receipt";

describe("receipt calculations", () => {
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

  it("sums mixed line items", () => {
    const items = [
      { ...createLineItem("Petrol (MS)"), quantity: "2", rate: "100" },
      { ...createLineItem("M. Oil"), manualAmount: "99.99", useManualAmount: true },
    ];
    expect(calculateTotal(items)).toBe(299.99);
  });
});

describe("receipt validation and revision", () => {
  it("requires a number, date, and a complete item", () => {
    const errors = validateDraft({ ...createEmptyDraft(), receiptNumber: "", date: "" });
    expect(errors).toHaveLength(3);
  });

  it("keeps the previous snapshot when revising", () => {
    const draft = createEmptyDraft();
    draft.receiptNumber = "5321";
    draft.items[0].quantity = "10";
    draft.items[0].rate = "100";
    const original = buildReceipt(draft, DEFAULT_PROFILE);
    const revised = buildReceipt({ ...draft, vehicleNumber: "PB70AB1234" }, DEFAULT_PROFILE, original, "Added vehicle");
    expect(revised.revisions).toHaveLength(1);
    expect(revised.revisions[0].reason).toBe("Added vehicle");
    expect(revised.revisions[0].previous.vehicleNumber).toBe("");
    expect(revised.profileSnapshot).toEqual(original.profileSnapshot);
  });

  it("searches number, customer, vehicle, and date", () => {
    const draft = createEmptyDraft();
    draft.receiptNumber = "5321";
    draft.customerName = "Ayush";
    draft.vehicleNumber = "PB70AB1234";
    draft.items[0].quantity = "1";
    draft.items[0].rate = "100";
    const receipt = buildReceipt(draft, DEFAULT_PROFILE);
    expect(matchesReceipt(receipt, "ayush")).toBe(true);
    expect(matchesReceipt(receipt, "PB70")).toBe(true);
    expect(matchesReceipt(receipt, "not-there")).toBe(false);
  });
});

