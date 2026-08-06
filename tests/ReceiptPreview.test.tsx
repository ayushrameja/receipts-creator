import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptPreview } from "../app/components/ReceiptPreview";
import { buildReceipt, createEmptyDraft, DEFAULT_PROFILE } from "../app/lib/receipt";

describe("ReceiptPreview", () => {
  it("renders the station, receipt number, item, and total", () => {
    const draft = createEmptyDraft();
    draft.receiptNumber = "5321";
    draft.items[0].quantity = "10";
    draft.items[0].rate = "98.50";
    render(<ReceiptPreview receipt={buildReceipt(draft, DEFAULT_PROFILE)} />);
    expect(screen.getByText("EVERGREEN FILLING STATION")).toBeInTheDocument();
    expect(screen.getByText("5321")).toBeInTheDocument();
    expect(screen.getByText("Cash/Credit Memo")).toBeInTheDocument();
    expect(screen.getByText("Petrol (MS)")).toBeInTheDocument();
    expect(screen.getByText("Lts. H.S.D.")).toBeInTheDocument();
    expect(screen.getByText("Lts. M. Oil")).toBeInTheDocument();
    expect(screen.getAllByText("985")).toHaveLength(2);
    expect(screen.queryByText(/REVISED/)).not.toBeInTheDocument();
  });
});
