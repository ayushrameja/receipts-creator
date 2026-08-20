"use client";

import {
  Archive,
  Check,
  Copy,
  Download,
  History,
  Menu,
  MonitorDown,
  PencilLine,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BusinessProfile,
  EvergreenReceiptDraft,
  LineItem,
  Receipt,
  ReceiptDraft,
  ReceiptTemplateId,
  SknReceiptDraft,
} from "../types";
import {
  buildReceipt,
  calculateDraftTotal,
  calculateTotal,
  createEmptyDraft,
  createLineItem,
  createPreviewReceipt,
  DEFAULT_PROFILE,
  draftFromReceipt,
  formatInr,
  matchesReceipt,
  PRODUCT_SUGGESTIONS,
} from "../lib/receipt";
import {
  createBackup,
  deleteReceipt,
  findReceiptNumber,
  loadActiveTemplate,
  loadDraft,
  loadProfile,
  loadReceipts,
  restoreBackup,
  saveActiveTemplate,
  saveDraft,
  saveProfile,
  saveReceipt,
} from "../lib/storage";
import {
  createReceiptPdfBlob,
  downloadBackupFile,
  exportReceiptPdf,
  receiptPdfFilename,
} from "../lib/export";
import {
  getReceiptTemplate,
  RECEIPT_TEMPLATE_IDS,
  RECEIPT_TEMPLATES,
} from "../lib/templates";
import { BHARAT_PETROLEUM_LOGO_URL } from "../lib/publicAssets";
import { ReceiptPreview } from "./ReceiptPreview";

type DrawerView = "edit" | "history" | "settings";
type HistoryFilter = "all" | ReceiptTemplateId;
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface DraftMap {
  evergreen: EvergreenReceiptDraft;
  skn: SknReceiptDraft;
}

type EditingMap = Partial<Record<ReceiptTemplateId, string>>;

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field field-wide" : "field"}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function LogoMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <ReceiptText size={23} strokeWidth={2.4} />
    </span>
  );
}

function TemplateSwitcher({
  activeTemplateId,
  onChange,
  className = "",
}: {
  activeTemplateId: ReceiptTemplateId;
  onChange: (templateId: ReceiptTemplateId) => void;
  className?: string;
}) {
  return (
    <div className={`template-switcher ${className}`.trim()} aria-label="Receipt template">
      {RECEIPT_TEMPLATE_IDS.map((templateId) => (
        <button
          key={templateId}
          type="button"
          className={activeTemplateId === templateId ? "active" : ""}
          onClick={() => onChange(templateId)}
          aria-pressed={activeTemplateId === templateId}
          aria-label={`Use ${RECEIPT_TEMPLATES[templateId].label} receipt template`}
        >
          {RECEIPT_TEMPLATES[templateId].label}
        </button>
      ))}
    </div>
  );
}

function EvergreenForm({
  draft,
  onChange,
}: {
  draft: EvergreenReceiptDraft;
  onChange: (draft: EvergreenReceiptDraft) => void;
}) {
  function update<K extends keyof EvergreenReceiptDraft>(key: K, value: EvergreenReceiptDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    update(
      "items",
      draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  return (
    <>
      <div className="form-section">
        <div className="section-title"><span>01</span><div><h2>Receipt details</h2><p>Leave optional details blank when they are not needed.</p></div></div>
        <div className="form-grid">
          <Field label="Receipt number"><input value={draft.receiptNumber} onChange={(event) => update("receiptNumber", event.target.value)} placeholder="Required to save" /></Field>
          <Field label="Date"><input type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} /></Field>
          <Field label="Memo type"><div className="segmented"><button className={draft.paymentMode === "cash" ? "active" : ""} onClick={() => update("paymentMode", "cash")} type="button">Cash</button><button className={draft.paymentMode === "credit" ? "active" : ""} onClick={() => update("paymentMode", "credit")} type="button">Credit</button></div></Field>
          <Field label="Customer name"><input value={draft.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="Optional" /></Field>
          <Field label="Vehicle number" wide><input value={draft.vehicleNumber} onChange={(event) => update("vehicleNumber", event.target.value.toUpperCase())} placeholder="Optional" /></Field>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title line-title"><span>02</span><div><h2>Products</h2><p>Amounts calculate automatically.</p></div><button className="button ghost small" type="button" disabled={draft.items.length >= 6} onClick={() => update("items", [...draft.items, createLineItem("")])}><Plus size={16} /> Add row</button></div>
        <div className="items-list">
          {draft.items.map((item, index) => (
            <article className="item-card" key={item.id}>
              <div className="item-number">{String(index + 1).padStart(2, "0")}</div>
              <Field label="Particulars" wide><input list="product-suggestions" value={item.particulars} onChange={(event) => updateItem(item.id, { particulars: event.target.value })} /></Field>
              <Field label="Quantity"><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} placeholder="0.00" /></Field>
              <Field label="Rate (₹)"><input inputMode="decimal" value={item.rate} onChange={(event) => updateItem(item.id, { rate: event.target.value })} placeholder="0.00" /></Field>
              <Field label="Amount (₹)"><input inputMode="decimal" value={item.useManualAmount ? item.manualAmount : formatInr(Number(item.quantity || 0) * Number(item.rate || 0))} onChange={(event) => updateItem(item.id, { manualAmount: event.target.value, useManualAmount: true })} readOnly={!item.useManualAmount} aria-label={`Amount for ${item.particulars || `item ${index + 1}`}`} /></Field>
              <label className="override-check"><input type="checkbox" checked={item.useManualAmount} onChange={(event) => updateItem(item.id, { useManualAmount: event.target.checked })} />Manual</label>
              <button className="icon-button remove-item" type="button" onClick={() => update("items", draft.items.filter((entry) => entry.id !== item.id))} disabled={draft.items.length === 1} aria-label={`Remove item ${index + 1}`}><Trash2 size={17} /></button>
            </article>
          ))}
        </div>
        <datalist id="product-suggestions">{PRODUCT_SUGGESTIONS.map((product) => <option key={product} value={product} />)}</datalist>
        <div className="total-strip"><span>Receipt total</span><strong>₹{formatInr(calculateTotal(draft.items))}</strong></div>
      </div>
    </>
  );
}

function SknForm({
  draft,
  onChange,
}: {
  draft: SknReceiptDraft;
  onChange: (draft: SknReceiptDraft) => void;
}) {
  function update<K extends keyof SknReceiptDraft>(key: K, value: SknReceiptDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <>
      <div className="form-section">
        <div className="section-title"><span>01</span><div><h2>SKN memo details</h2><p>Only values that would be written by hand are editable.</p></div></div>
        <div className="form-grid">
          <Field label="Receipt number"><input value={draft.receiptNumber} onChange={(event) => update("receiptNumber", event.target.value)} placeholder="Required to save" /></Field>
          <Field label="Date"><input type="date" value={draft.date} onChange={(event) => update("date", event.target.value)} /></Field>
          <Field label="Vehicle number" wide><input value={draft.vehicleNumber} onChange={(event) => update("vehicleNumber", event.target.value.toUpperCase())} placeholder="Optional" /></Field>
        </div>
      </div>

      <div className="form-section">
        <div className="section-title"><span>02</span><div><h2>CNG values</h2><p>Amount and total stay independent, matching the paper memo.</p></div></div>
        <div className="form-grid">
          <Field label="Quantity"><input inputMode="decimal" value={draft.quantity} onChange={(event) => update("quantity", event.target.value)} placeholder="0.00" /></Field>
          <Field label="Amount (₹)"><input inputMode="decimal" value={draft.amount} onChange={(event) => update("amount", event.target.value)} placeholder="Required to save" /></Field>
          <Field label="Total amount (₹)" wide hint="Leave blank to keep the printed total line empty."><input inputMode="decimal" value={draft.total} onChange={(event) => update("total", event.target.value)} placeholder="Optional" /></Field>
        </div>
        <div className="total-strip"><span>History value</span><strong>₹{formatInr(calculateDraftTotal(draft))}</strong></div>
      </div>
    </>
  );
}

function historyDescription(receipt: Receipt) {
  if (receipt.templateId === "skn") {
    return `${receipt.vehicleNumber || "No vehicle"} · CNG`;
  }
  return receipt.customerName || receipt.vehicleNumber || "Unnamed Evergreen receipt";
}

export default function ReceiptHome() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>("edit");
  const [activeTemplateId, setActiveTemplateId] = useState<ReceiptTemplateId>("evergreen");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileForm, setProfileForm] = useState<BusinessProfile | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [drafts, setDrafts] = useState<DraftMap>({
    evergreen: createEmptyDraft("evergreen"),
    skn: createEmptyDraft("skn"),
  });
  const [editingIds, setEditingIds] = useState<EditingMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [showRevision, setShowRevision] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const restoreInput = useRef<HTMLInputElement>(null);

  const activeDraft = drafts[activeTemplateId];
  const editingId = editingIds[activeTemplateId];
  const activeTemplate = getReceiptTemplate(activeTemplateId);
  const refreshReceipts = useCallback(async () => setReceipts(await loadReceipts()), []);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadProfile(),
      loadReceipts(),
      loadDraft("evergreen"),
      loadDraft("skn"),
      loadActiveTemplate(),
    ]).then(([storedProfile, storedReceipts, evergreenDraft, sknDraft, storedTemplate]) => {
      if (!active) return;
      setProfile(storedProfile);
      setProfileForm(structuredClone(storedProfile));
      setReceipts(storedReceipts);
      setDrafts({
        evergreen:
          evergreenDraft?.value.templateId === "evergreen"
            ? evergreenDraft.value
            : createEmptyDraft("evergreen"),
        skn:
          sknDraft?.value.templateId === "skn" ? sknDraft.value : createEmptyDraft("skn"),
      });
      setEditingIds({
        evergreen: evergreenDraft?.editingId,
        skn: sknDraft?.editingId,
      });
      setActiveTemplateId(storedTemplate);
      setHydrated(true);
    });

    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      void Promise.all([
        saveDraft(drafts.evergreen, editingIds.evergreen),
        saveDraft(drafts.skn, editingIds.skn),
      ]);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [drafts, editingIds, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    void saveActiveTemplate(activeTemplateId);
  }, [activeTemplateId, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  const editingReceipt = useMemo(
    () => receipts.find((receipt) => receipt.id === editingId),
    [receipts, editingId],
  );

  const previewReceipt = useMemo(
    () => createPreviewReceipt(activeDraft, profile ?? DEFAULT_PROFILE, editingReceipt),
    [activeDraft, editingReceipt, profile],
  );

  const filteredReceipts = useMemo(
    () =>
      receipts.filter(
        (receipt) =>
          (historyFilter === "all" || receipt.templateId === historyFilter) &&
          matchesReceipt(receipt, search),
      ),
    [receipts, search, historyFilter],
  );

  function setActiveDraft(nextDraft: ReceiptDraft) {
    if (nextDraft.templateId === "evergreen") {
      setDrafts((current) => ({ ...current, evergreen: nextDraft }));
    } else {
      setDrafts((current) => ({ ...current, skn: nextDraft }));
    }
    setErrors([]);
  }

  function selectTemplate(templateId: ReceiptTemplateId) {
    setActiveTemplateId(templateId);
    setErrors([]);
    setShowRevision(false);
  }

  function openDrawer(view: DrawerView) {
    setDrawerView(view);
    setDrawerOpen(true);
    setErrors([]);
  }

  function resetTemplateDraft(templateId: ReceiptTemplateId) {
    const nextDraft = getReceiptTemplate(templateId).createDraft();
    if (nextDraft.templateId === "evergreen") {
      setDrafts((current) => ({ ...current, evergreen: nextDraft }));
    } else {
      setDrafts((current) => ({ ...current, skn: nextDraft }));
    }
    setEditingIds((current) => ({ ...current, [templateId]: undefined }));
  }

  function startNew() {
    resetTemplateDraft(activeTemplateId);
    setErrors([]);
    setDrawerView("edit");
    setRevisionReason("");
    setShowRevision(false);
  }

  function openReceipt(receipt: Receipt) {
    const draft = draftFromReceipt(receipt);
    if (draft.templateId === "evergreen") {
      setDrafts((current) => ({ ...current, evergreen: draft }));
    } else {
      setDrafts((current) => ({ ...current, skn: draft }));
    }
    setEditingIds((current) => ({ ...current, [receipt.templateId]: receipt.id }));
    setActiveTemplateId(receipt.templateId);
    setDrawerView("edit");
    setErrors([]);
    setDrawerOpen(false);
    setNotice(`${RECEIPT_TEMPLATES[receipt.templateId].label} receipt ${receipt.receiptNumber || "draft"} opened.`);
  }

  function duplicateReceipt(receipt: Receipt) {
    const copy = { ...draftFromReceipt(receipt), receiptNumber: "", date: "" } as ReceiptDraft;
    if (copy.templateId === "evergreen") {
      setDrafts((current) => ({ ...current, evergreen: copy }));
    } else {
      setDrafts((current) => ({ ...current, skn: copy }));
    }
    setEditingIds((current) => ({ ...current, [receipt.templateId]: undefined }));
    setActiveTemplateId(receipt.templateId);
    setErrors([]);
    setDrawerView("edit");
    setNotice("Blank copy ready. Add a new number and date before saving.");
  }

  async function persistReceipt(reason?: string) {
    if (!profile) return;
    const validation = activeTemplate.validate(activeDraft);
    if (validation.length) {
      setErrors(validation);
      setDrawerView("edit");
      setDrawerOpen(true);
      return;
    }
    const duplicate = await findReceiptNumber(activeDraft.templateId, activeDraft.receiptNumber);
    if (duplicate && duplicate.id !== editingId) {
      setErrors([
        `${activeTemplate.label} receipt number ${activeDraft.receiptNumber} already exists.`,
      ]);
      setDrawerView("edit");
      setDrawerOpen(true);
      return;
    }
    if (editingReceipt && !reason) {
      setShowRevision(true);
      return;
    }
    setBusy("Saving receipt");
    try {
      const saved = buildReceipt(
        activeDraft,
        editingReceipt?.templateId === "evergreen" ? editingReceipt.profileSnapshot : profile,
        editingReceipt,
        reason,
      );
      await saveReceipt(saved);
      await refreshReceipts();
      setEditingIds((current) => ({ ...current, [saved.templateId]: saved.id }));
      setActiveDraft(draftFromReceipt(saved));
      setShowRevision(false);
      setRevisionReason("");
      setNotice(editingReceipt ? "Revision saved." : "Receipt saved on this device.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The receipt could not be saved."]);
      setDrawerOpen(true);
    } finally {
      setBusy("");
    }
  }

  async function downloadPdf(receipt = previewReceipt) {
    setBusy("Preparing PDF");
    try {
      await exportReceiptPdf(receipt);
      setNotice("PDF downloaded.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The PDF could not be created."]);
      setDrawerOpen(true);
    } finally {
      setBusy("");
    }
  }

  async function sharePdf() {
    setBusy("Preparing share");
    try {
      const blob = await createReceiptPdfBlob(previewReceipt);
      const file = new File([blob], receiptPdfFilename(previewReceipt), { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${activeTemplate.label} receipt`,
          text: `${activeTemplate.label} receipt created in Receipts`,
        });
        setNotice("Receipt shared.");
      } else {
        await exportReceiptPdf(previewReceipt);
        setNotice("PDF downloaded. Share it from your Downloads folder.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrors([error instanceof Error ? error.message : "The receipt could not be shared."]);
      setDrawerOpen(true);
    } finally {
      setBusy("");
    }
  }

  async function removeReceipt(receipt: Receipt) {
    if (!window.confirm(`Delete ${RECEIPT_TEMPLATES[receipt.templateId].label} receipt ${receipt.receiptNumber}? This cannot be undone.`)) return;
    await deleteReceipt(receipt.id);
    if (editingIds[receipt.templateId] === receipt.id) resetTemplateDraft(receipt.templateId);
    await refreshReceipts();
    setNotice("Receipt deleted.");
  }

  async function saveBusinessProfile() {
    if (!profileForm) return;
    if (!profileForm.businessName.trim() || !profileForm.gstin.trim()) {
      setErrors(["Business name and GSTIN are required."]);
      return;
    }
    await saveProfile(profileForm);
    setProfile(structuredClone(profileForm));
    setNotice("Evergreen settings saved.");
  }

  async function handleLogo(file?: File) {
    if (!file || !profileForm) return;
    if (!file.type.startsWith("image/") || file.size > 1_500_000) {
      setErrors(["Choose a PNG, JPEG, or SVG logo smaller than 1.5 MB."]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileForm({ ...profileForm, logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function backupAll() {
    downloadBackupFile(await createBackup());
    setNotice("Backup downloaded.");
  }

  async function restoreAll(file?: File) {
    if (!file) return;
    if (!window.confirm("Replace all receipts and settings on this device with this backup?")) return;
    try {
      const backup = await restoreBackup(JSON.parse(await file.text()));
      setProfile(backup.profile);
      setProfileForm(structuredClone(backup.profile));
      await refreshReceipts();
      setDrafts({ evergreen: createEmptyDraft("evergreen"), skn: createEmptyDraft("skn") });
      setEditingIds({});
      setActiveTemplateId("evergreen");
      setDrawerView("edit");
      setNotice(`Restored ${backup.receipts.length} receipt${backup.receipts.length === 1 ? "" : "s"}.`);
    } catch {
      setErrors(["That file is not a valid Receipts backup."]);
    } finally {
      if (restoreInput.current) restoreInput.current.value = "";
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setNotice("App installed. It will keep working offline.");
    setInstallPrompt(undefined);
  }

  if (!hydrated || !profile || !profileForm) {
    return (
      <main className="loading-screen">
        <LogoMark />
        <p>Opening your receipts…</p>
      </main>
    );
  }

  return (
    <main className="app-shell receipt-home">
      {notice && <div className="toast no-print" role="status"><Check size={18} /> {notice}</div>}
      {busy && <div className="busy-bar no-print"><span />{busy}…</div>}

      <section className="receipt-stage">
        <header className="stage-toolbar no-print">
          <button className="icon-button stage-menu" onClick={() => setDrawerOpen(true)} aria-label="Open receipt controls"><Menu size={21} /></button>
          <TemplateSwitcher activeTemplateId={activeTemplateId} onChange={selectTemplate} />
          <div className="stage-actions">
            <button className="icon-button stage-download" title="Download PDF" aria-label="Download PDF" onClick={() => void downloadPdf()} disabled={Boolean(busy)}><Download size={18} /></button>
            <button className="button primary" aria-label="Share receipt" onClick={() => void sharePdf()} disabled={Boolean(busy)}><Share2 size={18} /><span>Share</span></button>
          </div>
        </header>

        <div className="stage-preview"><ReceiptPreview receipt={previewReceipt} /></div>
        <p className="stage-autosave no-print"><ShieldCheck size={15} /> {activeTemplate.label} draft saves automatically on this device</p>
      </section>

      {drawerOpen && (
        <>
          <button className="drawer-scrim no-print" onClick={() => setDrawerOpen(false)} aria-label="Close receipt controls" />
          <aside className="side-drawer no-print" aria-label="Receipt controls">
            <header className="drawer-header">
              <div className="stage-brand"><LogoMark /><span><strong>Receipts</strong><small>Offline creator</small></span></div>
              <button className="icon-button" onClick={() => setDrawerOpen(false)} aria-label="Close receipt controls"><X size={20} /></button>
            </header>
            <TemplateSwitcher activeTemplateId={activeTemplateId} onChange={selectTemplate} className="drawer-template-switcher" />

            <nav className="drawer-nav" aria-label="Receipt sections">
              <button className={drawerView === "edit" ? "active" : ""} onClick={() => openDrawer("edit")}><PencilLine size={17} /> Edit</button>
              <button className={drawerView === "history" ? "active" : ""} onClick={() => openDrawer("history")}><History size={17} /> History <span>{receipts.length}</span></button>
              <button className={drawerView === "settings" ? "active" : ""} onClick={() => openDrawer("settings")}><Settings size={17} /> Settings</button>
            </nav>

            <div className="drawer-scroll">
              {errors.length > 0 && <div className="error-box" role="alert"><strong>Please check this</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

              {drawerView === "edit" && (
                <section className="drawer-section">
                  <div className="drawer-title"><div><span className="eyebrow">{editingReceipt ? "Saved receipt" : "Autosaved draft"}</span><h1>{editingReceipt ? `Edit ${activeTemplate.label} ${editingReceipt.receiptNumber}` : `${activeTemplate.label} receipt`}</h1><p>{activeTemplate.description}. The preview updates as you type.</p></div><button className="button ghost small" onClick={startNew}><Plus size={16} /> New blank</button></div>
                  {activeDraft.templateId === "evergreen" ? (
                    <EvergreenForm draft={activeDraft} onChange={setActiveDraft} />
                  ) : (
                    <SknForm draft={activeDraft} onChange={setActiveDraft} />
                  )}
                  <p className="autosave-note"><ShieldCheck size={15} /> Draft changes save automatically. Use Save receipt to add a finalized copy to History.</p>
                </section>
              )}

              {drawerView === "history" && (
                <section className="drawer-section history-drawer">
                  <div className="drawer-title"><div><span className="eyebrow">On this device</span><h1>Receipt history</h1></div><button className="button ghost small" onClick={() => { startNew(); setDrawerView("edit"); }}><Plus size={16} /> New blank</button></div>
                  <div className="history-filter" aria-label="Filter receipt history">
                    {(["all", ...RECEIPT_TEMPLATE_IDS] as HistoryFilter[]).map((filter) => <button key={filter} type="button" className={historyFilter === filter ? "active" : ""} onClick={() => setHistoryFilter(filter)}>{filter === "all" ? "All" : RECEIPT_TEMPLATES[filter].label}</button>)}
                  </div>
                  <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, vehicle, name, or template…" aria-label="Search receipt history" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button>}</div>
                  {filteredReceipts.length === 0 ? <div className="empty-state"><span><Archive size={25} /></span><h2>{receipts.length ? "No matching receipts" : "No saved receipts"}</h2><p>{receipts.length ? "Try another filter or search." : "Complete a receipt and use Save receipt. Your working drafts are still safe."}</p></div> : <div className="history-list">{filteredReceipts.map((receipt) => <article className="history-card" key={receipt.id}><div className={`history-icon ${receipt.templateId}`}><ReceiptText size={21} /></div><div className="history-main"><div className="history-title"><strong>Receipt {receipt.receiptNumber}</strong><span className={`template-badge ${receipt.templateId}`}>{RECEIPT_TEMPLATES[receipt.templateId].label}</span>{receipt.revisions.length > 0 && <span className="revised-pill">Revised ×{receipt.revisions.length}</span>}</div><p>{historyDescription(receipt)}</p></div><div className="history-meta"><span>{new Date(`${receipt.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span><strong>₹{formatInr(receipt.totalValue)}</strong></div><div className="history-actions"><button className="icon-button" onClick={() => openReceipt(receipt)} aria-label={`Open ${receipt.templateId} receipt ${receipt.receiptNumber}`}><PencilLine size={16} /></button><button className="icon-button" onClick={() => duplicateReceipt(receipt)} aria-label={`Duplicate ${receipt.templateId} receipt ${receipt.receiptNumber}`}><Copy size={16} /></button><button className="icon-button" onClick={() => void downloadPdf(receipt)} aria-label={`Download ${receipt.templateId} receipt ${receipt.receiptNumber} as PDF`}><Download size={16} /></button><button className="icon-button danger" onClick={() => void removeReceipt(receipt)} aria-label={`Delete ${receipt.templateId} receipt ${receipt.receiptNumber}`}><Trash2 size={16} /></button></div></article>)}</div>}
                </section>
              )}

              {drawerView === "settings" && (
                <section className="drawer-section settings-drawer">
                  <div className="drawer-title"><div><span className="eyebrow">Evergreen template</span><h1>Settings</h1><p>SKN’s printed business details stay fixed to its vector template.</p></div></div>
                  <div className="settings-card">
                    <div className="form-grid">
                      <Field label="Business name" wide><input value={profileForm.businessName} onChange={(event) => setProfileForm({ ...profileForm, businessName: event.target.value })} /></Field>
                      <Field label="Dealer line" wide><input value={profileForm.dealerLine} onChange={(event) => setProfileForm({ ...profileForm, dealerLine: event.target.value })} /></Field>
                      <Field label="GSTIN"><input value={profileForm.gstin} onChange={(event) => setProfileForm({ ...profileForm, gstin: event.target.value.toUpperCase() })} /></Field>
                      <Field label="Primary phone"><input value={profileForm.phonePrimary} onChange={(event) => setProfileForm({ ...profileForm, phonePrimary: event.target.value })} /></Field>
                      <Field label="Secondary phone"><input value={profileForm.phoneSecondary} onChange={(event) => setProfileForm({ ...profileForm, phoneSecondary: event.target.value })} /></Field>
                      <Field label="Address" wide><textarea rows={3} value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} /></Field>
                      <Field label="Tax note"><input value={profileForm.taxNote} onChange={(event) => setProfileForm({ ...profileForm, taxNote: event.target.value })} /></Field>
                      <Field label="Footer note"><input value={profileForm.footerNote} onChange={(event) => setProfileForm({ ...profileForm, footerNote: event.target.value })} /></Field>
                    </div>
                    <div className="logo-upload"><div className="logo-preview">{profileForm.logoDataUrl ? (
                      // A local data URL cannot use the framework image optimizer.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profileForm.logoDataUrl} alt="Uploaded business logo" />
                    ) : (
                      // This file is served locally from public and does not need image optimization.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={BHARAT_PETROLEUM_LOGO_URL} alt="Default Bharat Petroleum logo" />
                    )}</div><div><strong>Evergreen logo</strong><p>PNG, JPEG, or SVG up to 1.5 MB.</p><div className="inline-actions"><label className="button secondary small"><Upload size={16} /> Upload<input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(event) => void handleLogo(event.target.files?.[0])} /></label>{profileForm.logoDataUrl && <button className="button ghost small" onClick={() => setProfileForm({ ...profileForm, logoDataUrl: undefined })}>Use default</button>}</div></div></div>
                    <button className="button primary" onClick={() => void saveBusinessProfile()}>Save Evergreen settings</button>
                  </div>
                  <div className="data-card"><div className="data-icon"><ShieldCheck size={23} /></div><h2>Device backup</h2><p>Both templates stay in this browser. Keep a backup before clearing browser data.</p><button className="button secondary full" onClick={() => void backupAll()}><Download size={17} /> Download backup</button><button className="button ghost full" onClick={() => restoreInput.current?.click()}><RotateCcw size={17} /> Restore backup</button><input ref={restoreInput} type="file" accept="application/json" hidden onChange={(event) => void restoreAll(event.target.files?.[0])} /></div>
                </section>
              )}
            </div>

            <footer className="drawer-footer">
              <button className="button primary full" onClick={() => void persistReceipt()} disabled={Boolean(busy)}><Save size={17} /> {editingReceipt ? "Save revision" : "Save receipt"}</button>
              {installPrompt && <button className="button secondary full" onClick={() => void installApp()}><MonitorDown size={17} /> Install app</button>}
            </footer>
          </aside>
        </>
      )}

      {showRevision && (
        <div className="modal-backdrop no-print" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="revision-title">
            <button className="icon-button modal-close" onClick={() => setShowRevision(false)} aria-label="Close revision dialog"><X size={18} /></button>
            <span className="modal-icon"><History size={22} /></span><h2 id="revision-title">Why is this receipt changing?</h2><p>The previous version will remain in its revision history.</p>
            <Field label="Revision note"><textarea rows={4} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="e.g. Corrected vehicle number" /></Field>
            <div className="modal-actions"><button className="button ghost" onClick={() => setShowRevision(false)}>Cancel</button><button className="button primary" disabled={!revisionReason.trim()} onClick={() => void persistReceipt(revisionReason)}>Save revision</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
