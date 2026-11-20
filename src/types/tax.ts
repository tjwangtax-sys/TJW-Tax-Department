export type FormType = 'BE' | 'B' | 'M';
export type YearOfAssessment = '2024' | '2025' | '2026';

export const WORKFLOW_STAGES = [
  '1. Reminder Sent',
  '2. Follow-Up Pending',
  '3. Booked-In (Awaiting Docs)',
  '4. Docs Uploaded (Screening)',
  '5. Incomplete Docs (Follow-Up)',
  '6. Docs Complete',
  '7. Assigned to PIC',
  '8. In Progress',
  '9. Pending Review',
  '10. Review Queries',
  '11. Work Done & Fee Confirmed',
  '12. Draft & Invoice Sent',
  '13. Signed & Paid',
  '14. Submitted & Completed',
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STAGES)[number];

export type WorkflowPhase =
  | 'Phase 1: Reminder & Book-In'
  | 'Phase 2: Document Collection & AI Screening'
  | 'Phase 3: Assignment, Prep & Review'
  | 'Phase 4: Billing, Sign-Off & Submission';

export function getStageNumber(status: WorkflowStatus): number {
  const idx = WORKFLOW_STAGES.indexOf(status);
  return idx >= 0 ? idx + 1 : 1;
}

export function getWorkflowPhase(status: WorkflowStatus): WorkflowPhase {
  const n = getStageNumber(status);
  if (n <= 3) return 'Phase 1: Reminder & Book-In';
  if (n <= 6) return 'Phase 2: Document Collection & AI Screening';
  if (n <= 10) return 'Phase 3: Assignment, Prep & Review';
  return 'Phase 4: Billing, Sign-Off & Submission';
}

export type CommunicationChannel = 'WhatsApp' | 'Email' | 'Phone';

export interface FollowUpLog {
  id: string;
  date: string;
  channel: CommunicationChannel;
  note: string;
  loggedBy: string;
}

export interface UploadedTaxFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storedName?: string;
  categoryHint: string;
  uploadedAt: string;
  uploadedBy: 'Client' | 'Staff';
  samplePreviewNote?: string;
}

export type BookInCategory =
  | 'EA Form'
  | 'Bank Statement'
  | 'Tenancy Agreement'
  | 'Personal Relief'
  | 'Dividend Statement'
  | 'Zakat/Donation'
  | 'Business Record'
  | 'Other';

export type VerificationStatus = 'Verified' | 'Needs Clarification' | 'Incomplete';

export interface BookInListingItem {
  id: string;
  itemNo: number;
  category: BookInCategory;
  fileName: string;
  issuer: string;
  periodOrDate: string;
  amountRM: number;
  taxRelevanceNote: string;
  confidence: 'High' | 'Medium' | 'Low';
  verificationStatus: VerificationStatus;
}

export type CompletenessStatus =
  | 'Not Uploaded'
  | 'Screening Pending'
  | 'Incomplete'
  | 'Complete';

export type ReviewStatus =
  | 'Unassigned'
  | 'In Preparation'
  | 'Pending Review'
  | 'Queries Raised'
  | 'Cleared';

export interface ReviewQuery {
  id: string;
  raisedAt: string;
  raisedBy: string;
  assignedTo: string;
  queryText: string;
  picResponse: string;
  status: 'Open' | 'Cleared';
  clearedAt: string;
}

export interface BookInSection {
  reminderSentDate: string;
  followUpCount: number;
  followUpLogs: FollowUpLog[];
  bookedInDate: string;
  isBookedIn: boolean;
}

export interface DocumentsSection {
  completenessStatus: CompletenessStatus;
  uploadedFiles: UploadedTaxFile[];
  bookInListing: BookInListingItem[];
  missingItems: string[];
  detectedReliefCategories: string[];
  screeningSummary: string;
  lastScreenedAt: string;
}

export interface AssignmentSection {
  picName: string;
  reviewerName: string;
  startedAt: string;
  targetCompletionDate: string;
  submittedForReviewAt: string;
  reviewClearedAt: string;
  reviewStatus: ReviewStatus;
  reviewQueries: ReviewQuery[];
}

export interface BillingSection {
  workDoneNotes: string;
  feeAmount: number;
  disbursements: number;
  sstAmount: number;
  totalWithTax: number;
  draftSentDate: string;
  followUpCount: number;
  followUpLogs: FollowUpLog[];
  isSignedBack: boolean;
  signedBackDate: string;
  signedCopyUrl: string;
  signedCopyFileName: string;
  isPaid: boolean;
  paymentDate: string;
  receiptRef: string;
}

export interface SubmissionSection {
  lhdnSubmissionDate: string;
  acknowledgementNo: string;
  taxPayableOrRefund: number;
  taxPosition: 'Payable' | 'Refundable' | 'Nil';
  completedAt: string;
}

export interface TaxJob {
  id: string;
  ownerUid: string;
  fileRef: string;
  clientName: string;
  icOrPassport: string;
  tinNumber: string;
  email: string;
  phone: string;
  formType: FormType;
  yearOfAssessment: YearOfAssessment;
  status: WorkflowStatus;
  portalToken: string;
  bookIn: BookInSection;
  documents: DocumentsSection;
  assignment: AssignmentSection;
  billing: BillingSection;
  submission: SubmissionSection;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClientPortalPayload {
  portalToken: string;
  jobId: string;
  fileRef: string;
  clientName: string;
  maskedTin: string;
  formType: FormType;
  yearOfAssessment: YearOfAssessment;
  status: WorkflowStatus;
  isBookedIn: boolean;
  bookedInDate: string;
  completenessStatus: CompletenessStatus;
  uploadedFiles: UploadedTaxFile[];
  missingItems: string[];
  updatedAt: string;
  icOrPassport?: string;
  phone?: string;
}

export type ColumnGroupKey =
  | 'profile'
  | 'bookIn'
  | 'documents'
  | 'picReview'
  | 'billingSubmission';

export const COLUMN_GROUP_LABELS: Record<ColumnGroupKey, string> = {
  profile: 'Client & Tax Profile',
  bookIn: 'Book-In & Follow-Up',
  documents: 'Document Screening',
  picReview: 'PIC & Review',
  billingSubmission: 'Billing & Submission',
};

export type KpiFilterKey =
  | 'all'
  | 'pendingBookIn'
  | 'incompleteDocs'
  | 'withPic'
  | 'pendingReview'
  | 'pendingSignOffPayment'
  | 'completed';

export const STAFF_PICS: string[] = ['Unassigned'];
export const STAFF_REVIEWERS: string[] = ['Unassigned'];

export const MALAYSIAN_TAX_CHECKLIST = [
  {
    id: 'ea-form',
    title: 'EA Form (CP8A) / EC Form / Commission Statements',
    description: 'Annual remuneration statement from employer(s), PCB/MTD deductions, and commission/director fee vouchers.',
    forms: ['BE', 'B', 'M'] as FormType[],
    category: 'EA Form' as BookInCategory,
  },
  {
    id: 'bank-statements',
    title: 'Bank Statements (Saving / Current / Fixed Deposit Interest)',
    description: 'Monthly statements and FD interest certificates for income verification and business/rental cashflow tracing.',
    forms: ['BE', 'B', 'M'] as FormType[],
    category: 'Bank Statement' as BookInCategory,
  },
  {
    id: 'tenancy',
    title: 'Tenancy Agreements & Rental Expense Receipts',
    description: 'Stamped tenancy agreements, assessment (cukai pintu), quit rent (cukai tanah), fire insurance, and loan interest statements.',
    forms: ['BE', 'B', 'M'] as FormType[],
    category: 'Tenancy Agreement' as BookInCategory,
  },
  {
    id: 'personal-reliefs',
    title: 'Personal Tax Relief Receipts (Section 46–49 ITA 1967)',
    description: 'Medical, Lifestyle, Education, SSPN, EPF/KWSP, Life & Medical Insurance, PRS, EV Charging, Breastfeeding & Childcare receipts.',
    forms: ['BE', 'B'] as FormType[],
    category: 'Personal Relief' as BookInCategory,
  },
  {
    id: 'dividends',
    title: 'Dividend Vouchers & Investment Income Statements',
    description: 'Unit trust distribution statements, REIT income statements, and foreign-source income remittance records.',
    forms: ['BE', 'B', 'M'] as FormType[],
    category: 'Dividend Statement' as BookInCategory,
  },
  {
    id: 'zakat-donation',
    title: 'Approved Donation & Zakat Receipts',
    description: 'Official Zakat fitrah/pendapatan receipts (rebate) and Section 44(6) LHDN-approved charitable donation receipts.',
    forms: ['BE', 'B', 'M'] as FormType[],
    category: 'Zakat/Donation' as BookInCategory,
  },
  {
    id: 'business-records',
    title: 'Business Income & Expense Records (Form B)',
    description: 'Management accounts, profit & loss statement, balance sheet, capital allowance asset invoices, and CP500 instalment receipts.',
    forms: ['B'] as FormType[],
    category: 'Business Record' as BookInCategory,
  },
];

export interface GeminiScreeningResult {
  bookInListing: Array<{
    category: BookInCategory;
    fileName: string;
    issuer: string;
    periodOrDate: string;
    amountRM: number;
    taxRelevanceNote: string;
    confidence: 'High' | 'Medium' | 'Low';
  }>;
  detectedReliefCategories: string[];
  potentialMissingItems: string[];
  screeningSummary: string;
}

export function formatRM(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `RM ${safe.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function maskTin(tin: string): string {
  const clean = tin.trim();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildPortalUrl(token: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/client-portal/${token}`;
  }
  return `/client-portal/${token}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  const normalized = digits.startsWith('0') ? `6${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function clampString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function generatePortalToken(ya: string): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `tjw_ya${ya}_${rand}`;
}
