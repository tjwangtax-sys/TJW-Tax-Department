import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatRM, todayIsoDate, type TaxJob } from '../types/tax';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildJobExportRows(jobs: TaxJob[]) {
  return jobs.map((j) => ({
    'File Ref': j.fileRef,
    'Client Name': j.clientName,
    'TIN / Tax Ref': j.tinNumber,
    'IC / Passport': j.icOrPassport,
    'Form Type': `Form ${j.formType}`,
    YA: `YA ${j.yearOfAssessment}`,
    'Workflow Stage': j.status,
    'Reminder Sent': j.bookIn.reminderSentDate || '-',
    'Follow-Ups': j.bookIn.followUpCount,
    'Booked-In': j.bookIn.isBookedIn ? 'Yes' : 'No',
    'Book-In Date': j.bookIn.bookedInDate || '-',
    'Docs Uploaded': j.documents.uploadedFiles.length,
    'Docs Completeness': j.documents.completenessStatus,
    'Missing Items Count': j.documents.missingItems.length,
    'Assigned PIC': j.assignment.picName,
    Reviewer: j.assignment.reviewerName,
    'Job Start Date': j.assignment.startedAt || '-',
    'Review Status': j.assignment.reviewStatus,
    'Fee Base (RM)': j.billing.feeAmount,
    'Total Fee incl. SST (RM)': j.billing.totalWithTax,
    'Draft Sent Date': j.billing.draftSentDate || '-',
    'Signed Back': j.billing.isSignedBack ? 'Yes' : 'No',
    'Fee Paid': j.billing.isPaid ? 'Yes' : 'No',
    'LHDN Submission Date': j.submission.lhdnSubmissionDate || '-',
    'LHDN Ack No.': j.submission.acknowledgementNo || '-',
  }));
}

export function exportJobsToCsv(jobs: TaxJob[]): void {
  const rows = buildJobExportRows(jobs);
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csvLines = [
    headers.map(escape).join(','),
    ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `TJW_Individual_Tax_Jobs_${todayIsoDate()}.csv`);
}

export function exportJobsToExcel(jobs: TaxJob[]): void {
  const rows = buildJobExportRows(jobs);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tax Jobs Tracker');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `TJW_Individual_Tax_Jobs_${todayIsoDate()}.xlsx`);
}

export function exportJobsToPdf(jobs: TaxJob[]): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFillColor(121, 13, 22);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TJW GROUP TAX DEPARTMENT — INDIVIDUAL TAX JOB TRACKER', 28, 28);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${todayIsoDate()}  |  Records: ${jobs.length}`, 28, 44);

  autoTable(doc, {
    startY: 68,
    head: [
      [
        'File Ref',
        'Client Name',
        'TIN',
        'Form / YA',
        'Workflow Stage',
        'Docs',
        'PIC / Reviewer',
        'Total Fee',
        'Signed / Paid',
        'LHDN Filing',
      ],
    ],
    body: jobs.map((j) => [
      j.fileRef,
      j.clientName,
      j.tinNumber,
      `Form ${j.formType} · YA ${j.yearOfAssessment}`,
      j.status,
      `${j.documents.uploadedFiles.length} (${j.documents.completenessStatus})`,
      `${j.assignment.picName} / ${j.assignment.reviewerName}`,
      formatRM(j.billing.totalWithTax),
      `${j.billing.isSignedBack ? 'Signed' : 'Pending'} / ${j.billing.isPaid ? 'Paid' : 'Unpaid'}`,
      j.submission.lhdnSubmissionDate || '-',
    ]),
    styles: { fontSize: 7.5, cellPadding: 4 },
    headStyles: { fillColor: [121, 13, 22], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 247, 244] },
    margin: { left: 24, right: 24 },
  });

  doc.save(`TJW_Individual_Tax_Jobs_${todayIsoDate()}.pdf`);
}

export function exportBookInListingToExcel(job: TaxJob): void {
  const headerRows = [
    ['TJW GROUP TAX DEPARTMENT — DOCUMENT BOOK-IN LISTING'],
    ['Client Name', job.clientName, 'File Ref', job.fileRef],
    ['TIN / Tax Ref', job.tinNumber, 'Form & YA', `Form ${job.formType} — YA ${job.yearOfAssessment}`],
    ['Completeness Status', job.documents.completenessStatus, 'Screened Date', job.documents.lastScreenedAt || todayIsoDate()],
    [],
    [
      'Item No.',
      'Document Category',
      'File Name',
      'Issuer / Institution',
      'Period / Date',
      'Extracted Amount (RM)',
      'AI Screening Notes',
      'Verification Status',
    ],
    ...job.documents.bookInListing.map((item, idx) => [
      idx + 1,
      item.category,
      item.fileName,
      item.issuer,
      item.periodOrDate,
      item.amountRM,
      item.taxRelevanceNote,
      item.verificationStatus,
    ]),
  ];

  if (job.documents.missingItems.length > 0) {
    headerRows.push([]);
    headerRows.push(['MISSING / OUTSTANDING DOCUMENTS']);
    job.documents.missingItems.forEach((m, idx) => {
      headerRows.push([idx + 1, m]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(headerRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Book-In Listing');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = job.clientName.replace(/[^a-zA-Z0-9]+/g, '_');
  triggerDownload(blob, `TJW_BookInListing_${safeName}_YA${job.yearOfAssessment}.xlsx`);
}

export function exportBookInListingToPdf(job: TaxJob): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFillColor(121, 13, 22);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 58, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TJW GROUP TAX DEPARTMENT — DOCUMENT BOOK-IN LISTING', 28, 26);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${job.clientName}  |  TIN: ${job.tinNumber}  |  Form ${job.formType} (YA ${job.yearOfAssessment})  |  Ref: ${job.fileRef}`,
    28,
    45
  );

  autoTable(doc, {
    startY: 74,
    head: [
      [
        'No.',
        'Category',
        'File Name',
        'Issuer / Institution',
        'Period / Date',
        'Amount (RM)',
        'AI Screening Notes',
        'Verification',
      ],
    ],
    body: job.documents.bookInListing.map((item, idx) => [
      String(idx + 1),
      item.category,
      item.fileName,
      item.issuer,
      item.periodOrDate,
      formatRM(item.amountRM),
      item.taxRelevanceNote,
      item.verificationStatus,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [121, 13, 22], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 247, 244] },
    columnStyles: { 5: { halign: 'right' } },
    margin: { left: 24, right: 24 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 140;

  if (job.documents.missingItems.length > 0) {
    doc.setTextColor(121, 13, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Outstanding / Missing Documents Required:', 28, finalY + 24);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    job.documents.missingItems.forEach((m, i) => {
      doc.text(`${i + 1}. ${m}`, 36, finalY + 42 + i * 15);
    });
  }

  const safeName = job.clientName.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`TJW_BookInListing_${safeName}_YA${job.yearOfAssessment}.pdf`);
}
