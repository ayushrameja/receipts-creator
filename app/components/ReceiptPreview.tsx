"use client";

import type { Ref } from "react";
import type { Receipt } from "../types";
import { calculateLineAmount, formatInr } from "../lib/receipt";
import bharatPetroleumLogo from "../assets/bharat-petroleum-monochrome.svg?raw";
import ekOnkarSymbol from "../assets/ek-onkar.png?inline";

const WIDTH = 1050;
const HEIGHT = 1480;
const BHARAT_PETROLEUM_LOGO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bharatPetroleumLogo)}`;
const EK_ONKAR_SYMBOL = ekOnkarSymbol;
const TEMPLATE_PARTICULARS = ["Petrol (MS)", "Lts. H.S.D.", "Lts. M. Oil"];

function displayDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function splitAmount(value: number) {
  const paiseTotal = Math.round(value * 100);
  return {
    rupees: new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.trunc(paiseTotal / 100)),
    paise: String(Math.abs(paiseTotal % 100)).padStart(2, "0"),
  };
}

export function ReceiptSvg({ receipt, svgRef }: { receipt: Receipt; svgRef?: Ref<SVGSVGElement> }) {
  const profile = receipt.profileSnapshot;
  const items = receipt.items.slice(0, 6).map((item) => ({ ...item, isTemplateRow: false }));
  for (const particulars of TEMPLATE_PARTICULARS) {
    if (!items.some((item) => item.particulars.trim().toLocaleLowerCase() === particulars.toLocaleLowerCase())) {
      items.push({
        id: `template-${particulars}`,
        particulars,
        quantity: "",
        rate: "",
        manualAmount: "",
        useManualAmount: false,
        isTemplateRow: true,
      });
    }
  }
  items.splice(6);
  const rowHeight = Math.min(82, 440 / Math.max(items.length, 1));
  const totalAmount = splitAmount(receipt.total);
  const hasTotal = receipt.total !== 0;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width="105mm"
      height="148mm"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Receipt ${receipt.receiptNumber || "preview"}`}
      style={{ background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <defs>
        <clipPath id="receipt-number-clip"><rect x="122" y="365" width="440" height="52" /></clipPath>
        <clipPath id="customer-name-clip"><rect x="155" y="438" width="845" height="48" /></clipPath>
        <clipPath id="vehicle-number-clip"><rect x="238" y="508" width="762" height="48" /></clipPath>
        <clipPath id="particulars-clip"><rect x="62" y="688" width="382" height="492" /></clipPath>
      </defs>
      <rect width={WIDTH} height={HEIGHT} fill="#fff" />
      <rect x="26" y="26" width="998" height="1428" rx="12" fill="none" stroke="#111" strokeWidth="5" />

      <text x="45" y="78" fontSize="29" fontWeight="bold" textLength="390" lengthAdjust="spacingAndGlyphs">GSTIN : {profile.gstin}</text>
      <text x="1008" y="78" fontSize="29" fontWeight="bold" textAnchor="end" textLength="265" lengthAdjust="spacingAndGlyphs">Mob. : {profile.phonePrimary}</text>
      <text x="1008" y="112" fontSize="29" fontWeight="bold" textAnchor="end" textLength="170" lengthAdjust="spacingAndGlyphs">{profile.phoneSecondary}</text>

      <image
        href={profile.logoDataUrl || BHARAT_PETROLEUM_LOGO}
        x="42"
        y="103"
        width="142"
        height="190"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Bharat Petroleum logo"
      />

      <image href={EK_ONKAR_SYMBOL} x="535" y="58" width="70" height="58" preserveAspectRatio="xMidYMid meet" aria-label="Ik Onkar" />

      <text x="570" y="150" textAnchor="middle" fontSize="34" fontWeight="bold" textLength="290" lengthAdjust="spacingAndGlyphs">
        Cash/Credit Memo
      </text>
      <text x="210" y="218" fontSize="52" fontWeight="bold" textLength="780" lengthAdjust="spacingAndGlyphs">
        {profile.businessName}
      </text>
      <text x="612" y="268" textAnchor="middle" fontSize="32" fontWeight="bold" textLength="735" lengthAdjust="spacingAndGlyphs">{profile.dealerLine}</text>
      <text x="612" y="315" textAnchor="middle" fontSize="31" textLength="690" lengthAdjust="spacingAndGlyphs">{profile.address}</text>

      <line x1="45" y1="352" x2="1005" y2="352" stroke="#111" strokeWidth="4" />
      <text x="48" y="404" fontSize="32" fontWeight="bold">No.</text>
      <text x="125" y="404" fontSize="39" fontWeight="bold" clipPath="url(#receipt-number-clip)">{receipt.receiptNumber}</text>
      <text x="590" y="404" fontSize="32" fontWeight="bold">Date</text>
      <text x="680" y="404" fontSize="32">{displayDate(receipt.date)}</text>
      <line x1="675" y1="414" x2="1000" y2="414" stroke="#111" strokeWidth="2" strokeDasharray="5 7" />

      <text x="48" y="474" fontSize="32" fontWeight="bold">Name</text>
      <text x="158" y="474" fontSize="32" clipPath="url(#customer-name-clip)">{receipt.customerName}</text>
      <line x1="155" y1="486" x2="1000" y2="486" stroke="#111" strokeWidth="2" strokeDasharray="5 7" />
      <text x="48" y="544" fontSize="32" fontWeight="bold">Vehicle No.</text>
      <text x="242" y="544" fontSize="32" clipPath="url(#vehicle-number-clip)">{receipt.vehicleNumber.toUpperCase()}</text>
      <line x1="238" y1="556" x2="1000" y2="556" stroke="#111" strokeWidth="2" strokeDasharray="5 7" />

      <line x1="45" y1="592" x2="1005" y2="592" stroke="#111" strokeWidth="6" />
      <line x1="45" y1="680" x2="1005" y2="680" stroke="#111" strokeWidth="4" />
      <line x1="452" y1="592" x2="452" y2="1288" stroke="#111" strokeWidth="4" />
      <line x1="650" y1="592" x2="650" y2="1288" stroke="#111" strokeWidth="4" />
      <line x1="818" y1="592" x2="818" y2="1288" stroke="#111" strokeWidth="4" />
      <line x1="950" y1="680" x2="950" y2="1288" stroke="#111" strokeWidth="4" />
      <text x="248" y="650" textAnchor="middle" fontSize="36" fontWeight="bold">Particulars</text>
      <text x="551" y="650" textAnchor="middle" fontSize="36" fontWeight="bold">Qty.</text>
      <text x="734" y="650" textAnchor="middle" fontSize="36" fontWeight="bold">Rate</text>
      <text x="912" y="630" textAnchor="middle" fontSize="34" fontWeight="bold">Amount</text>
      <text x="884" y="666" textAnchor="middle" fontSize="25" fontWeight="bold">Rs.</text>
      <text x="978" y="666" textAnchor="middle" fontSize="25" fontWeight="bold">P.</text>

      {items.map((item, index) => {
        const y = 742 + index * rowHeight;
        const amount = calculateLineAmount(item);
        const amountParts = splitAmount(amount);
        const hasAmount = item.useManualAmount ? Boolean(item.manualAmount) : Boolean(item.quantity || item.rate);
        return (
          <g key={item.id}>
            <text x="70" y={y} fontSize="31" fontWeight="bold" clipPath="url(#particulars-clip)">{item.particulars || "Item"}</text>
            <text x="551" y={y} textAnchor="middle" fontSize="30">{item.quantity}</text>
            <text x="734" y={y} textAnchor="middle" fontSize="30">{item.rate ? formatInr(Number(item.rate)) : ""}</text>
            <text x="936" y={y} textAnchor="end" fontSize="30">{hasAmount ? amountParts.rupees : ""}</text>
            <text x="978" y={y} textAnchor="middle" fontSize="30">{hasAmount ? amountParts.paise : ""}</text>
          </g>
        );
      })}

      <line x1="650" y1="1188" x2="1005" y2="1188" stroke="#111" strokeWidth="4" />
      <line x1="45" y1="1288" x2="1005" y2="1288" stroke="#111" strokeWidth="5" />
      <text x="70" y="1236" fontSize="27" fontWeight="bold">{profile.taxNote}</text>
      <text x="70" y="1271" fontSize="27" fontWeight="bold">Thank you for your visit</text>
      <text x="734" y="1252" textAnchor="middle" fontSize="35" fontWeight="bold">Total</text>
      <text x="936" y="1252" textAnchor="end" fontSize="34" fontWeight="bold">{hasTotal ? totalAmount.rupees : ""}</text>
      <text x="978" y="1252" textAnchor="middle" fontSize="34" fontWeight="bold">{hasTotal ? totalAmount.paise : ""}</text>

      <text x="55" y="1370" fontSize="28" fontWeight="bold">{profile.footerNote}</text>
      <text x="995" y="1370" textAnchor="end" fontSize="30" fontWeight="bold" textLength="470" lengthAdjust="spacingAndGlyphs">For {profile.businessName}</text>
    </svg>
  );
}

export function ReceiptPreview({ receipt }: { receipt: Receipt }) {
  return (
    <div className="receipt-paper" aria-label="Live receipt preview">
      <ReceiptSvg receipt={receipt} />
    </div>
  );
}
