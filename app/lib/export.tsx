"use client";

import { renderToStaticMarkup } from "react-dom/server";
import { Canvg } from "canvg";
import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";
import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  VerticalAlign,
} from "docx";
import type { Receipt } from "../types";
import { ReceiptSvg } from "../components/ReceiptPreview";

const A6_WIDTH_MM = 105;
const A6_HEIGHT_MM = 148;
const EXPORT_WIDTH = 1240;
const EXPORT_HEIGHT = 1748;

function safeFilename(receipt: Receipt) {
  const number = receipt.receiptNumber.trim().replace(/[^a-z0-9_-]+/gi, "-");
  return `receipt-${number || "draft"}-${receipt.date || "undated"}`;
}

function svgMarkup(receipt: Receipt) {
  return renderToStaticMarkup(<ReceiptSvg receipt={receipt} />);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderCanvas(receipt: Receipt) {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const renderer = Canvg.fromString(context, svgMarkup(receipt), {
    ignoreDimensions: true,
    scaleWidth: EXPORT_WIDTH,
    scaleHeight: EXPORT_HEIGHT,
  });
  await renderer.render();
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))), type, quality);
  });
}

export async function exportReceiptImage(receipt: Receipt, format: "png" | "jpeg") {
  const canvas = await renderCanvas(receipt);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob = await canvasBlob(canvas, mime, format === "jpeg" ? 0.95 : undefined);
  downloadBlob(blob, `${safeFilename(receipt)}.${format === "jpeg" ? "jpg" : "png"}`);
}

export async function exportReceiptPdf(receipt: Receipt) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(svgMarkup(receipt), "image/svg+xml");
  const svg = parsed.documentElement as unknown as SVGElement;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [A6_WIDTH_MM, A6_HEIGHT_MM],
    compress: true,
  });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: A6_WIDTH_MM, height: A6_HEIGHT_MM });
  pdf.save(`${safeFilename(receipt)}.pdf`);
}

export async function exportReceiptDocx(receipt: Receipt) {
  const canvas = await renderCanvas(receipt);
  const png = await canvasBlob(canvas, "image/png");
  const data = new Uint8Array(await png.arrayBuffer());
  const documentFile = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
          verticalAlign: VerticalAlign.CENTER,
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data,
                type: "png",
                transformation: { width: 397, height: 559 },
              }),
            ],
          }),
        ],
      },
    ],
  });
  downloadBlob(await Packer.toBlob(documentFile), `${safeFilename(receipt)}.docx`);
}

export function downloadBackupFile(data: unknown) {
  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    `evergreen-receipts-backup-${date}.json`,
  );
}

