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

export interface ReceiptDraft {
  receiptNumber: string;
  date: string;
  paymentMode: PaymentMode;
  customerName: string;
  vehicleNumber: string;
  items: LineItem[];
}

export interface ReceiptSnapshot extends ReceiptDraft {
  id: string;
  total: number;
  profileSnapshot: BusinessProfile;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptRevision {
  id: string;
  reason: string;
  revisedAt: string;
  previous: ReceiptSnapshot;
}

export interface Receipt extends ReceiptSnapshot {
  revisions: ReceiptRevision[];
}

export interface AppBackup {
  version: 1;
  exportedAt: string;
  profile: BusinessProfile;
  receipts: Receipt[];
}

