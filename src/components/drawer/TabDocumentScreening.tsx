import React, { useRef, useState } from 'react';
import {
  Sparkles,
  Upload,
  FileText,
  ExternalLink,
  Download,
  Plus,
  Trash2,
  Copy,
  Check,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import {
  buildPortalUrl,
  buildWhatsAppLink,
  formatRM,
  todayIsoDate,
  type BookInCategory,
  type BookInListingItem,
  type GeminiScreeningResult,
  type TaxJob,
  type UploadedTaxFile,
  type VerificationStatus,
} from '../../types/tax';
import { updateJobDocuments } from '../../lib/taxJobService';
import {
  exportBookInListingToExcel,
  exportBookInListingToPdf,
} from '../../lib/exportUtils';

interface TabDocumentScreeningProps {
  job: TaxJob;
  onNotify: (msg: string) => void;
}

const BOOK_IN_CATEGORIES: BookInCategory[] = [
  'EA Form',
  'Bank Statement',
  'Tenancy Agreement',
  'Personal Relief',
  'Dividend Statement',
  'Zakat/Donation',
  'Business Record',
  'Other',
];

export const TabDocumentScreening: React.FC<TabDocumentScreeningProps> = ({
  job,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screening, setScreening] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newMissingItem, setNewMissingItem] = useState('');
  const [showFollowUpBox, setShowFollowUpBox] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const handleStaffFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));
      formData.append('uploadedBy', 'Staff');
      formData.append('categoryHint', 'Tax Document');

      const resp = await fetch('/api/uploads', { method: 'POST', body: formData });
      const data = (await resp.json()) as { files?: UploadedTaxFile[]; error?: string };
      if (!resp.ok || !data.files) {
        throw new Error(data.error || 'File upload failed.');
      }

      const nextFiles = [...job.documents.uploadedFiles, ...data.files];
      const nextStatus =
        job.status === '1. Reminder Sent' ||
        job.status === '2. Follow-Up Pending' ||
        job.status === '3. Booked-In (Awaiting Docs)'
          ? '4. Docs Uploaded (Screening)'
          : job.status;

      await updateJobDocuments(
        job.id,
        {
          ...job.documents,
          uploadedFiles: nextFiles,
          completenessStatus:
            job.documents.completenessStatus === 'Not Uploaded'
              ? 'Screening Pending'
              : job.documents.completenessStatus,
        },
        nextStatus
      );
      onNotify(`Uploaded ${data.files.length} document(s).`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to upload files.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunGeminiScreening = async () => {
    setScreening(true);
    setErrorMsg(null);
    try {
      const resp = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/screen-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: job.clientName,
          formType: job.formType,
          yearOfAssessment: job.yearOfAssessment,
          uploadedFiles: job.documents.uploadedFiles,
          existingMissingItems: job.documents.missingItems,
        }),
      });
      const data = (await resp.json()) as GeminiScreeningResult & { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'Gemini AI Screening request failed.');
      }

      const mappedListing: BookInListingItem[] = (data.bookInListing || []).map((item, idx) => ({
        id: `bil_ai_${Date.now()}_${idx}`,
        itemNo: idx + 1,
        category: BOOK_IN_CATEGORIES.includes(item.category) ? item.category : 'Other',
        fileName: item.fileName || `Document_${idx + 1}`,
        issuer: item.issuer || 'Not Specified',
        periodOrDate: item.periodOrDate || `YA ${job.yearOfAssessment}`,
        amountRM: Number.isFinite(Number(item.amountRM)) ? Number(item.amountRM) : 0,
        taxRelevanceNote: item.taxRelevanceNote || '',
        confidence: item.confidence || 'Medium',
        verificationStatus: item.confidence === 'High' ? 'Verified' : 'Needs Clarification',
      }));

      const missing = Array.isArray(data.potentialMissingItems) ? data.potentialMissingItems : [];
      const completeness = missing.length > 0 ? 'Incomplete' : 'Complete';
      const nextStatus =
        job.status === '1. Reminder Sent' ||
        job.status === '2. Follow-Up Pending' ||
        job.status === '3. Booked-In (Awaiting Docs)' ||
        job.status === '4. Docs Uploaded (Screening)'
          ? missing.length > 0
            ? '5. Incomplete Docs (Follow-Up)'
            : '6. Docs Complete'
          : job.status;

      await updateJobDocuments(
        job.id,
        {
          ...job.documents,
          completenessStatus: completeness,
          bookInListing: mappedListing,
          missingItems: missing,
          detectedReliefCategories: data.detectedReliefCategories || [],
          screeningSummary: data.screeningSummary || '',
          lastScreenedAt: todayIsoDate(),
        },
        nextStatus
      );
      onNotify(`Gemini AI screened ${mappedListing.length} document(s) and updated the Book-In Listing.`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gemini AI screening failed.');
    } finally {
      setScreening(false);
    }
  };

  const handleUpdateVerification = async (itemId: string, status: VerificationStatus) => {
    setSaving(true);
    try {
      const nextListing = job.documents.bookInListing.map((row) =>
        row.id === itemId ? { ...row, verificationStatus: status } : row
      );
      await updateJobDocuments(job.id, { ...job.documents, bookInListing: nextListing }, job.status);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateListingField = async (
    itemId: string,
    field: 'category' | 'issuer' | 'periodOrDate' | 'amountRM' | 'taxRelevanceNote',
    value: string | number
  ) => {
    const nextListing = job.documents.bookInListing.map((row) =>
      row.id === itemId ? { ...row, [field]: value } : row
    );
    await updateJobDocuments(job.id, { ...job.documents, bookInListing: nextListing }, job.status);
  };

  const handleAddManualListingRow = async () => {
    setSaving(true);
    try {
      const nextRow: BookInListingItem = {
        id: `bil_manual_${Date.now()}`,
        itemNo: job.documents.bookInListing.length + 1,
        category: 'Personal Relief',
        fileName: 'Manual_Entry_Receipt.pdf',
        issuer: 'Issuer / Institution',
        periodOrDate: `YA ${job.yearOfAssessment}`,
        amountRM: 0,
        taxRelevanceNote: 'Manually added by tax staff.',
        confidence: 'High',
        verificationStatus: 'Needs Clarification',
      };
      await updateJobDocuments(
        job.id,
        {
          ...job.documents,
          bookInListing: [...job.documents.bookInListing, nextRow],
        },
        job.status
      );
      onNotify('Added manual Book-In Listing row.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveListingRow = async (itemId: string) => {
    setSaving(true);
    try {
      const nextListing = job.documents.bookInListing
        .filter((r) => r.id !== itemId)
        .map((r, idx) => ({ ...r, itemNo: idx + 1 }));
      await updateJobDocuments(job.id, { ...job.documents, bookInListing: nextListing }, job.status);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMissingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMissingItem.trim()) return;
    setSaving(true);
    try {
      const nextMissing = [...job.documents.missingItems, newMissingItem.trim()];
      await updateJobDocuments(
        job.id,
        {
          ...job.documents,
          missingItems: nextMissing,
          completenessStatus: 'Incomplete',
        },
        job.status === '4. Docs Uploaded (Screening)' || job.status === '6. Docs Complete'
          ? '5. Incomplete Docs (Follow-Up)'
          : job.status
      );
      setNewMissingItem('');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMissingItem = async (index: number) => {
    setSaving(true);
    try {
      const nextMissing = job.documents.missingItems.filter((_, i) => i !== index);
      await updateJobDocuments(
        job.id,
        {
          ...job.documents,
          missingItems: nextMissing,
        },
        job.status
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetCompleteness = async (target: 'Incomplete' | 'Complete') => {
    setSaving(true);
    try {
      const nextStatus =
        target === 'Complete'
          ? '6. Docs Complete'
          : '5. Incomplete Docs (Follow-Up)';
      await updateJobDocuments(
        job.id,
        {
          ...job.documents,
          completenessStatus: target,
        },
        nextStatus
      );
      onNotify(
        target === 'Complete'
          ? 'Documents verified complete — Stage 6 active.'
          : 'Flagged as Incomplete Docs (Follow-Up) — Stage 5 active.'
      );
    } finally {
      setSaving(false);
    }
  };

  const missingFollowUpMessage = `Dear ${job.clientName},

Thank you for uploading your initial documents for YA ${job.yearOfAssessment} Form ${job.formType} (${job.fileRef}).

Following our preliminary tax screening, we kindly require the following outstanding document(s) to finalize your Malaysian Individual Tax computation:
${
  job.documents.missingItems.length > 0
    ? job.documents.missingItems.map((m, idx) => `${idx + 1}. ${m}`).join('\n')
    : '1. Supporting tax relief receipts / complete EA Form (if applicable)'
}

Please upload the above directly to your TJW Group secure client link:
${buildPortalUrl(job.portalToken)}

Best regards,
TJW Group Tax Department`;

  const totalExtractedRM = job.documents.bookInListing.reduce(
    (sum, item) => sum + (Number(item.amountRM) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Action Bar: Upload + Run Gemini AI Screening + Completeness Toggle */}
      <div className="p-4 bg-[#FAF9F6] border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-[#57534E]">
            Phase 2 · AI Document Screening &amp; Book-In Listing
          </div>
          <div className="mt-1 text-sm font-bold text-[#1C1917]">
            {job.documents.uploadedFiles.length} Uploaded File(s) · Status:{' '}
            <span
              className={
                job.documents.completenessStatus === 'Complete'
                  ? 'text-[#166534]'
                  : job.documents.completenessStatus === 'Incomplete'
                  ? 'text-[#B91C1C]'
                  : 'text-[#1E3A5F]'
              }
            >
              {job.documents.completenessStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleStaffFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-xs font-semibold border border-[#D6D3D1] bg-white text-[#292524] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Uploading...' : 'Upload Docs'}</span>
          </button>

          <button
            type="button"
            disabled={screening || job.documents.uploadedFiles.length === 0}
            onClick={handleRunGeminiScreening}
            className="px-3.5 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{screening ? 'Screening with Gemini AI...' : 'Run Gemini AI Screening'}</span>
          </button>
        </div>
      </div>

      {/* Uploaded Files List */}
      <div className="border border-[#E5E7EB] bg-white">
        <div className="px-4 py-2.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1C1917]">
            Client Uploaded Files ({job.documents.uploadedFiles.length})
          </h3>
          <span className="text-[11px] text-[#78716C]">PDF, JPG, PNG</span>
        </div>

        {job.documents.uploadedFiles.length === 0 ? (
          <div className="p-4 text-xs text-[#78716C]">
            No client files uploaded yet. Share the Client Document Book-In Portal link or upload files directly above.
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {job.documents.uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#FAF9F6]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-[#790D16] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-[#1C1917] truncate">{file.fileName}</div>
                    <div className="text-[11px] text-[#78716C] font-mono">
                      {file.categoryHint} · {(file.sizeBytes / 1024).toFixed(0)} KB · By{' '}
                      {file.uploadedBy}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 text-[11px] font-medium border border-[#D6D3D1] text-[#292524] hover:bg-[#F5EFE1] inline-flex items-center gap-1"
                  >
                    Preview
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {file.storedName && (
                    <a
                      href={`${file.url}?download=1`}
                      className="px-2 py-1 text-[11px] font-medium border border-[#D6D3D1] text-[#292524] hover:bg-[#F5EFE1] inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Screening Summary & Detected Reliefs */}
      {job.documents.screeningSummary && (
        <div className="border border-[#AEC4D4] bg-[#E6EFF5]/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E3A5F]">
              Gemini AI Tax Screening Summary
            </span>
            {job.documents.lastScreenedAt && (
              <span className="text-[11px] font-mono text-[#57534E]">
                Screened: {job.documents.lastScreenedAt}
              </span>
            )}
          </div>
          <p className="text-xs text-[#1C1917] leading-relaxed">
            {job.documents.screeningSummary}
          </p>
          {job.documents.detectedReliefCategories.length > 0 && (
            <div className="pt-1 text-[11px] text-[#1E3A5F]">
              <span className="font-semibold">Detected Tax Reliefs / Rebates:</span>{' '}
              {job.documents.detectedReliefCategories.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Document Book-In Listing Table */}
      <div className="border border-[#E5E7EB] bg-white">
        <div className="px-4 py-2.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-[#1C1917]">
              Document Book-In Listing ({job.documents.bookInListing.length} Items)
            </h3>
            <div className="text-[11px] font-mono text-[#57534E] tabular-nums">
              Total Extracted Figures: {formatRM(totalExtractedRM)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={handleAddManualListingRow}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#D6D3D1] bg-white hover:bg-[#F5EFE1] inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Add Row
            </button>
            <button
              type="button"
              disabled={job.documents.bookInListing.length === 0}
              onClick={() => exportBookInListingToExcel(job)}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#D6D3D1] bg-white hover:bg-[#F5EFE1] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3 text-[#166534]" />
              Export Excel
            </button>
            <button
              type="button"
              disabled={job.documents.bookInListing.length === 0}
              onClick={() => exportBookInListingToPdf(job)}
              className="px-2.5 py-1 text-[11px] font-semibold border border-[#D6D3D1] bg-white hover:bg-[#F5EFE1] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3 text-[#790D16]" />
              Export PDF
            </button>
          </div>
        </div>

        {job.documents.bookInListing.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#78716C]">
            Click <strong className="text-[#790D16]">Run Gemini AI Screening</strong> to automatically classify uploaded documents and populate this Book-In Listing table.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs min-w-[780px]">
              <thead className="bg-[#FAF9F6] border-b border-[#E5E7EB] text-[11px] font-semibold text-[#44403C]">
                <tr>
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">File Name &amp; Issuer</th>
                  <th className="px-3 py-2">Period / Date</th>
                  <th className="px-3 py-2 text-right">Amount (RM)</th>
                  <th className="px-3 py-2">AI Screening Notes</th>
                  <th className="px-3 py-2">Verification</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {job.documents.bookInListing.map((row, idx) => (
                  <tr key={row.id} className="align-top hover:bg-[#FAF9F6]">
                    <td className="px-3 py-2 font-mono text-[#78716C] tabular-nums">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category}
                        onChange={(e) =>
                          handleUpdateListingField(row.id, 'category', e.target.value)
                        }
                        className="px-1.5 py-1 text-[11px] font-medium border border-[#D6D3D1] bg-white"
                      >
                        {BOOK_IN_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[#1C1917] break-all">{row.fileName}</div>
                      <input
                        type="text"
                        defaultValue={row.issuer}
                        onBlur={(e) => {
                          if (e.target.value !== row.issuer) {
                            void handleUpdateListingField(row.id, 'issuer', e.target.value);
                          }
                        }}
                        className="mt-1 w-full px-1.5 py-0.5 text-[11px] text-[#57534E] border border-transparent hover:border-[#D6D3D1] focus:border-[#790D16] focus:outline-none bg-transparent"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#44403C] whitespace-nowrap">
                      {row.periodOrDate}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-medium text-[#1C1917] whitespace-nowrap">
                      {formatRM(row.amountRM)}
                    </td>
                    <td className="px-3 py-2 text-[11.5px] text-[#44403C] max-w-[220px]">
                      {row.taxRelevanceNote}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.verificationStatus}
                        onChange={(e) =>
                          handleUpdateVerification(
                            row.id,
                            e.target.value as VerificationStatus
                          )
                        }
                        className={`px-2 py-1 text-[11px] font-semibold border ${
                          row.verificationStatus === 'Verified'
                            ? 'bg-[#ECFDF5] text-[#166534] border-[#BBF7D0]'
                            : row.verificationStatus === 'Incomplete'
                            ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                            : 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                        }`}
                      >
                        <option value="Verified">Verified</option>
                        <option value="Needs Clarification">Needs Clarification</option>
                        <option value="Incomplete">Incomplete</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveListingRow(row.id)}
                        aria-label="Remove listing row"
                        className="p-1 text-[#A8A29E] hover:text-[#B91C1C] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Missing Documents Checklist + Status Toggle */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1C1917]">
            Missing / Outstanding Documents Checklist ({job.documents.missingItems.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSetCompleteness('Incomplete')}
              className={`px-3 py-1.5 text-xs font-semibold border cursor-pointer ${
                job.documents.completenessStatus === 'Incomplete'
                  ? 'bg-[#FEF2F2] text-[#991B1B] border-[#DC2626]'
                  : 'bg-white text-[#57534E] border-[#D6D3D1] hover:bg-[#FAF9F6]'
              }`}
            >
              Flag Incomplete (Stage 5)
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSetCompleteness('Complete')}
              className={`px-3 py-1.5 text-xs font-semibold border inline-flex items-center gap-1.5 cursor-pointer ${
                job.documents.completenessStatus === 'Complete'
                  ? 'bg-[#ECFDF5] text-[#166534] border-[#16A34A]'
                  : 'bg-white text-[#57534E] border-[#D6D3D1] hover:bg-[#FAF9F6]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Docs Complete (Stage 6)
            </button>
          </div>
        </div>

        {job.documents.missingItems.length > 0 ? (
          <ul className="divide-y divide-[#E5E7EB] border border-[#E5E7EB]">
            {job.documents.missingItems.map((item, idx) => (
              <li
                key={`${item}_${idx}`}
                className="px-3 py-2 flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-[#292524]">
                  <span className="font-mono text-[#790D16] mr-2">{idx + 1}.</span>
                  {item}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveMissingItem(idx)}
                  aria-label="Remove missing item"
                  className="text-[#A8A29E] hover:text-[#B91C1C] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-[#78716C]">
            No missing documents flagged. All mandatory files appear accounted for.
          </div>
        )}

        <form onSubmit={handleAddMissingItem} className="flex items-center gap-2">
          <input
            type="text"
            value={newMissingItem}
            onChange={(e) => setNewMissingItem(e.target.value)}
            placeholder="Add missing document (e.g. KWSP/EPF 2025 Statement, Stamped Tenancy Agreement)"
            className="flex-1 px-3 py-1.5 text-xs border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving || !newMissingItem.trim()}
            className="px-3 py-1.5 text-xs font-semibold bg-[#292524] text-white hover:bg-[#1C1917] disabled:opacity-40 cursor-pointer"
          >
            Add Missing Item
          </button>
        </form>

        <div className="pt-2 border-t border-[#E5E7EB] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFollowUpBox((v) => !v)}
            className="px-3.5 py-1.5 text-xs font-semibold border border-[#790D16] text-[#790D16] hover:bg-[#F5EFE1] cursor-pointer"
          >
            {showFollowUpBox
              ? 'Hide Missing Docs Follow-Up Message'
              : 'Generate Missing Docs Follow-Up Message'}
          </button>

          {showFollowUpBox && (
            <>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(missingFollowUpMessage);
                  setCopiedMsg(true);
                  setTimeout(() => setCopiedMsg(false), 1800);
                }}
                className="px-3 py-1.5 text-xs font-medium border border-[#D6D3D1] hover:bg-[#FAF9F6] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {copiedMsg ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#166534]" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Message
                  </>
                )}
              </button>
              <a
                href={buildWhatsAppLink(job.phone || '', missingFollowUpMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-semibold bg-[#15803D] text-white hover:bg-[#166534] inline-flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Send via WhatsApp
              </a>
            </>
          )}
        </div>

        {showFollowUpBox && (
          <pre className="p-3 bg-[#FAF9F6] border border-[#E5E7EB] text-xs font-sans text-[#292524] whitespace-pre-wrap leading-relaxed">
            {missingFollowUpMessage}
          </pre>
        )}
      </div>
    </div>
  );
};
