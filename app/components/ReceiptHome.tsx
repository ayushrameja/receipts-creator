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
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusinessProfile, LineItem, Receipt, ReceiptDraft } from "../types";
import {
  calculateTotal,
  createEmptyDraft,
  createLineItem,
  DEFAULT_PROFILE,
  formatInr,
  matchesReceipt,
  PRODUCT_SUGGESTIONS,
} from "../lib/receipt";
import {
  createBackup,
  deleteReceipt,
  loadDraft,
  loadProfile,
  loadReceipts,
  restoreBackup,
  saveDraft,
  saveProfile,
} from "../lib/storage";
import {
  createReceiptPdfBlob,
  downloadBackupFile,
  exportReceiptPdf,
  receiptPdfFilename,
} from "../lib/export";
import { ReceiptPreview } from "./ReceiptPreview";

type DrawerView = "edit" | "history" | "settings";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function draftFromReceipt(receipt: Receipt): ReceiptDraft {
  return {
    receiptNumber: receipt.receiptNumber,
    date: receipt.date,
    paymentMode: receipt.paymentMode,
    customerName: receipt.customerName,
    vehicleNumber: receipt.vehicleNumber,
    items: structuredClone(receipt.items),
  };
}

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

export default function ReceiptHome() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>("edit");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileForm, setProfileForm] = useState<BusinessProfile | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [draft, setDraft] = useState<ReceiptDraft>(() => createEmptyDraft());
  const [editingId, setEditingId] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const restoreInput = useRef<HTMLInputElement>(null);

  const refreshReceipts = useCallback(async () => setReceipts(await loadReceipts()), []);

  useEffect(() => {
    let active = true;
    Promise.all([loadProfile(), loadReceipts(), loadDraft()]).then(([storedProfile, storedReceipts, storedDraft]) => {
      if (!active) return;
      setProfile(storedProfile);
      setProfileForm(structuredClone(storedProfile));
      setReceipts(storedReceipts);
      if (storedDraft) {
        setDraft(storedDraft.value);
        setEditingId(storedDraft.editingId);
      }
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
    const timer = window.setTimeout(() => saveDraft(draft, editingId), 350);
    return () => window.clearTimeout(timer);
  }, [draft, editingId, hydrated]);

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

  const previewReceipt = useMemo<Receipt>(() => {
    const now = new Date().toISOString();
    return {
      ...structuredClone(draft),
      id: editingReceipt?.id ?? "preview",
      total: calculateTotal(draft.items),
      profileSnapshot: editingReceipt?.profileSnapshot ?? profile ?? DEFAULT_PROFILE,
      createdAt: editingReceipt?.createdAt ?? now,
      updatedAt: now,
      revisions: editingReceipt?.revisions ?? [],
    };
  }, [draft, editingReceipt, profile]);

  const filteredReceipts = useMemo(
    () => receipts.filter((receipt) => matchesReceipt(receipt, search)),
    [receipts, search],
  );

  function updateDraft<K extends keyof ReceiptDraft>(key: K, value: ReceiptDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors([]);
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    updateDraft(
      "items",
      draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function openDrawer(view: DrawerView) {
    setDrawerView(view);
    setDrawerOpen(true);
    setErrors([]);
  }

  function startNew() {
    setDraft(createEmptyDraft());
    setEditingId(undefined);
    setErrors([]);
    setDrawerView("edit");
  }

  function openReceipt(receipt: Receipt) {
    setDraft(draftFromReceipt(receipt));
    setEditingId(receipt.id);
    setErrors([]);
    setDrawerOpen(false);
    setNotice(`Receipt ${receipt.receiptNumber || "draft"} opened.`);
  }

  function duplicateReceipt(receipt: Receipt) {
    setDraft({ ...draftFromReceipt(receipt), receiptNumber: "", date: "" });
    setEditingId(undefined);
    setErrors([]);
    setDrawerView("edit");
    setNotice("Blank copy ready. Changes save automatically.");
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
          title: "Evergreen receipt",
          text: "Evergreen Filling Station receipt",
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
    if (!window.confirm(`Delete receipt ${receipt.receiptNumber}? This cannot be undone.`)) return;
    await deleteReceipt(receipt.id);
    if (editingId === receipt.id) startNew();
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
    setNotice("Business settings saved.");
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
      startNew();
      setNotice(`Restored ${backup.receipts.length} receipt${backup.receipts.length === 1 ? "" : "s"}.`);
    } catch {
      setErrors(["That file is not a valid Evergreen Receipt Creator backup."]);
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
        <p>Opening your receipt book…</p>
      </main>
    );
  }

  return (
    <main className="app-shell receipt-home">
      {notice && <div className="toast no-print" role="status"><Check size={18} /> {notice}</div>}
      {busy && <div className="busy-bar no-print"><span />{busy}…</div>}

      <section className="receipt-stage">
        <header className="stage-toolbar no-print">
          <button className="icon-button stage-menu" onClick={() => setDrawerOpen(true)} aria-label="Open receipt controls">
            <Menu size={21} />
          </button>
          <div className="stage-brand"><LogoMark /><span><strong>Evergreen</strong><small>Receipt Creator</small></span></div>
          <div className="stage-actions">
            <button className="button secondary" onClick={() => downloadPdf()} disabled={Boolean(busy)}><Download size={18} /><span>Download PDF</span></button>
            <button className="button primary" onClick={sharePdf} disabled={Boolean(busy)}><Share2 size={18} /><span>Share</span></button>
          </div>
        </header>

        <div className="stage-preview">
          <ReceiptPreview receipt={previewReceipt} />
        </div>
        <p className="stage-autosave no-print"><ShieldCheck size={15} /> Changes save automatically on this device</p>
      </section>

      {drawerOpen && (
        <>
          <button className="drawer-scrim no-print" onClick={() => setDrawerOpen(false)} aria-label="Close receipt controls" />
          <aside className="side-drawer no-print" aria-label="Receipt controls">
            <header className="drawer-header">
              <div className="stage-brand"><LogoMark /><span><strong>Evergreen</strong><small>Receipt Creator</small></span></div>
              <button className="icon-button" onClick={() => setDrawerOpen(false)} aria-label="Close receipt controls"><X size={20} /></button>
            </header>

            <nav className="drawer-nav" aria-label="Receipt sections">
              <button className={drawerView === "edit" ? "active" : ""} onClick={() => openDrawer("edit")}><PencilLine size={17} /> Edit</button>
              <button className={drawerView === "history" ? "active" : ""} onClick={() => openDrawer("history")}><History size={17} /> History <span>{receipts.length}</span></button>
              <button className={drawerView === "settings" ? "active" : ""} onClick={() => openDrawer("settings")}><Settings size={17} /> Settings</button>
            </nav>

            <div className="drawer-scroll">
              {errors.length > 0 && <div className="error-box" role="alert"><strong>Please check this</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

              {drawerView === "edit" && (
                <section className="drawer-section">
                  <div className="drawer-title"><div><span className="eyebrow">Saved automatically</span><h1>Edit receipt</h1><p>The receipt updates as you type.</p></div><button className="button ghost small" onClick={startNew}><Plus size={16} /> New blank</button></div>

                  <div className="form-section">
                    <div className="section-title"><span>01</span><div><h2>Receipt details</h2><p>Leave anything blank when it is not needed.</p></div></div>
                    <div className="form-grid">
                      <Field label="Receipt number"><input value={draft.receiptNumber} onChange={(event) => updateDraft("receiptNumber", event.target.value)} placeholder="Optional" /></Field>
                      <Field label="Date"><input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></Field>
                      <Field label="Memo type"><div className="segmented"><button className={draft.paymentMode === "cash" ? "active" : ""} onClick={() => updateDraft("paymentMode", "cash")} type="button">Cash</button><button className={draft.paymentMode === "credit" ? "active" : ""} onClick={() => updateDraft("paymentMode", "credit")} type="button">Credit</button></div></Field>
                      <Field label="Customer name"><input value={draft.customerName} onChange={(event) => updateDraft("customerName", event.target.value)} placeholder="Optional" /></Field>
                      <Field label="Vehicle number" wide><input value={draft.vehicleNumber} onChange={(event) => updateDraft("vehicleNumber", event.target.value.toUpperCase())} placeholder="Optional" /></Field>
                    </div>
                  </div>

                  <div className="form-section">
                    <div className="section-title line-title"><span>02</span><div><h2>Products</h2><p>Amounts calculate automatically.</p></div><button className="button ghost small" type="button" disabled={draft.items.length >= 6} onClick={() => updateDraft("items", [...draft.items, createLineItem("")])}><Plus size={16} /> Add row</button></div>
                    <div className="items-list">
                      {draft.items.map((item, index) => (
                        <article className="item-card" key={item.id}>
                          <div className="item-number">{String(index + 1).padStart(2, "0")}</div>
                          <Field label="Particulars" wide><input list="product-suggestions" value={item.particulars} onChange={(event) => updateItem(item.id, { particulars: event.target.value })} /></Field>
                          <Field label="Quantity"><input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} placeholder="0.00" /></Field>
                          <Field label="Rate (₹)"><input inputMode="decimal" value={item.rate} onChange={(event) => updateItem(item.id, { rate: event.target.value })} placeholder="0.00" /></Field>
                          <Field label="Amount (₹)"><input inputMode="decimal" value={item.useManualAmount ? item.manualAmount : formatInr(Number(item.quantity || 0) * Number(item.rate || 0))} onChange={(event) => updateItem(item.id, { manualAmount: event.target.value, useManualAmount: true })} readOnly={!item.useManualAmount} aria-label={`Amount for ${item.particulars || `item ${index + 1}`}`} /></Field>
                          <label className="override-check"><input type="checkbox" checked={item.useManualAmount} onChange={(event) => updateItem(item.id, { useManualAmount: event.target.checked })} />Manual</label>
                          <button className="icon-button remove-item" type="button" onClick={() => updateDraft("items", draft.items.filter((entry) => entry.id !== item.id))} disabled={draft.items.length === 1} aria-label={`Remove item ${index + 1}`}><Trash2 size={17} /></button>
                        </article>
                      ))}
                    </div>
                    <datalist id="product-suggestions">{PRODUCT_SUGGESTIONS.map((product) => <option key={product} value={product} />)}</datalist>
                    <div className="total-strip"><span>Receipt total</span><strong>₹{formatInr(calculateTotal(draft.items))}</strong></div>
                  </div>
                  <p className="autosave-note"><ShieldCheck size={15} /> No save button needed. This working receipt is stored in the background.</p>
                </section>
              )}

              {drawerView === "history" && (
                <section className="drawer-section history-drawer">
                  <div className="drawer-title"><div><span className="eyebrow">On this device</span><h1>Receipt history</h1></div><button className="button ghost small" onClick={() => { startNew(); setDrawerView("edit"); }}><Plus size={16} /> New blank</button></div>
                  <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search receipts…" aria-label="Search receipt history" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={16} /></button>}</div>
                  {filteredReceipts.length === 0 ? <div className="empty-state"><span><Archive size={25} /></span><h2>No saved receipts</h2><p>Your current working receipt is still saved automatically.</p></div> : <div className="history-list">{filteredReceipts.map((receipt) => <article className="history-card" key={receipt.id}><div className="history-icon"><ReceiptText size={21} /></div><div className="history-main"><strong>Receipt {receipt.receiptNumber || "draft"}</strong><p>{receipt.customerName || receipt.vehicleNumber || "Unnamed receipt"}</p></div><div className="history-meta"><span>{receipt.date ? new Date(`${receipt.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Undated"}</span><strong>₹{formatInr(receipt.total)}</strong></div><div className="history-actions"><button className="icon-button" onClick={() => openReceipt(receipt)} aria-label={`Open receipt ${receipt.receiptNumber}`}><PencilLine size={16} /></button><button className="icon-button" onClick={() => duplicateReceipt(receipt)} aria-label={`Duplicate receipt ${receipt.receiptNumber}`}><Copy size={16} /></button><button className="icon-button" onClick={() => downloadPdf(receipt)} aria-label={`Download receipt ${receipt.receiptNumber} as PDF`}><Download size={16} /></button><button className="icon-button danger" onClick={() => removeReceipt(receipt)} aria-label={`Delete receipt ${receipt.receiptNumber}`}><Trash2 size={16} /></button></div></article>)}</div>}
                </section>
              )}

              {drawerView === "settings" && (
                <section className="drawer-section settings-drawer">
                  <div className="drawer-title"><div><span className="eyebrow">Business profile</span><h1>Settings</h1><p>Changes update the current blank template.</p></div></div>
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
                    ) : <LogoMark />}</div><div><strong>Business logo</strong><p>PNG, JPEG, or SVG up to 1.5 MB.</p><div className="inline-actions"><label className="button secondary small"><Upload size={16} /> Upload<input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(event) => handleLogo(event.target.files?.[0])} /></label>{profileForm.logoDataUrl && <button className="button ghost small" onClick={() => setProfileForm({ ...profileForm, logoDataUrl: undefined })}>Use default</button>}</div></div></div>
                    <button className="button primary" onClick={saveBusinessProfile}>Save business settings</button>
                  </div>
                  <div className="data-card"><div className="data-icon"><ShieldCheck size={23} /></div><h2>Device backup</h2><p>Receipts stay in this browser. Keep a backup before clearing browser data.</p><button className="button secondary full" onClick={backupAll}><Download size={17} /> Download backup</button><button className="button ghost full" onClick={() => restoreInput.current?.click()}><RotateCcw size={17} /> Restore backup</button><input ref={restoreInput} type="file" accept="application/json" hidden onChange={(event) => restoreAll(event.target.files?.[0])} /></div>
                </section>
              )}
            </div>

            {installPrompt && <footer className="drawer-footer"><button className="button secondary full" onClick={installApp}><MonitorDown size={17} /> Install app</button></footer>}
          </aside>
        </>
      )}
    </main>
  );
}
