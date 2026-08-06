import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Evergreen Receipt Creator",
    template: "%s · Evergreen Receipt Creator",
  },
  description: "A private, offline receipt book for Evergreen Filling Station.",
  applicationName: "Evergreen Receipts",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Evergreen Receipt Creator",
    description: "Create, save, print, and export filling station receipts - even offline.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Evergreen Receipt Creator" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Evergreen Receipt Creator",
    description: "Create, save, print, and export filling station receipts - even offline.",
    images: ["/og.png"],
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
