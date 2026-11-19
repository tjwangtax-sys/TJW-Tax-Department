import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, Landmark } from 'lucide-react';
import { formatRM, todayIsoDate, type TaxJob } from '../../types/tax';
import { updateJobSubmission } from '../../lib/taxJobService';

interface TabLhdnSubmissionProps {
  job: TaxJob;
  onNotify: (msg: string) => void;
}

export const TabLhdnSubmission: React.FC<TabLhdnSubmissionProps> = ({ job, onNotify }) => {
  const [lhdnDate, setLhdnDate] = useState(job.submission.lhdnSubmissionDate || todayIsoDate());
  const [ackNo, setAckNo] = useState(job.submission.acknowledgementNo || '');
  const [taxPosition, setTaxPosition] = useState<'Payable' | 'Refundable' | 'Nil'>(
    job.submission.taxPosition || 'Payable'
  );
  const [taxAmount, setTaxAmount] = useState(String(job.submission.taxPayableOrRefund || 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readinessChecks = [
    {
      label: 'Client Documents Complete & Verified',
      passed: job.documents.completenessStatus === 'Complete',
    },
    {
      label: 'Technical Reviewer Sign-Off Cleared',
      passed: job.assignment.reviewStatus === 'Cleared',
    },
    {
      label: 'Signed Draft Authorization Received from Client',
      passed: job.billing.isSignedBack,
    },
    {
      label: 'Professional Fee Settled & Receipted',
      passed: job.billing.isPaid,
    },
  ];

  const isCompleted = job.status === '14. Submitted & Completed';

  const handleMarkCompleted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lhdnDate || !ackNo.trim()) {
      setError('Please enter both LHDN Submission Date and MyTax/e-Filing Acknowledgement No.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const today = todayIsoDate();
      await updateJobSubmission(
        job.id,
        {
          lhdnSubmissionDate: lhdnDate,
          acknowledgementNo: ackNo.trim(),
          taxPosition,
          taxPayableOrRefund: Number(taxAmount) || 0,
          completedAt: today,
        },
        '14. Submitted & Completed'
      );
      onNotify('LHDN e-Filing submission recorded — Job marked Completed (Stage 14).');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save submission.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pre-Submission Compliance Gate */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-3">
        <div className="text-xs font-bold text-[#1C1917]">
          Pre-Submission LHDN Compliance Readiness
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {readinessChecks.map((item) => (
            <div
              key={item.label}
              className={`px-3 py-2 border text-xs flex items-center gap-2 ${
                item.passed
                  ? 'bg-[#ECFDF5] border-[#BBF7D0] text-[#166534]'
                  : 'bg-[#FAF9F6] border-[#E5E7EB] text-[#78716C]'
              }`}
            >
              {item.passed ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706]" />
              )}
              <span className="font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Submission Details Form */}
      <form
        onSubmit={handleMarkCompleted}
        className="border border-[#E5E7EB] bg-white p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-[#790D16]" />
            <h3 className="text-sm font-bold text-[#1C1917]">
              LHDN MyTax / e-Filing Submission &amp; Closure
            </h3>
          </div>
          {isCompleted && (
            <span className="px-2.5 py-1 text-xs font-semibold bg-[#ECFDF5] text-[#166534] border border-[#BBF7D0]">
              Filed &amp; Completed
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              LHDN e-Filing Submission Date *
            </label>
            <input
              type="date"
              required
              value={lhdnDate}
              onChange={(e) => setLhdnDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              e-Filing / MyTax Acknowledgement No. *
            </label>
            <input
              type="text"
              required
              value={ackNo}
              onChange={(e) => setAckNo(e.target.value)}
              placeholder={`e-${job.formType}${job.yearOfAssessment}-0084927163`}
              className="w-full px-3 py-2 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Final Tax Position
            </label>
            <select
              value={taxPosition}
              onChange={(e) =>
                setTaxPosition(e.target.value as 'Payable' | 'Refundable' | 'Nil')
              }
              className="w-full px-3 py-2 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
            >
              <option value="Payable">Tax Payable to LHDN</option>
              <option value="Refundable">Tax Refundable by LHDN</option>
              <option value="Nil">Nil Tax Position</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Tax Payable / Refundable Amount (RM)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
        </div>

        <div className="p-3 bg-[#F5EFE1]/70 border border-[#E5D3AF] text-xs text-[#292524] flex flex-wrap items-center justify-between gap-2">
          <span>
            Form {job.formType} · YA {job.yearOfAssessment} · TIN{' '}
            <strong className="font-mono">{job.tinNumber}</strong>
          </span>
          <span className="font-mono font-semibold tabular-nums">
            {taxPosition}: {formatRM(Number(taxAmount) || 0)}
          </span>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-xs font-semibold bg-[#15803D] text-white hover:bg-[#166534] disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {saving
                ? 'Recording Closure...'
                : isCompleted
                ? 'Update Submission Details'
                : 'Mark Job Completed (Stage 14)'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
