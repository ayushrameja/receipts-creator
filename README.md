# Evergreen Receipt Creator

An installable, offline-first receipt book for Evergreen Filling Station. Staff can create A6 cash or credit memos, keep searchable records on one device, revise saved receipts with an audit note, and export PDF, DOCX, PNG, or JPEG copies.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in Chrome or Edge. Use the browser's install option to add it to the device as an offline app.

## Checks

```bash
npm run test:unit
npm run build
npm run test:e2e
```

The app intentionally has no server database or account system. Receipts are stored in IndexedDB in the current browser. Use **Settings → Download backup** regularly to keep a portable JSON copy.

