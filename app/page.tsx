import type { Metadata } from "next";
import ReceiptHome from "./components/ReceiptHome";

export const metadata: Metadata = {
  title: "Receipts",
  description: "Create, save, and export Evergreen and SKN receipts - even offline.",
};

export default function Home() {
  return <ReceiptHome />;
}
