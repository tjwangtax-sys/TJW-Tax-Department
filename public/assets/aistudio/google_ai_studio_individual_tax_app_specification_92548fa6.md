# Google AI Studio Build Specification: TJW Group Individual Tax Job Management System

## 1. Project Overview
Build a full-stack **Individual Tax Job Management System** web application for **TJW Group Tax Department** (Malaysia) using **React, Tailwind CSS, Node.js, Firebase Firestore, Firebase Storage, and the Gemini API (`@google/genai`)**.

The system manages the complete lifecycle of Malaysian Individual Tax engagements (**Form BE, Form B, and Form M**) from initial annual reminder and client book-in, through AI-assisted document screening and book-in listing preparation, PIC tax preparation, reviewer clearance, fee billing, client sign-off, fee collection, and final LHDN e-Filing/MyTax submission.

---

## 2. Brand Identity & High-Density Enterprise UI
- **Color Palette:**
  - Primary Brand / Headers / Primary Actions: Deep Burgundy (`#790D16`)
  - Secondary Accent / Highlights: Warm Sand (`#E5D3AF`) and Cream (`#F5EFE1`)
  - Secondary Status Tags / Badges: Slate Blue (`#AEC4D4`)
  - Data Table & Workspace Surfaces: Crisp White (`#FFFFFF`) with subtle neutral borders (`#E5E7EB`)
- **Operational Table & Layout Rules:**
  - **Sticky Table Headers:** Keep column headers fixed (`position: sticky; top: 0`) during vertical scrolling.
  - **Compact Row Density:** High-scannability rows designed for tax staff managing high client volumes.
  - **Category-Based Column Visibility Toggles:** Allow users to show/hide column groups:
    1. *Client & Tax Profile* (Client Name, TIN/Tax Ref, IC/Passport, Form Type, YA)
    2. *Book-In & Follow-Up* (Reminder Sent, Follow-Up Count, Book-In Status, Book-In Date)
    3. *Document Screening* (Docs Uploaded Count, Completeness Status, Missing Items)
    4. *PIC & Review* (Assigned PIC, Reviewer, Job Start Date, Review Status)
    5. *Billing & Submission* (Fee Amount RM, Draft Sent Date, Signed Back, Fee Paid, LHDN Submission Date)
  - **Batch Export:** Export filtered job views and individual **Document Book-In Listings** to **CSV, Excel (`.xlsx`), and PDF**.
  - **Slide-Over / Modal Job Detail Drawer:** Clicking any client row opens a multi-tab detail workspace without losing table filter/scroll state.

---

## 3. End-to-End 14-Stage Workflow & State Machine

Enforce clear workflow transitions across 4 operational phases:

### Phase 1: Reminder & Book-In
1. **`1. Reminder Sent`**: Initial annual tax reminder sent via Email/WhatsApp.
2. **`2. Follow-Up Pending`**: Automated/logged follow-up reminders tracked until client responds.
3. **`3. Booked-In (Awaiting Docs)`**: Client confirms engagement book-in; system generates/activates their unique **Client Document Upload Portal Link**.

### Phase 2: Document Collection & AI Screening
4. **`4. Docs Uploaded (Screening)`**: Client uploads scanned PDFs/images; Gemini AI screens and classifies files into a structured **Document Book-In Listing**.
5. **`5. Incomplete Docs (Follow-Up)`**: Staff flags missing mandatory or supporting documents; system generates a missing-document follow-up checklist and tracks follow-ups until complete.
6. **`6. Docs Complete`**: All required documents verified and book-in listing finalized.

### Phase 3: Job Assignment, Preparation & Review
7. **`7. Assigned to PIC`**: Admin/Manager assigns the job to a specific Person-In-Charge (`PIC`) and `Reviewer`.
8. **`8. In Progress`**: PIC starts preparing the tax computation and draft return.
9. **`9. Pending Review`**: PIC submits completed draft computation for technical review.
10. **`10. Review Queries`**: Reviewer logs review notes/queries; PIC resolves and clears queries until Reviewer signs off.

### Phase 4: Work Done, Fee Billing, Sign-Off & Submission
11. **`11. Work Done & Fee Confirmed`**: Draft completed; staff confirms scope of work done and finalizes professional service fee (`RM`).
12. **`12. Draft & Invoice Sent`**: Tax draft return + fee note/invoice sent to client; system tracks follow-up reminders.
13. **`13. Signed & Paid`**: Client returns signed tax draft/authorization AND settles service fee payment.
14. **`14. Submitted & Completed`**: PIC submits return via LHDN MyTax/e-Filing, records acknowledgement receipt number, and marks the job **Completed**.

---

## 4. Dual-Portal Architecture

### A. Internal Tax Department Portal (Staff Dashboard)
1. **Top KPI Summary Strip (Clickable Quick Filters):**
   - Total Active Jobs
   - Pending Book-In Follow-Up
   - Incomplete Docs (Follow-Up)
   - With PIC / In Progress
   - Pending Review / Queries
   - Pending Client Sign-Off & Payment
   - Submitted & Completed
2. **Master Job Tracker Table:**
   - Search bar (Client Name, TIN, IC/Passport, File Ref).
   - Filters for Year of Assessment (`YA 2024`, `YA 2025`, `YA 2026`), Form Type (`Form BE`, `Form B`, `Form M`), Workflow Status, PIC, and Reviewer.
   - "+ New Tax Job" modal and bulk action bar (Export CSV/XLSX/PDF, Bulk Send Reminder).
3. **5-Tab Job Detail Drawer:**
   - **Tab 1: Book-In & Follow-Up Log**
     - Record reminder date, communication channel (`WhatsApp`, `Email`, `Phone`), and follow-up counter.
     - One-click **"Copy WhatsApp Reminder"** and **"Open WhatsApp Web"** (`https://wa.me/...`) with pre-filled client name, YA, and upload portal URL.
     - **"Confirm Client Book-In"** button to advance status to Stage 3.
   - **Tab 2: AI Document Screening & Book-In Listing**
     - View uploaded client files (with file preview/download).
     - **"Run Gemini AI Screening"** button to analyze uploaded files and populate the **Document Book-In Listing Table**:
       - `Item No.`
       - `Document Category`
       - `File Name`
       - `Issuer / Institution`
       - `Document Date / Period`
       - `Extracted Amount (RM)`
       - `AI Screening Notes`
       - `Verification Status` (`Verified`, `Needs Clarification`, `Incomplete`)
     - Editable checklist of **Missing Documents** + one-click **"Generate Missing Docs Follow-Up Message"** and status toggle (`Incomplete Docs` vs. `Docs Complete`).
     - Export Document Book-In Listing to Excel/PDF.
   - **Tab 3: PIC Assignment & Technical Review**
     - Dropdowns to assign `PIC` and `Reviewer`, plus `Start Date` and `Target Completion Date`.
     - Structured **Review Queries Log**: Add query, assign to PIC, PIC response note, and `Open` / `Cleared` status toggle.
     - Reviewer Sign-Off button.
   - **Tab 4: Work Done, Fee & Client Sign-Off**
     - Record `Work Done Summary`, `Base Fee (RM)`, `Disbursements (RM)`, `SST/Tax (RM)`, and `Total Fee (RM)`.
     - Generate formatted **Work Done & Fee Cover Note** for client dispatch.
     - Track `Draft & Fee Sent Date`, follow-up log, `Signed Draft Received` (checkbox + upload signed copy), and `Payment Received` (checkbox + payment date & receipt reference).
   - **Tab 5: LHDN Submission & Closure**
     - Record `LHDN Submission Date`, `e-Filing / MyTax Acknowledgement No.`, `Tax Payable / Refundable (RM)`, and **"Mark Job Completed"** button.

### B. Client Document Book-In Portal (Shareable Tokenized Link)
- Accessible via unique URL `/client-portal/:accessToken` (no complex login required for clients).
- Displays TJW Group branding, Client Name, Tax Reference / TIN, and Year of Assessment.
- **Step 1: Confirm Book-In:** One-click confirmation button if client has not yet confirmed book-in.
- **Step 2: Document Checklist & Upload:**
  - Guided checklist tailored to Malaysian Individual Tax:
    - *EA Form (CP8A) / EC Form / Commission Statements*
    - *Bank Statements (Saving/Current/FD Interest)*
    - *Tenancy Agreements & Rental Expense Receipts*
    - *Personal Tax Relief Receipts (Medical, Lifestyle, Education, SSPN, EPF, Life/Medical Insurance, PRS, EV Charging, Breastfeeding/Childcare)*
    - *Dividend Vouchers & Investment Income*
    - *Approved Donation & Zakat Receipts*
    - *Business Income & Expense Records (for Form B)*
  - Drag-and-drop multi-file uploader (PDF, JPG, PNG) that stores files securely and triggers status update to `4. Docs Uploaded (Screening)`.
  - Live status view showing received documents and any **Missing Documents** requested by the tax team.

---

## 5. Gemini AI Document Screening Engine (Backend Implementation)
Implement a secure server-side endpoint (`POST /api/jobs/:jobId/screen-documents`) using `@google/genai` (`gemini-2.5-flash`) with `GEMINI_API_KEY` stored in server environment variables.

### Expected JSON Output Schema from Gemini
Configure structured JSON output (`responseMimeType: "application/json"`) so Gemini returns:
```json
{
  "bookInListing": [
    {
      "category": "EA Form | Bank Statement | Tenancy Agreement | Personal Relief | Dividend Statement | Zakat/Donation | Business Record | Other",
      "fileName": "string",
      "issuer": "string",
      "periodOrDate": "string",
      "amountRM": 0.00,
      "taxRelevanceNote": "string",
      "confidence": "High | Medium | Low"
    }
  ],
  "detectedReliefCategories": ["string"],
  "potentialMissingItems": ["string"],
  "screeningSummary": "string"
}
```

---

## 6. Firestore Data Schema
- **`taxJobs` Collection:**
  - `id`, `clientName`, `icOrPassport`, `tinNumber`, `email`, `phone`, `formType` (`BE` | `B` | `M`), `yearOfAssessment` (`2025` | `2026`), `status` (Stages 1–14), `portalToken`
  - `bookIn`: `{ reminderSentDate, followUpCount, followUpLogs: [], bookedInDate, isBookedIn }`
  - `documents`: `{ completenessStatus, uploadedFiles: [], bookInListing: [], missingItems: [], screeningSummary }`
  - `assignment`: `{ picName, reviewerName, startedAt, submittedForReviewAt, reviewClearedAt, reviewQueries: [] }`
  - `billing`: `{ workDoneNotes, feeAmount, totalWithTax, draftSentDate, followUpCount, isSignedBack, signedCopyUrl, isPaid, paymentDate, receiptRef }`
  - `submission`: `{ lhdnSubmissionDate, acknowledgementNo, taxPayableOrRefund, completedAt }`
  - `createdAt`, `updatedAt`

---

## 7. Seed Data Requirements
Pre-populate the database with **8 realistic Malaysian individual tax client records** across `YA 2025` and `YA 2026` (covering Form BE, Form B, and Form M) spread across different stages of the 14-step workflow—including sample Document Book-In Listing items (e.g., Maybank Statement, EA Form, Tenancy Agreement, AIA Medical Insurance, Zakat Receipt), active review queries, and fee billing records—so all dashboard KPIs, filters, AI screening views, and exports work immediately upon launch.