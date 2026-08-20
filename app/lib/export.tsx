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
import { SKN_NATURAL_GAS_LOGO_URL } from "./publicAssets";
import { getReceiptTemplate } from "./templates";

const EXPORT_WIDTH = 1240;

function safeFilename(receipt: Receipt) {
  const number = receipt.receiptNumber.trim().replace(/[^a-z0-9_-]+/gi, "-");
  return `${receipt.templateId}-receipt-${number || "draft"}-${receipt.date || "undated"}`;
}

export function receiptPdfFilename(receipt: Receipt) {
  return `${safeFilename(receipt)}.pdf`;
}

function svgMarkup(receipt: Receipt) {
  return renderToStaticMarkup(<ReceiptSvg receipt={receipt} />);
}

let grayscaleSknLogoPromise: Promise<string> | undefined;

function grayscaleSknLogoDataUrl() {
  grayscaleSknLogoPromise ??= new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Logo rendering is unavailable in this browser."));
        return;
      }
      context.filter = "grayscale(100%) contrast(115%)";
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("The SKN logo could not be loaded for export."));
    image.src = SKN_NATURAL_GAS_LOGO_URL;
  });
  return grayscaleSknLogoPromise;
}

async function exportSvgMarkup(receipt: Receipt) {
  const markup = svgMarkup(receipt);
  if (receipt.templateId !== "skn") return markup;

  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  const logo = parsed.querySelector('[aria-label="SKN Natural Gas logo"]');
  if (!logo) throw new Error("The SKN logo is missing from the receipt template.");
  logo.setAttribute("href", await grayscaleSknLogoDataUrl());
  logo.removeAttribute("style");
  return new XMLSerializer().serializeToString(parsed.documentElement);
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
  const { exportSizeMm } = getReceiptTemplate(receipt.templateId);
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = Math.round(EXPORT_WIDTH * (exportSizeMm.height / exportSizeMm.width));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const renderer = Canvg.fromString(context, await exportSvgMarkup(receipt), {
    ignoreDimensions: true,
    scaleWidth: canvas.width,
    scaleHeight: canvas.height,
  });
  await renderer.render();
  return canvas;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))),
      type,
      quality,
    );
  });
}

export async function exportReceiptImage(receipt: Receipt, format: "png" | "jpeg") {
  const canvas = await renderCanvas(receipt);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob = await canvasBlob(canvas, mime, format === "jpeg" ? 0.95 : undefined);
  downloadBlob(blob, `${safeFilename(receipt)}.${format === "jpeg" ? "jpg" : "png"}`);
}

export async function createReceiptPdfBlob(receipt: Receipt) {
  const { exportSizeMm } = getReceiptTemplate(receipt.templateId);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(await exportSvgMarkup(receipt), "image/svg+xml");
  const svg = parsed.documentElement as unknown as SVGElement;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [exportSizeMm.width, exportSizeMm.height],
    compress: true,
  });
  await svg2pdf(svg, pdf, {
    x: 0,
    y: 0,
    width: exportSizeMm.width,
    height: exportSizeMm.height,
  });
  return pdf.output("blob");
}

export async function exportReceiptPdf(receipt: Receipt) {
  downloadBlob(await createReceiptPdfBlob(receipt), receiptPdfFilename(receipt));
}

export async function exportReceiptDocx(receipt: Receipt) {
  const canvas = await renderCanvas(receipt);
  const png = await canvasBlob(canvas, "image/png");
  const data = new Uint8Array(await png.arrayBuffer());
  const imageWidth = 397;
  const imageHeight = Math.round(imageWidth * (canvas.height / canvas.width));
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
                transformation: { width: imageWidth, height: imageHeight },
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
    `receipts-backup-${date}.json`,
  );
}
