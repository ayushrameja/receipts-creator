# Receipts

An installable, offline-first receipt book for two templates:

- **Evergreen** filling station cash or credit memos.
- **SKN** natural gas retail invoices recreated as clean vector artwork.

Each template keeps its own autosaved working draft. Completed receipts can be saved into shared, searchable on-device history, revised with an audit note, and exported or shared as PDFs.

## Run locally

Requires Node.js 24 and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` in Chrome or Edge. Use the browser's install option to add it to the device as an offline app.

## Checks

```bash
pnpm test:unit
pnpm build
pnpm test:e2e
```

The app intentionally has no server database or account system. Receipts are stored in IndexedDB in the current browser. Use **Settings -> Download backup** regularly to keep a portable JSON copy. Version 2 backups contain both receipt templates, and version 1 Evergreen backups remain importable.

## Deploy on Vercel

Import the repository into Vercel and use the detected Next.js defaults. No environment variables or custom deployment configuration are required.
