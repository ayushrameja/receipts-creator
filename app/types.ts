export type ReceiptTemplateId = "evergreen" | "skn";

export type PaymentMode = "cash" | "credit";

export interface BusinessProfile {
  businessName: string;
  dealerLine: string;
  gstin: string;
  address: string;
  phonePrimary: string;
  phoneSecondary: string;
  taxNote: string;
  footerNote: string;
  logoDataUrl?: string;
}

export interface LineItem {
  id: string;
  particulars: string;
  quantity: string;
  rate: string;
  manualAmount: string;
  useManualAmount: boolean;
}

export interface EvergreenReceiptDraft {
  templateId: "evergreen";
  receiptNumber: string;
  date: string;
  paymentMode: PaymentMode;
  customerName: string;
  vehicleNumber: string;
  items: LineItem[];
}

export interface SknReceiptDraft {
  templateId: "skn";
  receiptNumber: string;
  date: string;
  vehicleNumber: string;
  quantity: string;
  amount: string;
  total: string;
}

export type ReceiptDraft = EvergreenReceiptDraft | SknReceiptDraft;

interface ReceiptMetadata {
  id: string;
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export type EvergreenReceiptSnapshot = EvergreenReceiptDraft &
  ReceiptMetadata & {
    profileSnapshot: BusinessProfile;
  };

export type SknReceiptSnapshot = SknReceiptDraft & ReceiptMetadata;

export type ReceiptSnapshot = EvergreenReceiptSnapshot | SknReceiptSnapshot;

export interface ReceiptRevision {
  id: string;
  reason: string;
  revisedAt: string;
  previous: ReceiptSnapshot;
}

export type Receipt = ReceiptSnapshot & {
  revisions: ReceiptRevision[];
};

export interface AppBackup {
  version: 2;
  exportedAt: string;
  profile: BusinessProfile;
  receipts: Receipt[];
}
