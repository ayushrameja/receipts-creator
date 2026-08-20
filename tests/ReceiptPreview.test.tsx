import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReceiptPreview } from "../app/components/ReceiptPreview";
import { buildReceipt, createEmptyDraft, DEFAULT_PROFILE } from "../app/lib/receipt";
import {
  BHARAT_PETROLEUM_LOGO_URL,
  SKN_NATURAL_GAS_LOGO_URL,
} from "../app/lib/publicAssets";

describe("ReceiptPreview", () => {
  it("renders the Evergreen station, item, and total", () => {
    const draft = createEmptyDraft("evergreen");
    draft.receiptNumber = "5321";
    draft.items[0].quantity = "10";
    draft.items[0].rate = "98.50";
    render(<ReceiptPreview receipt={buildReceipt(draft, DEFAULT_PROFILE)} />);
    expect(screen.getByLabelText("Evergreen live receipt preview")).toBeInTheDocument();
    expect(screen.getByText("EVERGREEN FILLING STATION")).toBeInTheDocument();
    expect(screen.getByText("5321")).toBeInTheDocument();
    expect(screen.getByText("Cash/Credit Memo")).toBeInTheDocument();
    expect(screen.getByText("Petrol (MS)")).toBeInTheDocument();
    expect(screen.getAllByText("985")).toHaveLength(2);
    expect(screen.getByLabelText("Bharat Petroleum logo")).toHaveAttribute(
      "href",
      BHARAT_PETROLEUM_LOGO_URL,
    );
  });

  it("renders a clean empty SKN vector template without source handwriting", () => {
    render(
      <ReceiptPreview receipt={buildReceipt(createEmptyDraft("skn"), DEFAULT_PROFILE)} />,
    );
    expect(screen.getByLabelText("SKN live receipt preview")).toBeInTheDocument();
    expect(screen.getByText("Retail Invoice / Cash Memo")).toBeInTheDocument();
    expect(
      screen.getByText("HARYANA CITY GAS DISTRIBUTION (BHIWADI) LTD."),
    ).toBeInTheDocument();
    expect(screen.getByText("CNG")).toBeInTheDocument();
    const sknLogo = screen.getByLabelText("SKN Natural Gas logo");
    expect(sknLogo).toHaveAttribute(
      "href",
      SKN_NATURAL_GAS_LOGO_URL,
    );
    expect(sknLogo.getAttribute("style")).toContain("grayscale(100%)");
    expect(screen.queryByText("8326")).not.toBeInTheDocument();
    expect(screen.queryByText("56671")).not.toBeInTheDocument();
  });

  it("places SKN manual values while keeping amount and total independent", () => {
    const draft = {
      ...createEmptyDraft("skn"),
      receiptNumber: "8326",
      date: "2026-08-02",
      vehicleNumber: "RJ02AB2585",
      quantity: "6.78",
      amount: "595",
      total: "600",
    };
    render(<ReceiptPreview receipt={buildReceipt(draft, DEFAULT_PROFILE)} />);
    expect(screen.getByText("8326")).toBeInTheDocument();
    expect(screen.getByText("02-08-2026")).toBeInTheDocument();
    expect(screen.getByText("RJ02AB2585")).toBeInTheDocument();
    expect(screen.getByText("6.78")).toBeInTheDocument();
    expect(screen.getAllByText("595")).toHaveLength(1);
    expect(screen.getAllByText("600")).toHaveLength(1);
  });
});
