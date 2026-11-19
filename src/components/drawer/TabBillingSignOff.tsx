import React, { useRef, useState } from 'react';
import {
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Upload,
  Send,
  FileCheck2,
  CreditCard,
} from 'lucide-react';
import {
  buildWhatsAppLink,
  formatRM,
  todayIsoDate,
  type CommunicationChannel,
  type TaxJob,
  type UploadedTaxFile,
  type WorkflowStatus,
} from '../../types/tax';
import { updateJobBilling } from '../../lib/taxJobService';

interface TabBillingSignOffProps {
  job: TaxJob;
  staffName: string;
  onNotify: (msg: string) => void;
}

export const TabBillingSignOff: React.FC<TabBillingSignOffProps> = ({
  job,
  staffName,
  onNotify,
}) => {
  const signedInputRef = useRef<HTMLInputElement>(null);
  const [workDoneNotes, setWorkDoneNotes] = useState(job.billing.workDoneNotes || '');
  const [feeAmount, setFeeAmount] = useState(String(job.billing.feeAmount || 0));
  const [disbursements, setDisbursements] = useState(String(job.billing.disbursements || 0));
  const [sstAmount, setSstAmount] = useState(String(job.billing.sstAmount || 0));
  const [draftSentDate, setDraftSentDate] = useState(job.billing.draftSentDate || '');
  const [isSignedBack, setIsSignedBack] = useState(job.billing.isSignedBack);
  const [signedBackDate, setSignedBackDate] = useState(job.billing.signedBackDate || '');
  const [isPaid, setIsPaid] = useState(job.billing.isPaid);
  const [paymentDate, setPaymentDate] = useState(job.billing.paymentDate || '');
  const [receiptRef, setReceiptRef] = useState(job.billing.receiptRef || '');

  const [fuChannel, setFuChannel] = useState<CommunicationChannel>('WhatsApp');
  const [fuNote, setFuNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingSigned, setUploadingSigned] = useState(false);
  const [copiedCover, setCopiedCover] = useState(false);

  const numFee = Number(feeAmount) || 0;
  const numDisb = Number(disbursements) || 0;
  const numSst = Number(sstAmount) || 0;
  const totalFee = Number((numFee + numDisb + numSst).toFixed(2));

  const coverNoteText = `TJW GROUP TAX DEPARTMENT — WORK DONE & FEE COVER NOTE

Client: ${job.clientName}
TIN / Tax Ref: ${job.tinNumber}
Engagement: Malaysian Individual Tax Return — Form ${job.formType} (YA ${job.yearOfAssessment})
File Ref: ${job.fileRef}

Scope of Work Completed:
${
  workDoneNotes.trim() ||
  `Preparation and technical review of YA ${job.yearOfAssessment} Form ${job.formType} individual income tax computation, relief optimization, and e-Filing draft package.`
}

Professional Fee Summary:
• Professional Tax Compliance Fee: ${formatRM(numFee)}
• Disbursements / Printing: ${formatRM(numDisb)}
• Service Tax (SST 8%): ${formatRM(numSst)}
• Total Payable: ${formatRM(totalFee)}

Next Steps Prior to LHDN MyTax e-Filing:
1. Kindly review and return the signed Draft Tax Return & e-Filing Authorization.
2. Kindly remit the total professional fee of ${formatRM(totalFee)} and share your payment slip.

Upon receipt of both your signed authorization and fee settlement, our team will proceed with LHDN MyTax submission and provide your official e-Filing Acknowledgement Receipt.

Warm regards,
TJW Group Tax Department`;

  const persistBilling = async (
    targetStatus?: WorkflowStatus,
    overrides?: Partial<TaxJob['billing']>,
    toast?: string
  ) => {
    setSaving(true);
    try {
      const nextSigned = overrides?.isSignedBack ?? isSignedBack;
      const nextPaid = overrides?.isPaid ?? isPaid;
      const computedStatus: WorkflowStatus =
        targetStatus ||
        (nextSigned && nextPaid
          ? '13. Signed & Paid'
          : draftSentDate
          ? '12. Draft & Invoice Sent'
          : '11. Work Done & Fee Confirmed');

      await updateJobBilling(
        job.id,
        {
          ...job.billing,
          workDoneNotes,
          feeAmount: numFee,
          disbursements: numDisb,
          sstAmount: numSst,
          totalWithTax: totalFee,
          draftSentDate,
          isSignedBack: nextSigned,
          signedBackDate: nextSigned ? signedBackDate || todayIsoDate() : '',
          isPaid: nextPaid,
          paymentDate: nextPaid ? paymentDate || todayIsoDate() : '',
          receiptRef,
          ...overrides,
        },
        job.status === '14. Submitted & Completed' ? job.status : computedStatus
      );
      if (toast) onNotify(toast);
    } finally {
      setSaving(false);
    }
  };

  const handleDispatchDraftAndInvoice = () => {
    const today = todayIsoDate();
    setDraftSentDate(today);
    const nextLogs = [
      ...job.billing.followUpLogs,
      {
        id: `bfu_${Date.now()}`,
        date: today,
        channel: 'Email' as CommunicationChannel,
        note: `Dispatched YA ${job.yearOfAssessment} Draft Form ${job.formType} & Fee Note (${formatRM(totalFee)}).`,
        loggedBy: staffName,
      },
    ];
    return persistBilling(
      '12. Draft & Invoice Sent',
      {
        draftSentDate: today,
        followUpCount: job.billing.followUpCount + 1,
        followUpLogs: nextLogs,
      },
      'Draft return & fee note recorded as sent (Stage 12).'
    );
  };

  const handleUploadSignedCopy = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSigned(true);
    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('uploadedBy', 'Staff');
      formData.append('categoryHint', 'Signed Authorization');
      const resp = await fetch('/api/uploads', { method: 'POST', body: formData });
      const data = (await resp.json()) as { files?: UploadedTaxFile[]; error?: string };
      if (!resp.ok || !data.files?.[0]) {
        throw new Error(data.error || 'Signed copy upload failed.');
      }
      const uploaded = data.files[0];
      const today = todayIsoDate();
      setIsSignedBack(true);
      setSignedBackDate(today);
      await persistBilling(
        undefined,
        {
          isSignedBack: true,
          signedBackDate: today,
          signedCopyUrl: uploaded.url,
          signedCopyFileName: uploaded.fileName,
        },
        'Signed draft copy uploaded and verified.'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Unable to upload signed copy.');
    } finally {
      setUploadingSigned(false);
      if (signedInputRef.current) signedInputRef.current.value = '';
    }
  };

  const handleLogBillingFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = todayIsoDate();
    const nextLogs = [
      ...job.billing.followUpLogs,
      {
        id: `bfu_${Date.now()}`,
        date: today,
        channel: fuChannel,
        note: fuNote.trim() || 'Followed up on signed draft authorization & professional fee settlement.',
        loggedBy: staffName,
      },
    ];
    setFuNote('');
    await persistBilling(
      undefined,
      {
        followUpCount: job.billing.followUpCount + 1,
        followUpLogs: nextLogs,
      },
      'Billing follow-up logged.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Work Done & Fee Computation */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[#57534E]">
              Phase 4 · Work Done Summary &amp; Professional Fee Billing
            </div>
            <h3 className="text-sm font-bold text-[#1C1917] mt-0.5">
              Fee Breakdown (MYR / RM)
            </h3>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[#78716C]">Total Payable</div>
            <div className="text-lg font-bold font-mono tabular-nums text-[#790D16]">
              {formatRM(totalFee)}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#292524] mb-1">
            Work Done Summary (for Client Cover Note &amp; Invoice)
          </label>
          <textarea
            rows={3}
            value={workDoneNotes}
            onChange={(e) => setWorkDoneNotes(e.target.value)}
            placeholder="Summarize tax schedules prepared (EA Form, rental computation, relief optimization, business P&L adjustments)..."
            className="w-full px-3 py-2 text-xs border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Base Fee (RM)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={feeAmount}
              onChange={(e) => {
                setFeeAmount(e.target.value);
                const val = Number(e.target.value) || 0;
                setSstAmount((val * 0.08).toFixed(2));
              }}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Disbursements (RM)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={disbursements}
              onChange={(e) => setDisbursements(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              SST 8% (RM)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={sstAmount}
              onChange={(e) => setSstAmount(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Draft &amp; Fee Sent Date
            </label>
            <input
              type="date"
              value={draftSentDate}
              onChange={(e) => setDraftSentDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E7EB]">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              persistBilling(
                '11. Work Done & Fee Confirmed',
                undefined,
                'Work done & fee saved (Stage 11).'
              )
            }
            className="px-3.5 py-1.5 text-xs font-semibold border border-[#D6D3D1] bg-white hover:bg-[#F5EFE1] cursor-pointer"
          >
            Confirm Fee (Stage 11)
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleDispatchDraftAndInvoice}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Mark Draft &amp; Invoice Sent (Stage 12)</span>
          </button>
        </div>
      </div>

      {/* Formatted Cover Note Preview */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-bold text-[#1C1917]">
            Formatted Work Done &amp; Fee Cover Note
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(coverNoteText);
                setCopiedCover(true);
                setTimeout(() => setCopiedCover(false), 1800);
              }}
              className="px-2.5 py-1 text-xs font-semibold border border-[#790D16] text-[#790D16] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedCover ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCover ? 'Copied Note' : 'Copy Cover Note'}</span>
            </button>
            <a
              href={buildWhatsAppLink(job.phone || '', coverNoteText)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs font-semibold bg-[#15803D] text-white hover:bg-[#166534] inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
        <pre className="p-3 bg-[#FAF9F6] border border-[#E5E7EB] text-xs font-sans text-[#292524] whitespace-pre-wrap leading-relaxed">
          {coverNoteText}
        </pre>
      </div>

      {/* Client Sign-Off & Fee Payment Tracking (Stage 13 Gate) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Signed Draft */}
        <div className="border border-[#E5E7EB] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1C1917]">
              <FileCheck2 className="w-4 h-4 text-[#790D16]" />
              <span>Client Signed Draft Authorization</span>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#292524] cursor-pointer">
            <input
              type="checkbox"
              checked={isSignedBack}
              onChange={(e) => {
                setIsSignedBack(e.target.checked);
                if (e.target.checked && !signedBackDate) setSignedBackDate(todayIsoDate());
              }}
              className="w-4 h-4 accent-[#790D16]"
            />
            <span className="font-medium">Signed Draft &amp; e-Filing Authorization Received</span>
          </label>

          <div>
            <label className="block text-[11px] text-[#57534E] mb-1">Signed Date</label>
            <input
              type="date"
              value={signedBackDate}
              onChange={(e) => setSignedBackDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={signedInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleUploadSignedCopy}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingSigned}
              onClick={() => signedInputRef.current?.click()}
              className="px-3 py-1.5 text-xs font-medium border border-[#D6D3D1] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingSigned ? 'Uploading...' : 'Upload Signed Copy'}</span>
            </button>

            {job.billing.signedCopyUrl && (
              <a
                href={job.billing.signedCopyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#790D16] hover:underline inline-flex items-center gap-1 truncate"
              >
                <span className="truncate max-w-[160px]">
                  {job.billing.signedCopyFileName || 'View Signed Copy'}
                </span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>
        </div>

        {/* Fee Payment */}
        <div className="border border-[#E5E7EB] bg-white p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1C1917]">
            <CreditCard className="w-4 h-4 text-[#790D16]" />
            <span>Service Fee Collection</span>
          </div>

          <label className="flex items-center gap-2.5 text-xs text-[#292524] cursor-pointer">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => {
                setIsPaid(e.target.checked);
                if (e.target.checked && !paymentDate) setPaymentDate(todayIsoDate());
              }}
              className="w-4 h-4 accent-[#790D16]"
            />
            <span className="font-medium">Professional Fee Payment Received</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[#57534E] mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#57534E] mb-1">Receipt / OR Ref</label>
              <input
                type="text"
                value={receiptRef}
                onChange={(e) => setReceiptRef(e.target.value)}
                placeholder="OR-2026-0192"
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() =>
              persistBilling(
                isSignedBack && isPaid ? '13. Signed & Paid' : undefined,
                undefined,
                isSignedBack && isPaid
                  ? 'Client Signed & Paid recorded — Stage 13 active (ready for LHDN e-Filing).'
                  : 'Sign-off & payment status updated.'
              )
            }
            className="w-full px-3 py-1.5 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 cursor-pointer"
          >
            {isSignedBack && isPaid
              ? 'Save & Advance to Stage 13 (Signed & Paid)'
              : 'Save Sign-Off & Payment Details'}
          </button>
        </div>
      </div>

      {/* Billing Follow-Up Log */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-3">
        <h3 className="text-xs font-bold text-[#1C1917]">
          Draft &amp; Fee Collection Follow-Up Log ({job.billing.followUpLogs.length})
        </h3>
        <form onSubmit={handleLogBillingFollowUp} className="flex flex-wrap gap-2">
          <select
            value={fuChannel}
            onChange={(e) => setFuChannel(e.target.value as CommunicationChannel)}
            className="px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white"
          >
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">Email</option>
            <option value="Phone">Phone</option>
          </select>
          <input
            type="text"
            value={fuNote}
            onChange={(e) => setFuNote(e.target.value)}
            placeholder="Follow-up note for signed return / fee remittance..."
            className="flex-1 min-w-[200px] px-2.5 py-1.5 text-xs border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold bg-[#292524] text-white hover:bg-[#1C1917] cursor-pointer"
          >
            Log Follow-Up
          </button>
        </form>

        {job.billing.followUpLogs.length > 0 && (
          <div className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB] pt-1">
            {[...job.billing.followUpLogs].reverse().map((l) => (
              <div key={l.id} className="py-2 flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="text-[#1C1917]">{l.note}</div>
                  <div className="text-[11px] text-[#78716C]">
                    {l.channel} · {l.loggedBy}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[#57534E] tabular-nums">{l.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
