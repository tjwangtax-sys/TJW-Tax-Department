import React, { useState } from 'react';
import { X, Send, Copy, Check, ExternalLink } from 'lucide-react';
import {
  buildPortalUrl,
  buildWhatsAppLink,
  todayIsoDate,
  type CommunicationChannel,
  type TaxJob,
} from '../types/tax';
import { updateJobBookIn } from '../lib/taxJobService';

interface BulkReminderModalProps {
  jobs: TaxJob[];
  staffName: string;
  onClose: () => void;
  onComplete: (count: number) => void;
}

export const BulkReminderModal: React.FC<BulkReminderModalProps> = ({
  jobs,
  staffName,
  onClose,
  onComplete,
}) => {
  const [channel, setChannel] = useState<CommunicationChannel>('WhatsApp');
  const [note, setNote] = useState('Bulk annual Malaysian Individual Tax book-in & document reminder sent.');
  const [logging, setLogging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const composeMessage = (job: TaxJob) => {
    const portalUrl = buildPortalUrl(job.portalToken);
    return `Dear ${job.clientName}, warm greetings from TJW Group Tax Department. This is a friendly reminder to book in your YA ${job.yearOfAssessment} Form ${job.formType} Individual Tax Return (TIN: ${job.tinNumber}). Please confirm your book-in and upload your supporting documents securely here: ${portalUrl}`;
  };

  const handleCopy = async (job: TaxJob) => {
    try {
      await navigator.clipboard.writeText(composeMessage(job));
      setCopiedId(job.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleLogAllReminders = async () => {
    setLogging(true);
    setError(null);
    const today = todayIsoDate();
    let updated = 0;

    try {
      for (const job of jobs) {
        if (job.status === '14. Submitted & Completed') continue;
        const nextCount = job.bookIn.followUpCount + 1;
        const nextLogs = [
          ...job.bookIn.followUpLogs,
          {
            id: `fu_bulk_${Date.now()}_${updated}`,
            date: today,
            channel,
            note,
            loggedBy: staffName,
          },
        ];
        const nextStatus =
          job.status === '1. Reminder Sent' ? '2. Follow-Up Pending' : job.status;
        await updateJobBookIn(
          job.id,
          {
            ...job.bookIn,
            reminderSentDate: job.bookIn.reminderSentDate || today,
            followUpCount: nextCount,
            followUpLogs: nextLogs,
          },
          nextStatus
        );
        updated += 1;
      }
      onComplete(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log bulk reminders.');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl bg-white border border-[#E5E7EB] shadow-xl max-h-[88vh] flex flex-col"
      >
        <div className="px-6 py-4 bg-[#790D16] text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">
              Bulk Send &amp; Log Reminders ({jobs.length} Clients Selected)
            </h2>
            <p className="text-xs text-[#E5D3AF]">
              Each client message includes their unique tokenized Document Book-In Portal URL
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close bulk reminder dialog"
            className="p-1 text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Communication Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Audit Log Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
            {jobs.map((job) => (
              <div key={job.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#1C1917]">
                    {job.clientName}{' '}
                    <span className="font-mono text-xs font-normal text-[#78716C]">
                      · Form {job.formType} · YA {job.yearOfAssessment}
                    </span>
                  </div>
                  <div className="text-xs text-[#57534E] font-mono truncate">
                    {job.phone || 'No phone'} · {job.email || 'No email'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(job)}
                    className="px-2.5 py-1.5 text-xs font-medium border border-[#D6D3D1] text-[#292524] hover:bg-[#FAF9F6] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedId === job.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#166534]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Text
                      </>
                    )}
                  </button>
                  {job.phone && (
                    <a
                      href={buildWhatsAppLink(job.phone, composeMessage(job))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 text-xs font-medium bg-[#15803D] text-white hover:bg-[#166534] inline-flex items-center gap-1.5"
                    >
                      WhatsApp
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#44403C] border border-[#D6D3D1] hover:bg-[#FAF9F6] cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleLogAllReminders}
              disabled={logging}
              className="px-5 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 inline-flex items-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{logging ? 'Logging Follow-Ups...' : `Record Reminder Sent for All (${jobs.length})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
