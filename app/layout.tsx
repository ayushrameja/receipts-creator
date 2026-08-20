import type { Metadata, Viewport } from "next";
import "./globals.css";

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(vercelHost ? `https://${vercelHost}` : "http://localhost:3000"),
  title: {
    default: "Receipts",
    template: "%s · Receipts",
  },
  description: "A private, offline receipt book for Evergreen and SKN receipts.",
  applicationName: "Receipts",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Receipts",
    description: "Create, save, and export Evergreen and SKN receipts - even offline.",
    type: "website",
    images: [{ url: "/og.svg", width: 1200, height: 630, alt: "Receipts - Evergreen and SKN" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Receipts",
    description: "Create, save, and export Evergreen and SKN receipts - even offline.",
    images: ["/og.svg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#123d2d",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
