import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  clampString,
  generatePortalToken,
  maskTin,
  todayIsoDate,
  type AssignmentSection,
  type BillingSection,
  type BookInSection,
  type ClientPortalPayload,
  type DocumentsSection,
  type FormType,
  type SubmissionSection,
  type TaxJob,
  type UploadedTaxFile,
  type WorkflowStatus,
  type YearOfAssessment,
} from '../types/tax';

const BOOTSTRAPPED_ADMIN_EMAILS = new Set([
  'tjwang.tax@gmail.com',
  'tjw.tax@gmail.com',
]);
const COLLECTION_NAME = 'taxJobs';

export function isBootstrappedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.has(email.trim().toLowerCase());
}


function sanitizeBookIn(b: BookInSection): BookInSection {
  return {
    reminderSentDate: clampString(b.reminderSentDate, 40),
    followUpCount: Math.max(0, Math.min(500, Math.trunc(Number(b.followUpCount) || 0))),
    followUpLogs: (Array.isArray(b.followUpLogs) ? b.followUpLogs : []).slice(0, 50).map((log) => ({
      id: clampString(log.id, 60) || `fu_${Date.now()}`,
      date: clampString(log.date, 40),
      channel: log.channel === 'Email' || log.channel === 'Phone' ? log.channel : 'WhatsApp',
      note: clampString(log.note, 500),
      loggedBy: clampString(log.loggedBy, 100),
    })),
    bookedInDate: clampString(b.bookedInDate, 40),
    isBookedIn: Boolean(b.isBookedIn),
  };
}

function sanitizeDocuments(d: DocumentsSection): DocumentsSection {
  const validStatus =
    d.completenessStatus === 'Not Uploaded' ||
    d.completenessStatus === 'Screening Pending' ||
    d.completenessStatus === 'Incomplete' ||
    d.completenessStatus === 'Complete'
      ? d.completenessStatus
      : 'Not Uploaded';

  return {
    completenessStatus: validStatus,
    uploadedFiles: (Array.isArray(d.uploadedFiles) ? d.uploadedFiles : []).slice(0, 50).map((f) => ({
      id: clampString(f.id, 60) || `file_${Date.now()}`,
      fileName: clampString(f.fileName, 160),
      mimeType: clampString(f.mimeType, 80) || 'application/pdf',
      sizeBytes: Math.max(0, Math.trunc(Number(f.sizeBytes) || 0)),
      url: clampString(f.url, 600),
      ...(f.storedName ? { storedName: clampString(f.storedName, 160) } : {}),
      categoryHint: clampString(f.categoryHint, 80) || 'Other',
      uploadedAt: clampString(f.uploadedAt, 40) || new Date().toISOString(),
      uploadedBy: f.uploadedBy === 'Client' ? 'Client' : 'Staff',
      ...(f.samplePreviewNote ? { samplePreviewNote: clampString(f.samplePreviewNote, 600) } : {}),
    })),
    bookInListing: (Array.isArray(d.bookInListing) ? d.bookInListing : []).slice(0, 100).map((item, i) => ({
      id: clampString(item.id, 60) || `bil_${Date.now()}_${i}`,
      itemNo: i + 1,
      category: item.category || 'Other',
      fileName: clampString(item.fileName, 160),
      issuer: clampString(item.issuer, 160),
      periodOrDate: clampString(item.periodOrDate, 80),
      amountRM: Number.isFinite(Number(item.amountRM)) ? Number(item.amountRM) : 0,
      taxRelevanceNote: clampString(item.taxRelevanceNote, 500),
      confidence:
        item.confidence === 'High' || item.confidence === 'Medium' || item.confidence === 'Low'
          ? item.confidence
          : 'Medium',
      verificationStatus:
        item.verificationStatus === 'Verified' ||
        item.verificationStatus === 'Needs Clarification' ||
        item.verificationStatus === 'Incomplete'
          ? item.verificationStatus
          : 'Needs Clarification',
    })),
    missingItems: (Array.isArray(d.missingItems) ? d.missingItems : [])
      .map((s) => clampString(s, 240))
      .filter(Boolean)
      .slice(0, 40),
    detectedReliefCategories: (Array.isArray(d.detectedReliefCategories) ? d.detectedReliefCategories : [])
      .map((s) => clampString(s, 120))
      .filter(Boolean)
      .slice(0, 30),
    screeningSummary: clampString(d.screeningSummary, 4000),
    lastScreenedAt: clampString(d.lastScreenedAt, 40),
  };
}

function sanitizeAssignment(a: AssignmentSection): AssignmentSection {
  const validReviewStatus =
    a.reviewStatus === 'Unassigned' ||
    a.reviewStatus === 'In Preparation' ||
    a.reviewStatus === 'Pending Review' ||
    a.reviewStatus === 'Queries Raised' ||
    a.reviewStatus === 'Cleared'
      ? a.reviewStatus
      : 'Unassigned';

  return {
    picName: clampString(a.picName, 120) || 'Unassigned',
    reviewerName: clampString(a.reviewerName, 120) || 'Unassigned',
    startedAt: clampString(a.startedAt, 40),
    targetCompletionDate: clampString(a.targetCompletionDate, 40),
    submittedForReviewAt: clampString(a.submittedForReviewAt, 40),
    reviewClearedAt: clampString(a.reviewClearedAt, 40),
    reviewStatus: validReviewStatus,
    reviewQueries: (Array.isArray(a.reviewQueries) ? a.reviewQueries : []).slice(0, 50).map((q) => ({
      id: clampString(q.id, 60) || `rq_${Date.now()}`,
      raisedAt: clampString(q.raisedAt, 40),
      raisedBy: clampString(q.raisedBy, 120),
      assignedTo: clampString(q.assignedTo, 120),
      queryText: clampString(q.queryText, 600),
      picResponse: clampString(q.picResponse, 600),
      status: q.status === 'Cleared' ? 'Cleared' : 'Open',
      clearedAt: clampString(q.clearedAt, 40),
    })),
  };
}

function sanitizeBilling(bl: BillingSection): BillingSection {
  const feeAmount = Math.max(0, Math.min(10000000, Number(bl.feeAmount) || 0));
  const disbursements = Math.max(0, Math.min(10000000, Number(bl.disbursements) || 0));
  const sstAmount = Math.max(0, Math.min(10000000, Number(bl.sstAmount) || 0));
  const totalWithTax = Math.max(0, Math.min(20000000, Number(bl.totalWithTax) || feeAmount + disbursements + sstAmount));

  return {
    workDoneNotes: clampString(bl.workDoneNotes, 4000),
    feeAmount,
    disbursements,
    sstAmount,
    totalWithTax,
    draftSentDate: clampString(bl.draftSentDate, 40),
    followUpCount: Math.max(0, Math.min(500, Math.trunc(Number(bl.followUpCount) || 0))),
    followUpLogs: (Array.isArray(bl.followUpLogs) ? bl.followUpLogs : []).slice(0, 50).map((log) => ({
      id: clampString(log.id, 60) || `bfu_${Date.now()}`,
      date: clampString(log.date, 40),
      channel: log.channel === 'Email' || log.channel === 'Phone' ? log.channel : 'WhatsApp',
      note: clampString(log.note, 500),
      loggedBy: clampString(log.loggedBy, 100),
    })),
    isSignedBack: Boolean(bl.isSignedBack),
    signedBackDate: clampString(bl.signedBackDate, 40),
    signedCopyUrl: clampString(bl.signedCopyUrl, 500),
    signedCopyFileName: clampString(bl.signedCopyFileName, 200),
    isPaid: Boolean(bl.isPaid),
    paymentDate: clampString(bl.paymentDate, 40),
    receiptRef: clampString(bl.receiptRef, 120),
  };
}

function sanitizeSubmission(s: SubmissionSection): SubmissionSection {
  const taxPosition =
    s.taxPosition === 'Payable' || s.taxPosition === 'Refundable' || s.taxPosition === 'Nil'
      ? s.taxPosition
      : 'Nil';
  return {
    lhdnSubmissionDate: clampString(s.lhdnSubmissionDate, 40),
    acknowledgementNo: clampString(s.acknowledgementNo, 120),
    taxPayableOrRefund: Math.max(-100000000, Math.min(100000000, Number(s.taxPayableOrRefund) || 0)),
    taxPosition,
    completedAt: clampString(s.completedAt, 40),
  };
}



export function subscribeTaxJobs(
  _uid: string,
  _email: string | null,
  onData: (jobs: TaxJob[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, COLLECTION_NAME);
  const q = query(colRef);

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TaxJob[] = snapshot.docs.map((d) => d.data() as TaxJob);
      items.sort((a, b) => a.fileRef.localeCompare(b.fileRef));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export interface CreateTaxJobInput {
  ownerUid: string;
  fileRef: string;
  clientName: string;
  icOrPassport: string;
  tinNumber: string;
  email: string;
  phone: string;
  formType: FormType;
  yearOfAssessment: YearOfAssessment;
  picName: string;
  reviewerName: string;
  feeAmount: number;
  sendReminderNow: boolean;
}

export async function createTaxJob(input: CreateTaxJobInput): Promise<string> {
  const currentUid = auth.currentUser?.uid || input.ownerUid;
  const cleanId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const portalToken = generatePortalToken(input.yearOfAssessment);
  const today = todayIsoDate();
  const baseFee = Math.max(0, Number(input.feeAmount) || 0);
  const sst = Number((baseFee * 0.08).toFixed(2));

  const payload: Omit<TaxJob, 'createdAt' | 'updatedAt'> = {
    id: cleanId,
    ownerUid: currentUid,
    fileRef: clampString(input.fileRef, 40) || `TJW/IND/${input.yearOfAssessment}/${cleanId.slice(-4)}`,
    clientName: clampString(input.clientName, 160),
    icOrPassport: clampString(input.icOrPassport, 40),
    tinNumber: clampString(input.tinNumber, 40),
    email: clampString(input.email, 160),
    phone: clampString(input.phone, 40),
    formType: input.formType,
    yearOfAssessment: input.yearOfAssessment,
    status: '1. Reminder Sent',
    portalToken,
    bookIn: sanitizeBookIn({
      reminderSentDate: input.sendReminderNow ? today : '',
      followUpCount: input.sendReminderNow ? 1 : 0,
      followUpLogs: input.sendReminderNow
        ? [
            {
              id: `fu_${Date.now()}`,
              date: today,
              channel: 'WhatsApp',
              note: `Initial YA ${input.yearOfAssessment} Form ${input.formType} tax reminder logged.`,
              loggedBy: input.picName !== 'Unassigned' ? input.picName : 'Tax Admin',
            },
          ]
        : [],
      bookedInDate: '',
      isBookedIn: false,
    }),
    documents: sanitizeDocuments({
      completenessStatus: 'Not Uploaded',
      uploadedFiles: [],
      bookInListing: [],
      missingItems: [],
      detectedReliefCategories: [],
      screeningSummary: '',
      lastScreenedAt: '',
    }),
    assignment: sanitizeAssignment({
      picName: input.picName || 'Unassigned',
      reviewerName: input.reviewerName || 'Unassigned',
      startedAt: '',
      targetCompletionDate: '',
      submittedForReviewAt: '',
      reviewClearedAt: '',
      reviewStatus: 'Unassigned',
      reviewQueries: [],
    }),
    billing: sanitizeBilling({
      workDoneNotes: '',
      feeAmount: baseFee,
      disbursements: 0,
      sstAmount: sst,
      totalWithTax: Number((baseFee + sst).toFixed(2)),
      draftSentDate: '',
      followUpCount: 0,
      followUpLogs: [],
      isSignedBack: false,
      signedBackDate: '',
      signedCopyUrl: '',
      signedCopyFileName: '',
      isPaid: false,
      paymentDate: '',
      receiptRef: '',
    }),
    submission: sanitizeSubmission({
      lhdnSubmissionDate: '',
      acknowledgementNo: '',
      taxPayableOrRefund: 0,
      taxPosition: 'Nil',
      completedAt: '',
    }),
  };

  const docPath = `${COLLECTION_NAME}/${cleanId}`;
  try {
    await setDoc(doc(db, COLLECTION_NAME, cleanId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return cleanId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateJobStatus(jobId: string, status: WorkflowStatus): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateJobBookIn(
  jobId: string,
  bookIn: BookInSection,
  status: WorkflowStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      bookIn: sanitizeBookIn(bookIn),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateJobDocuments(
  jobId: string,
  documents: DocumentsSection,
  status: WorkflowStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      documents: sanitizeDocuments(documents),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateJobAssignment(
  jobId: string,
  assignment: AssignmentSection,
  status: WorkflowStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      assignment: sanitizeAssignment(assignment),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateJobBilling(
  jobId: string,
  billing: BillingSection,
  status: WorkflowStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      billing: sanitizeBilling(billing),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateJobSubmission(
  jobId: string,
  submission: SubmissionSection,
  status: WorkflowStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      submission: sanitizeSubmission(submission),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateJobFromPortalSync(
  jobId: string,
  bookIn: BookInSection,
  documents: DocumentsSection,
  status: WorkflowStatus
): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      bookIn: sanitizeBookIn(bookIn),
      documents: sanitizeDocuments(documents),
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteTaxJob(jobId: string): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, jobId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

interface PendingPortalEvent {
  eventId: string;
  portalToken: string;
  jobId: string;
  type: 'book_in' | 'files_uploaded';
  bookedInDate?: string;
  newFiles?: UploadedTaxFile[];
  createdAt: string;
}

export async function syncPortalsWithServer(jobs: TaxJob[]): Promise<number> {
  if (jobs.length === 0) return 0;

  const snapshots: ClientPortalPayload[] = jobs.map((j) => ({
    portalToken: j.portalToken,
    jobId: j.id,
    fileRef: j.fileRef,
    clientName: j.clientName,
    maskedTin: maskTin(j.tinNumber),
    formType: j.formType,
    yearOfAssessment: j.yearOfAssessment,
    status: j.status,
    isBookedIn: j.bookIn.isBookedIn,
    bookedInDate: j.bookIn.bookedInDate,
    completenessStatus: j.documents.completenessStatus,
    uploadedFiles: j.documents.uploadedFiles,
    missingItems: j.documents.missingItems,
    updatedAt: new Date().toISOString(),
    icOrPassport: j.icOrPassport,
    phone: j.phone,
  }));

  const resp = await fetch('/api/portal-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshots }),
  });
  if (!resp.ok) return 0;

  const data = (await resp.json()) as { pendingEvents?: PendingPortalEvent[] };
  const events = data.pendingEvents || [];
  if (events.length === 0) return 0;

  const byJob = new Map<string, PendingPortalEvent[]>();
  for (const ev of events) {
    const list = byJob.get(ev.jobId) || [];
    list.push(ev);
    byJob.set(ev.jobId, list);
  }

  const ackIds: string[] = [];
  for (const [jobId, jobEvents] of byJob.entries()) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) continue;

    let nextBookIn = { ...job.bookIn, followUpLogs: [...job.bookIn.followUpLogs] };
    let nextDocs = { ...job.documents, uploadedFiles: [...job.documents.uploadedFiles] };
    let nextStatus = job.status;

    for (const ev of jobEvents) {
      if (ev.type === 'book_in') {
        nextBookIn.isBookedIn = true;
        nextBookIn.bookedInDate = ev.bookedInDate || todayIsoDate();
        nextBookIn.followUpLogs.push({
          id: `fu_portal_${ev.eventId}`,
          date: nextBookIn.bookedInDate,
          channel: 'Email',
          note: 'Client confirmed engagement book-in via TJW Client Portal.',
          loggedBy: 'Client Portal',
        });
        if (nextStatus === '1. Reminder Sent' || nextStatus === '2. Follow-Up Pending') {
          nextStatus = '3. Booked-In (Awaiting Docs)';
        }
      } else if (ev.type === 'files_uploaded' && ev.newFiles?.length) {
        nextBookIn.isBookedIn = true;
        nextBookIn.bookedInDate = nextBookIn.bookedInDate || ev.bookedInDate || todayIsoDate();
        const existingIds = new Set(nextDocs.uploadedFiles.map((f) => f.id));
        for (const nf of ev.newFiles) {
          if (!existingIds.has(nf.id)) {
            nextDocs.uploadedFiles.push(nf);
          }
        }
        nextDocs.completenessStatus = 'Screening Pending';
        if (
          nextStatus === '1. Reminder Sent' ||
          nextStatus === '2. Follow-Up Pending' ||
          nextStatus === '3. Booked-In (Awaiting Docs)' ||
          nextStatus === '5. Incomplete Docs (Follow-Up)'
        ) {
          nextStatus = '4. Docs Uploaded (Screening)';
        }
      }
      ackIds.push(ev.eventId);
    }

    await updateJobFromPortalSync(jobId, nextBookIn, nextDocs, nextStatus);
  }

  if (ackIds.length > 0) {
    await fetch('/api/portal-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshots: [], ackEventIds: ackIds }),
    });
  }

  return ackIds.length;
}

export async function rotateJobPortalToken(jobId: string, oldToken: string, newToken: string): Promise<void> {
  const docPath = `${COLLECTION_NAME}/${jobId}`;
  try {
    await updateDoc(doc(db, COLLECTION_NAME, jobId), {
      portalToken: newToken,
      updatedAt: serverTimestamp(),
    });
    await fetch('/api/portal-revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldToken, newToken, jobId }),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function rolloverTaxJobs(
  selectedJobs: TaxJob[],
  targetYA: YearOfAssessment,
  ownerUid: string
): Promise<number> {
  const currentUid = auth.currentUser?.uid || ownerUid;
  const stamp = Date.now().toString(36);
  const batch = writeBatch(db);
  let rolled = 0;

  for (let i = 0; i < selectedJobs.length; i++) {
    const job = selectedJobs[i];
    const cleanId = `job_rollover_${stamp}_${String(i + 1).padStart(2, '0')}`;
    const portalToken = generatePortalToken(targetYA);
    const ref = doc(db, COLLECTION_NAME, cleanId);

    const baseFee = job.billing.feeAmount || 350;
    const sst = Number((baseFee * 0.08).toFixed(2));

    const newJob: Omit<TaxJob, 'createdAt' | 'updatedAt'> = {
      id: cleanId,
      ownerUid: currentUid,
      fileRef: `${job.fileRef.split('/YA')[0]}/YA${targetYA}/${cleanId.slice(-4)}`,
      clientName: job.clientName,
      icOrPassport: job.icOrPassport,
      tinNumber: job.tinNumber,
      email: job.email,
      phone: job.phone,
      formType: job.formType,
      yearOfAssessment: targetYA,
      status: '1. Reminder Sent',
      portalToken,
      bookIn: sanitizeBookIn({
        reminderSentDate: todayIsoDate(),
        followUpCount: 1,
        followUpLogs: [
          {
            id: `fu_${Date.now()}`,
            date: todayIsoDate(),
            channel: 'WhatsApp',
            note: `Rollover engagement created for YA ${targetYA} from YA ${job.yearOfAssessment}.`,
            loggedBy: job.assignment.picName !== 'Unassigned' ? job.assignment.picName : 'Tax Admin',
          },
        ],
        bookedInDate: '',
        isBookedIn: false,
      }),
      documents: sanitizeDocuments({
        completenessStatus: 'Not Uploaded',
        uploadedFiles: [],
        bookInListing: [],
        missingItems: [],
        detectedReliefCategories: [],
        screeningSummary: '',
        lastScreenedAt: '',
      }),
      assignment: sanitizeAssignment({
        picName: job.assignment.picName,
        reviewerName: job.assignment.reviewerName,
        startedAt: '',
        targetCompletionDate: '',
        submittedForReviewAt: '',
        reviewClearedAt: '',
        reviewStatus: 'Unassigned',
        reviewQueries: [],
      }),
      billing: sanitizeBilling({
        workDoneNotes: '',
        feeAmount: baseFee,
        disbursements: 0,
        sstAmount: sst,
        totalWithTax: Number((baseFee + sst).toFixed(2)),
        draftSentDate: '',
        followUpCount: 0,
        followUpLogs: [],
        isSignedBack: false,
        signedBackDate: '',
        signedCopyUrl: '',
        signedCopyFileName: '',
        isPaid: false,
        paymentDate: '',
        receiptRef: '',
      }),
      submission: sanitizeSubmission({
        lhdnSubmissionDate: '',
        acknowledgementNo: '',
        taxPayableOrRefund: 0,
        taxPosition: 'Nil',
        completedAt: '',
      }),
    };

    batch.set(ref, {
      ...newJob,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    rolled += 1;
  }

  try {
    await batch.commit();
    return rolled;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
  }
}



