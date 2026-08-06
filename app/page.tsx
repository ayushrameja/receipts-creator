import type { Metadata } from "next";
import ReceiptHome from "./components/ReceiptHome";

export const metadata: Metadata = {
  title: "Evergreen Receipt Creator",
  description: "Create, save, print, and export filling station receipts - even offline.",
};

export default function Home() {
  return <ReceiptHome />;
}
