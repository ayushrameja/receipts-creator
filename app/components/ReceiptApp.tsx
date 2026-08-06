"use client";

import {
  Archive,
  Check,
  Copy,
  Download,
  History,
  MonitorDown,
  Menu,
  PencilLine,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusinessProfile, LineItem, Receipt, ReceiptDraft } from "../types";
import {
  buildReceipt,
  calculateTotal,
  createEmptyDraft,
  createLineItem,
  formatInr,
  matchesReceipt,
  PRODUCT_SUGGESTIONS,
  todayIso,
  validateDraft,
} from "../lib/receipt";
import {
  clearDraft,
  createBackup,
  deleteReceipt,
  findReceiptNumber,
  loadDraft,
  loadProfile,
  loadReceipts,
  restoreBackup,
  saveDraft,
  saveProfile,
  saveReceipt,
} from "../lib/storage";
import {
  downloadBackupFile,
  exportReceiptPdf,
} from "../lib/export";
import { ReceiptPreview } from "./ReceiptPreview";

type Tab = "create" | "history" | "settings";
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

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brand-mark compact" : "brand-mark"} aria-hidden="true">
      <ReceiptText size={compact ? 18 : 24} strokeWidth={2.4} />
    </span>
  );
}

export default function ReceiptApp() {
  const [tab, setTab] = useState<Tab>("create");
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
  const [showRevision, setShowRevision] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
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

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => saveDraft(draft, editingId), 450);
    return () => window.clearTimeout(timer);
  }, [draft, editingId, hydrated]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
      profileSnapshot: editingReceipt?.profileSnapshot ?? profile ?? {
        businessName: "EVERGREEN FILLING STATION",
        dealerLine: "Dealers: BHARAT PETROLEUM CORPORATION LTD.",
        gstin: "03AAEFE7466J1ZB",
        address: "Lehli-Banur Road, Jalalpur, Teh. Dera Bassi (Pb.)",
        phonePrimary: "9815358789",
        phoneSecondary: "9855687200",
        taxNote: "Including taxes",
        footerNote: "E. & O.E.",
      },
      createdAt: editingReceipt?.createdAt ?? now,
      updatedAt: editingReceipt?.updatedAt ?? now,
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

  function startNew() {
    setDraft(createEmptyDraft());
    setEditingId(undefined);
    setErrors([]);
    setTab("create");
    setMobileMenu(false);
  }

  function openReceipt(receipt: Receipt) {
    setDraft(draftFromReceipt(receipt));
    setEditingId(receipt.id);
    setErrors([]);
    setTab("create");
  }

  function duplicateReceipt(receipt: Receipt) {
    setDraft({ ...draftFromReceipt(receipt), receiptNumber: "", date: todayIso() });
    setEditingId(undefined);
    setErrors([]);
    setTab("create");
    setNotice("Copy ready. Add a new receipt number before saving.");
  }

  async function persistReceipt(reason?: string) {
    if (!profile) return;
    const validation = validateDraft(draft);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    const duplicate = await findReceiptNumber(draft.receiptNumber);
    if (duplicate && duplicate.id !== editingId) {
      setErrors([`Receipt number ${draft.receiptNumber} already exists.`]);
      return;
    }
    if (editingReceipt && !reason) {
      setShowRevision(true);
      return;
    }
    setBusy("Saving receipt");
    try {
      const saved = buildReceipt(
        draft,
        editingReceipt?.profileSnapshot ?? profile,
        editingReceipt,
        reason,
      );
      await saveReceipt(saved);
      await clearDraft();
      await refreshReceipts();
      setEditingId(saved.id);
      setDraft(draftFromReceipt(saved));
      setShowRevision(false);
      setRevisionReason("");
      setNotice(editingReceipt ? "Revision saved." : "Receipt saved on this device.");
    } finally {
      setBusy("");
    }
  }

  async function downloadPdf(receipt = previewReceipt) {
    const validation = validateDraft(draftFromReceipt(receipt));
    if (validation.length) {
      setErrors(validation);
      setTab("create");
      return;
    }
    setBusy("Preparing PDF");
    try {
      await exportReceiptPdf(receipt);
      setNotice("PDF downloaded.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "The export could not be created."]);
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
    setNotice("Business settings saved. Existing receipts stay unchanged.");
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
      const parsed = JSON.parse(await file.text());
      const backup = await restoreBackup(parsed);
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
    <main className="app-shell">
      <header className="topbar no-print">
        <button className="brand" onClick={startNew} aria-label="Create a new receipt">
          <LogoMark />
          <span>
            <strong>Evergreen</strong>
            <small>Receipt Creator</small>
          </span>
        </button>

        <nav className={mobileMenu ? "nav-tabs open" : "nav-tabs"} aria-label="Main navigation">
          <button className={tab === "create" ? "active" : ""} onClick={() => { setTab("create"); setMobileMenu(false); }}>
            <PencilLine size={18} /> Create
          </button>
          <button className={tab === "history" ? "active" : ""} onClick={() => { setTab("history"); setMobileMenu(false); }}>
            <History size={18} /> History <span className="count">{receipts.length}</span>
          </button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => { setTab("settings"); setMobileMenu(false); }}>
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="top-actions">
          <span className={online ? "connection online" : "connection"} title={online ? "Online" : "Offline - your receipts still work"}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{online ? "Ready" : "Offline"}</span>
          </span>
          {installPrompt && (
            <button className="button secondary install-button" onClick={installApp}>
              <MonitorDown size={17} /> Install app
            </button>
          )}
          <button className="icon-button menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open navigation">
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {notice && (
        <div className="toast no-print" role="status">
          <Check size={18} /> {notice}
        </div>
      )}
      {busy && <div className="busy-bar no-print"><span />{busy}…</div>}

      {tab === "create" && (
        <section className="workspace">
          <div className="editor-panel no-print">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">{editingReceipt ? "Saved receipt" : "New receipt"}</span>
                <h1>{editingReceipt ? `Receipt ${editingReceipt.receiptNumber}` : "Create a receipt"}</h1>
                <p>{editingReceipt ? "Saving changes will create a revision note." : "Fill the details and watch the memo update live."}</p>
              </div>
              <button className="button ghost" onClick={startNew}><Plus size={17} /> New</button>
            </div>

            {errors.length > 0 && (
              <div className="error-box" role="alert">
                <strong>Please check the receipt</strong>
                <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            )}

            <div className="form-section">
              <div className="section-title"><span>01</span><div><h2>Receipt details</h2><p>Match these with the paper receipt book.</p></div></div>
              <div className="form-grid">
                <Field label="Receipt number" hint="Entered manually and checked for duplicates">
                  <input value={draft.receiptNumber} onChange={(event) => updateDraft("receiptNumber", event.target.value)} placeholder="e.g. 5321" />
                </Field>
                <Field label="Date">
                  <input type="date" value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} />
                </Field>
                <Field label="Memo type">
                  <div className="segmented">
                    <button className={draft.paymentMode === "cash" ? "active" : ""} onClick={() => updateDraft("paymentMode", "cash")} type="button">Cash</button>
                    <button className={draft.paymentMode === "credit" ? "active" : ""} onClick={() => updateDraft("paymentMode", "credit")} type="button">Credit</button>
                  </div>
                </Field>
                <Field label="Customer name">
                  <input value={draft.customerName} onChange={(event) => updateDraft("customerName", event.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Vehicle number" wide>
                  <input value={draft.vehicleNumber} onChange={(event) => updateDraft("vehicleNumber", event.target.value.toUpperCase())} placeholder="e.g. PB 70 AB 1234" />
                </Field>
              </div>
            </div>

            <div className="form-section">
              <div className="section-title line-title">
                <span>02</span><div><h2>Products</h2><p>Amounts are calculated automatically.</p></div>
                <button className="button ghost small" type="button" disabled={draft.items.length >= 6} onClick={() => updateDraft("items", [...draft.items, createLineItem("")])}>
                  <Plus size={16} /> Add row
                </button>
              </div>
              <div className="items-list">
                {draft.items.map((item, index) => (
                  <article className="item-card" key={item.id}>
                    <div className="item-number">{String(index + 1).padStart(2, "0")}</div>
                    <Field label="Particulars" wide>
                      <input list="product-suggestions" value={item.particulars} onChange={(event) => updateItem(item.id, { particulars: event.target.value })} placeholder="Product or service" />
                    </Field>
                    <Field label="Quantity">
                      <input inputMode="decimal" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} placeholder="0.00" />
                    </Field>
                    <Field label="Rate (₹)">
                      <input inputMode="decimal" value={item.rate} onChange={(event) => updateItem(item.id, { rate: event.target.value })} placeholder="0.00" />
                    </Field>
                    <Field label="Amount (₹)">
                      <input
                        inputMode="decimal"
                        value={item.useManualAmount ? item.manualAmount : formatInr(Number(item.quantity || 0) * Number(item.rate || 0))}
                        onChange={(event) => updateItem(item.id, { manualAmount: event.target.value, useManualAmount: true })}
                        readOnly={!item.useManualAmount}
                        aria-label={`Amount for ${item.particulars || `item ${index + 1}`}`}
                      />
                    </Field>
                    <label className="override-check">
                      <input type="checkbox" checked={item.useManualAmount} onChange={(event) => updateItem(item.id, { useManualAmount: event.target.checked })} />
                      Manual
                    </label>
                    <button className="icon-button remove-item" type="button" onClick={() => updateDraft("items", draft.items.filter((entry) => entry.id !== item.id))} disabled={draft.items.length === 1} aria-label={`Remove item ${index + 1}`}>
                      <Trash2 size={17} />
                    </button>
                  </article>
                ))}
              </div>
              <datalist id="product-suggestions">
                {PRODUCT_SUGGESTIONS.map((product) => <option key={product} value={product} />)}
              </datalist>
              <div className="total-strip"><span>Receipt total</span><strong>₹{formatInr(calculateTotal(draft.items))}</strong></div>
            </div>

            <div className="editor-actions">
              <button className="button primary" onClick={() => persistReceipt()} disabled={Boolean(busy)}><Save size={18} />{editingReceipt ? "Save revision" : "Save receipt"}</button>
              <button className="button secondary" onClick={() => downloadPdf()} disabled={Boolean(busy)}><Download size={18} /> Download PDF</button>
              <button className="button ghost" onClick={() => window.print()}><Printer size={18} /> Print</button>
            </div>
            <p className="autosave-note"><ShieldCheck size={15} /> Drafts save automatically on this device.</p>
          </div>

          <aside className="preview-panel">
            <div className="preview-heading no-print"><div><span className="eyebrow">Live preview</span><h2>A6 cash memo</h2></div><span className="scale-pill">Print size · 105 × 148 mm</span></div>
            <ReceiptPreview receipt={previewReceipt} />
          </aside>
        </section>
      )}

      {tab === "history" && (
        <section className="page-section no-print">
          <div className="page-heading">
            <div><span className="eyebrow">Local receipt book</span><h1>Receipt history</h1><p>Search, revise, duplicate, or export anything saved on this device.</p></div>
            <button className="button primary" onClick={startNew}><Plus size={18} /> New receipt</button>
          </div>
          <div className="search-box"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search number, customer, vehicle, or date…" aria-label="Search receipt history" />{search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={17} /></button>}</div>
          {filteredReceipts.length === 0 ? (
            <div className="empty-state"><span><Archive size={26} /></span><h2>{receipts.length ? "No matching receipts" : "Your receipt book is empty"}</h2><p>{receipts.length ? "Try another number, name, vehicle, or date." : "Create and save your first receipt. It will appear here automatically."}</p><button className="button secondary" onClick={startNew}>Create receipt</button></div>
          ) : (
            <div className="history-list">
              {filteredReceipts.map((receipt) => (
                <article className="history-card" key={receipt.id}>
                  <div className="history-icon"><ReceiptText size={22} /></div>
                  <div className="history-main"><div className="history-title"><strong>Receipt {receipt.receiptNumber}</strong>{receipt.revisions.length > 0 && <span className="revised-pill">Revised ×{receipt.revisions.length}</span>}</div><p>{receipt.customerName || "Walk-in customer"}{receipt.vehicleNumber ? ` · ${receipt.vehicleNumber}` : ""}</p></div>
                  <div className="history-meta"><span>{new Date(`${receipt.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span><strong>₹{formatInr(receipt.total)}</strong></div>
                  <div className="history-actions">
                    <button className="button ghost small" onClick={() => openReceipt(receipt)}><PencilLine size={16} /> Open</button>
                    <button className="icon-button" onClick={() => duplicateReceipt(receipt)} aria-label={`Duplicate receipt ${receipt.receiptNumber}`}><Copy size={17} /></button>
                    <button className="icon-button" onClick={() => downloadPdf(receipt)} aria-label={`Download receipt ${receipt.receiptNumber} as PDF`}><Download size={17} /></button>
                    <button className="icon-button danger" onClick={() => removeReceipt(receipt)} aria-label={`Delete receipt ${receipt.receiptNumber}`}><Trash2 size={17} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "settings" && (
        <section className="page-section settings-page no-print">
          <div className="page-heading"><div><span className="eyebrow">One-time setup</span><h1>Business settings</h1><p>Changes apply to new receipts only. Saved receipts keep their original details.</p></div></div>
          {errors.length > 0 && <div className="error-box" role="alert"><strong>Please check the settings</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          <div className="settings-grid">
            <div className="settings-card">
              <div className="section-title"><span>01</span><div><h2>Station details</h2><p>Printed at the top of every new receipt.</p></div></div>
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
              <div className="logo-upload">
                <div className="logo-preview">{profileForm.logoDataUrl ? (
                  // A local data URL cannot use the framework image optimizer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileForm.logoDataUrl} alt="Uploaded business logo" />
                ) : <LogoMark />}</div>
                <div><strong>Business logo</strong><p>Optional. PNG, JPEG, or SVG up to 1.5 MB.</p><div className="inline-actions"><label className="button secondary small"><Upload size={16} /> Upload<input type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(event) => handleLogo(event.target.files?.[0])} /></label>{profileForm.logoDataUrl && <button className="button ghost small" onClick={() => setProfileForm({ ...profileForm, logoDataUrl: undefined })}>Use default</button>}</div></div>
              </div>
              <button className="button primary" onClick={saveBusinessProfile}><Save size={18} /> Save settings</button>
            </div>

            <aside className="data-card">
              <div className="data-icon"><ShieldCheck size={24} /></div><h2>Your data stays here</h2><p>Receipts live only in this browser. Download a backup regularly so a reset or lost device does not take the receipt book with it.</p>
              <button className="button secondary full" onClick={backupAll}><Download size={18} /> Download backup</button>
              <button className="button ghost full" onClick={() => restoreInput.current?.click()}><RotateCcw size={18} /> Restore backup</button>
              <input ref={restoreInput} type="file" accept="application/json" hidden onChange={(event) => restoreAll(event.target.files?.[0])} />
              <div className="data-stat"><span>Saved receipts</span><strong>{receipts.length}</strong></div>
            </aside>
          </div>
        </section>
      )}

      {showRevision && (
        <div className="modal-backdrop no-print" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="revision-title">
            <button className="icon-button modal-close" onClick={() => setShowRevision(false)} aria-label="Close"><X size={18} /></button>
            <span className="modal-icon"><History size={22} /></span><h2 id="revision-title">Why is this receipt changing?</h2><p>The previous version will stay in the revision history.</p>
            <Field label="Revision note"><textarea rows={4} value={revisionReason} onChange={(event) => setRevisionReason(event.target.value)} placeholder="e.g. Corrected vehicle number" /></Field>
            <div className="modal-actions"><button className="button ghost" onClick={() => setShowRevision(false)}>Cancel</button><button className="button primary" disabled={!revisionReason.trim()} onClick={() => persistReceipt(revisionReason)}>Save revision</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
