"use client";

import type { CSSProperties, Ref } from "react";
import type { Receipt } from "../types";
import { calculateLineAmount, formatInr, parseMoney } from "../lib/receipt";
import { getReceiptTemplate } from "../lib/templates";
import {
  BHARAT_PETROLEUM_LOGO_URL,
  SKN_NATURAL_GAS_LOGO_URL,
} from "../lib/publicAssets";
import ekOnkarSymbol from "../assets/ek-onkar.png";

const EVERGREEN_WIDTH = 1050;
const EVERGREEN_HEIGHT = 1480;
const SKN_WIDTH = 1050;
const SKN_HEIGHT = 1320;

function assetUrl(asset: string | { src: string }) {
  return typeof asset === "string" ? asset : asset.src;
}

const EK_ONKAR_SYMBOL = assetUrl(ekOnkarSymbol);
const TEMPLATE_PARTICULARS = ["Petrol (MS)", "Lts. H.S.D.", "Lts. M. Oil"];

function displayEvergreenDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function displaySknDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function splitAmount(value: number) {
  const paiseTotal = Math.round(value * 100);
  return {
    rupees: new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
      Math.trunc(paiseTotal / 100),
    ),
    paise: String(Math.abs(paiseTotal % 100)).padStart(2, "0"),
  };
}

function EvergreenReceiptSvg({
  receipt,
  svgRef,
}: {
  receipt: Extract<Receipt, { templateId: "evergreen" }>;
  svgRef?: Ref<SVGSVGElement>;
}) {
  const profile = receipt.profileSnapshot;
  const items = receipt.items.slice(0, 6).map((item) => ({ ...item, isTemplateRow: false }));
  for (const particulars of TEMPLATE_PARTICULARS) {
    if (
      !items.some(
        (item) =>
          item.particulars.trim().toLocaleLowerCase() === particulars.toLocaleLowerCase(),
      )
    ) {
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
  const totalAmount = splitAmount(receipt.totalValue);
  const hasTotal = receipt.totalValue !== 0;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width="105mm"
      height="148mm"
      viewBox={`0 0 ${EVERGREEN_WIDTH} ${EVERGREEN_HEIGHT}`}
      role="img"
      aria-label={`Evergreen receipt ${receipt.receiptNumber || "preview"}`}
      style={{ background: "#fff", color: "#111", fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <defs>
        <clipPath id="evergreen-receipt-number-clip"><rect x="122" y="365" width="440" height="52" /></clipPath>
        <clipPath id="evergreen-customer-name-clip"><rect x="155" y="438" width="845" height="48" /></clipPath>
        <clipPath id="evergreen-vehicle-number-clip"><rect x="238" y="508" width="762" height="48" /></clipPath>
        <clipPath id="evergreen-particulars-clip"><rect x="62" y="688" width="382" height="492" /></clipPath>
      </defs>
      <rect width={EVERGREEN_WIDTH} height={EVERGREEN_HEIGHT} fill="#fff" />
      <rect x="26" y="26" width="998" height="1428" rx="12" fill="none" stroke="#111" strokeWidth="5" />

      <text x="45" y="78" fontSize="29" fontWeight="bold" textLength="390" lengthAdjust="spacingAndGlyphs">GSTIN : {profile.gstin}</text>
      <text x="1008" y="78" fontSize="29" fontWeight="bold" textAnchor="end" textLength="265" lengthAdjust="spacingAndGlyphs">Mob. : {profile.phonePrimary}</text>
      <text x="1008" y="112" fontSize="29" fontWeight="bold" textAnchor="end" textLength="170" lengthAdjust="spacingAndGlyphs">{profile.phoneSecondary}</text>

      <image
        href={profile.logoDataUrl || BHARAT_PETROLEUM_LOGO_URL}
        x="42"
        y="103"
        width="142"
        height="190"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Bharat Petroleum logo"
      />
      <image href={EK_ONKAR_SYMBOL} x="535" y="58" width="70" height="58" preserveAspectRatio="xMidYMid meet" aria-label="Ik Onkar" />

      <text x="570" y="150" textAnchor="middle" fontSize="34" fontWeight="bold" textLength="290" lengthAdjust="spacingAndGlyphs">Cash/Credit Memo</text>
      <text x="210" y="218" fontSize="52" fontWeight="bold" textLength="780" lengthAdjust="spacingAndGlyphs">{profile.businessName}</text>
      <text x="612" y="268" textAnchor="middle" fontSize="32" fontWeight="bold" textLength="735" lengthAdjust="spacingAndGlyphs">{profile.dealerLine}</text>
      <text x="612" y="315" textAnchor="middle" fontSize="31" textLength="690" lengthAdjust="spacingAndGlyphs">{profile.address}</text>

      <line x1="45" y1="352" x2="1005" y2="352" stroke="#111" strokeWidth="4" />
      <text x="48" y="404" fontSize="32" fontWeight="bold">No.</text>
      <text x="125" y="404" fontSize="39" fontWeight="bold" clipPath="url(#evergreen-receipt-number-clip)">{receipt.receiptNumber}</text>
      <text x="590" y="404" fontSize="32" fontWeight="bold">Date</text>
      <text x="680" y="404" fontSize="32">{displayEvergreenDate(receipt.date)}</text>
      <line x1="675" y1="414" x2="1000" y2="414" stroke="#111" strokeWidth="2" strokeDasharray="5 7" />

      <text x="48" y="474" fontSize="32" fontWeight="bold">Name</text>
      <text x="158" y="474" fontSize="32" clipPath="url(#evergreen-customer-name-clip)">{receipt.customerName}</text>
      <line x1="155" y1="486" x2="1000" y2="486" stroke="#111" strokeWidth="2" strokeDasharray="5 7" />
      <text x="48" y="544" fontSize="32" fontWeight="bold">Vehicle No.</text>
      <text x="242" y="544" fontSize="32" clipPath="url(#evergreen-vehicle-number-clip)">{receipt.vehicleNumber.toUpperCase()}</text>
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
            <text x="70" y={y} fontSize="31" fontWeight="bold" clipPath="url(#evergreen-particulars-clip)">{item.particulars || "Item"}</text>
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

function SknReceiptSvg({
  receipt,
  svgRef,
}: {
  receipt: Extract<Receipt, { templateId: "skn" }>;
  svgRef?: Ref<SVGSVGElement>;
}) {
  const amount = receipt.amount.trim() ? splitAmount(parseMoney(receipt.amount)) : undefined;
  const total = receipt.total.trim() ? splitAmount(parseMoney(receipt.total)) : undefined;
  const ink = "#171117";
  const pen = "#22245f";

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width="105mm"
      height="132mm"
      viewBox={`0 0 ${SKN_WIDTH} ${SKN_HEIGHT}`}
      role="img"
      aria-label={`SKN receipt ${receipt.receiptNumber || "preview"}`}
      style={{ background: "#d77aae", color: ink, fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <defs>
        <clipPath id="skn-number-clip"><rect x="155" y="202" width="370" height="58" /></clipPath>
        <clipPath id="skn-date-clip"><rect x="760" y="202" width="255" height="58" /></clipPath>
        <clipPath id="skn-vehicle-clip"><rect x="235" y="264" width="780" height="55" /></clipPath>
      </defs>
      <rect width={SKN_WIDTH} height={SKN_HEIGHT} fill="#d77aae" />
      <rect x="16" y="16" width="1018" height="1288" fill="none" stroke="#bd6398" strokeWidth="3" />

      <text x="520" y="48" textAnchor="middle" fontSize="27" fontWeight="bold" textDecoration="underline">Retail Invoice / Cash Memo</text>
      <text x="1010" y="48" textAnchor="end" fontSize="22" fontWeight="bold">Tin No. 06561826351</text>
      <image
        href={SKN_NATURAL_GAS_LOGO_URL}
        x="55"
        y="78"
        width="350"
        height="119"
        preserveAspectRatio="xMidYMid meet"
        aria-label="SKN Natural Gas logo"
        style={{ filter: "grayscale(100%) contrast(115%)" }}
      />
      <text x="430" y="110" fontSize="22" fontWeight="bold" letterSpacing="-0.4">HARYANA CITY GAS DISTRIBUTION (BHIWADI) LTD.</text>
      <text x="432" y="158" fontSize="18" fontWeight="bold">YGP CNG Station, Alwar by pass Road, Bhiwadi, Rajasthan-301019</text>

      <text x="38" y="244" fontSize="31" fontWeight="bold">No.</text>
      <line x1="135" y1="253" x2="660" y2="253" stroke={ink} strokeWidth="3" />
      <text x="692" y="244" fontSize="31" fontWeight="bold">Date</text>
      <line x1="760" y1="253" x2="1017" y2="253" stroke={ink} strokeWidth="3" strokeDasharray="4 7" />
      <text x="160" y="242" fontSize="43" fontWeight="bold" fill={pen} clipPath="url(#skn-number-clip)">{receipt.receiptNumber}</text>
      <text x="768" y="242" fontSize="35" fill={pen} clipPath="url(#skn-date-clip)">{displaySknDate(receipt.date)}</text>

      <text x="38" y="302" fontSize="31" fontWeight="bold">Vehicle No.</text>
      <line x1="235" y1="312" x2="1017" y2="312" stroke={ink} strokeWidth="3" />
      <text x="245" y="301" fontSize="36" fill={pen} clipPath="url(#skn-vehicle-clip)">{receipt.vehicleNumber.toUpperCase()}</text>

      <line x1="25" y1="336" x2="1025" y2="336" stroke={ink} strokeWidth="5" />
      <line x1="25" y1="405" x2="1025" y2="405" stroke={ink} strokeWidth="4" />
      <line x1="25" y1="1110" x2="1025" y2="1110" stroke={ink} strokeWidth="5" />
      <line x1="25" y1="1179" x2="1025" y2="1179" stroke={ink} strokeWidth="4" />
      <line x1="205" y1="336" x2="205" y2="1179" stroke={ink} strokeWidth="4" />
      <line x1="610" y1="336" x2="610" y2="1110" stroke={ink} strokeWidth="4" />
      <line x1="720" y1="336" x2="720" y2="1179" stroke={ink} strokeWidth="4" />
      <line x1="940" y1="405" x2="940" y2="1179" stroke={ink} strokeWidth="4" />

      <text x="115" y="383" textAnchor="middle" fontSize="31" fontWeight="bold">Qty.</text>
      <text x="407" y="383" textAnchor="middle" fontSize="31" fontWeight="bold">Description</text>
      <text x="665" y="383" textAnchor="middle" fontSize="31" fontWeight="bold">Per</text>
      <text x="855" y="370" textAnchor="middle" fontSize="31" fontWeight="bold">Amount</text>
      <text x="795" y="399" textAnchor="middle" fontSize="24" fontWeight="bold">Rs.</text>
      <text x="980" y="399" textAnchor="middle" fontSize="24" fontWeight="bold">P.</text>
      <text x="407" y="505" textAnchor="middle" fontSize="39" fontWeight="bold" fontStyle="italic">CNG</text>

      <text x="115" y="585" textAnchor="middle" fontSize="43" fill={pen}>{receipt.quantity}</text>
      <text x="920" y="585" textAnchor="end" fontSize="43" fill={pen}>{amount?.rupees ?? ""}</text>
      <text x="980" y="585" textAnchor="middle" fontSize="38" fill={pen}>{amount?.paise ?? ""}</text>

      <text x="475" y="1155" textAnchor="middle" fontSize="34" fontWeight="bold">Total Amount</text>
      <text x="920" y="1155" textAnchor="end" fontSize="43" fill={pen}>{total?.rupees ?? ""}</text>
      <text x="980" y="1155" textAnchor="middle" fontSize="38" fill={pen}>{total?.paise ?? ""}</text>

      <text x="42" y="1222" fontSize="25" fontWeight="bold">E. &amp; O.E.</text>
      <text x="525" y="1235" textAnchor="middle" fontSize="34" fontWeight="bold">Save CNG</text>
      <line x1="790" y1="1263" x2="1010" y2="1263" stroke={ink} strokeWidth="3" />
      <text x="900" y="1257" textAnchor="middle" fontSize="27" fontWeight="bold">Signature</text>
    </svg>
  );
}

export function ReceiptSvg({ receipt, svgRef }: { receipt: Receipt; svgRef?: Ref<SVGSVGElement> }) {
  return receipt.templateId === "skn" ? (
    <SknReceiptSvg receipt={receipt} svgRef={svgRef} />
  ) : (
    <EvergreenReceiptSvg receipt={receipt} svgRef={svgRef} />
  );
}

type ReceiptPaperStyle = CSSProperties & {
  "--receipt-width-mm": string;
  "--receipt-height-mm": string;
};

export function ReceiptPreview({ receipt }: { receipt: Receipt }) {
  const { exportSizeMm } = getReceiptTemplate(receipt.templateId);
  const style: ReceiptPaperStyle = {
    aspectRatio: `${exportSizeMm.width} / ${exportSizeMm.height}`,
    "--receipt-width-mm": `${exportSizeMm.width}mm`,
    "--receipt-height-mm": `${exportSizeMm.height}mm`,
  };
  return (
    <div
      className="receipt-paper"
      data-template={receipt.templateId}
      aria-label={`${receipt.templateId === "skn" ? "SKN" : "Evergreen"} live receipt preview`}
      style={style}
    >
      <ReceiptSvg receipt={receipt} />
    </div>
  );
}
