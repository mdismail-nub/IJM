# IJM — Privacy-First Browser Utility Platform

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/114fb7dd-4110-40ef-99e7-095f4bc8ba38).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

---

## Product Overview

**IJM** is a fast, privacy-conscious online utility platform for students, professionals, freelancers, small businesses, and developers. Every tool runs **100% locally in the browser** without requiring account registration or uploading user documents to an external server.

### Implemented Tool Categories (24 Tools)

1. **File Tools (`/file-tools`)**
   - **Merge PDFs (`/tools/merge-pdfs`)** — Combine multiple PDFs into a single file in custom order (`pdf-lib`).
   - **Split PDF (`/tools/split-pdf`)** — Extract page ranges into individual or combined PDF files.
   - **Compress PDF (`/tools/compress-pdf`)** — Optimize PDF object streams and strip redundant metadata.
   - **Rotate PDF Pages (`/tools/rotate-pages`)** — Rotate all or selected page ranges by 90°, 180°, or 270°.
   - **Image to PDF (`/tools/image-to-pdf`)** — Convert PNG, JPG, and WebP images into a multi-page PDF.
   - **Resize Images (`/tools/resize-images`)** — Resize images by exact pixel dimensions or percentage with aspect-ratio lock.
   - **Convert Images (`/tools/convert-images`)** — Convert between PNG, JPEG, and WebP with quality control.

2. **Data Tools (`/data-tools`)**
   - **CSV Data Workbench (`/tools/csv-cleaner`)** — Multi-step RFC-4180 CSV cleaning pipeline with undo/reset and side-by-side Before/After preview.
   - **Remove Duplicates (`/tools/remove-duplicates`)** — Deduplicate CSV rows across all or selected key columns.
   - **Trim & Normalize (`/tools/trim-normalize`)** — Strip extra spaces and normalize text casing (`Title Case`, `lowercase`, `UPPERCASE`).
   - **Standardize Dates (`/tools/date-standardizer`)** — Convert supported date formats to `YYYY-MM-DD`, `DD/MM/YYYY`, or `MM/DD/YYYY` while preserving invalid cells with clear warnings.
   - **Column Splitter (`/tools/column-splitter`)** — Split a CSV column by a chosen delimiter into multiple columns.
   - **CSV ⇄ JSON (`/tools/csv-json`)** — Bidirectional converter between RFC-4180 CSV and JSON arrays.

3. **Business Tools (`/business-tools`)**
   - **Invoice Generator (`/tools/invoice-generator`)** — Live invoice editor and A4 vector PDF exporter with line items, discounts, configurable taxes, and reusable business details.
   - **Quotation Generator (`/tools/quotation-generator`)** — Itemized project quotes with validity periods, terms, and A4 PDF export.
   - **Tax Calculator (`/tools/tax-calculator`)** — Exclusive ("Add Tax") and Inclusive ("Extract Tax") calculator with rate presets.
   - **Percentage & Discount Calculator (`/tools/discount-calculator`)** — Primary & stacked discounts, sales tax, and percentage change utilities.

4. **Developer Tools (`/developer-tools`)**
   - **JSON Formatter (`/tools/json-formatter`)** — Pretty-print, minify, sort keys, and validate JSON with line/column diagnostics.
   - **Base64 Encode / Decode (`/tools/base64-codec`)** — UTF-8 safe Base64 and URL-safe Base64 encoder/decoder.
   - **URL Encoder / Decoder (`/tools/url-encoder`)** — `encodeURIComponent` and `encodeURI` modes with query parameter inspection.
   - **Unix Timestamp Converter (`/tools/timestamp-converter`)** — Seconds/milliseconds epoch converter with UTC, local, and relative time output.
   - **UUID Generator (`/tools/uuid-generator`)** — Cryptographic v4 UUID bulk generator (`crypto.randomUUID()`).
   - **Diff Checker (`/tools/diff-checker`)** — LCS line-by-line diff viewer with unified and split views.

5. **Student Tools (`/student-tools`)**
   - **ExamSprint Study Planner (`/tools/examsprint-planner`)** — Deterministic priority-weighted study timetable generator with difficulty/confidence ratings, Daily & Weekly views, completion tracking, missed-day rescheduling, `localStorage` persistence, and PDF/CSV export.

---

## Local Development & Verification

```sh
# 1. Install dependencies
npm install

# 2. Start development server on http://localhost:3000
npm run dev

# 3. Run Vitest & React Testing Library test suite
npm test

# 4. Run pure logic Node test suite
npx tsx --test tests/*.test.ts

# 5. Format & lint check
npm run format

# 6. Build for production
npm run build
```

## Architecture & Security Notes

- **Zero Server File Uploads**: All PDF, image, CSV, invoice, and study-plan operations execute strictly in browser memory using `pdf-lib`, HTML5 `Canvas`, `FileReader`, and `Web Crypto`.
- **No Unnecessary External APIs or Databases**: No API keys, secrets, or server databases are required. Optional user convenience data (recent tools, saved business profile, study plan) is stored locally in `window.localStorage` with one-click reset controls.
