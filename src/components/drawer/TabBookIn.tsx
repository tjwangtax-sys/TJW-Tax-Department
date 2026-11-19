import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  buildPortalUrl,
  buildWhatsAppLink,
  generatePortalToken,
  todayIsoDate,
  type CommunicationChannel,
  type TaxJob,
} from '../../types/tax';
import { updateJobBookIn, rotateJobPortalToken } from '../../lib/taxJobService';

interface TabBookInProps {
  job: TaxJob;
  staffName: string;
  onNotify: (msg: string) => void;
}

export const TabBookIn: React.FC<TabBookInProps> = ({ job, staffName, onNotify }) => {
  const [reminderDate, setReminderDate] = useState(job.bookIn.reminderSentDate || todayIsoDate());
  const [channel, setChannel] = useState<CommunicationChannel>('WhatsApp');
  const [logNote, setLogNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'wa' | 'link' | null>(null);

  const portalUrl = buildPortalUrl(job.portalToken);

  const handleRevokeLink = async () => {
    if (!window.confirm('Are you sure you want to revoke this portal link? The existing link will immediately stop working and a new secure link will be generated.')) {
      return;
    }
    setRevoking(true);
    try {
      const newToken = generatePortalToken(job.yearOfAssessment);
      await rotateJobPortalToken(job.id, job.portalToken, newToken);
      onNotify('Portal link successfully revoked and regenerated.');
    } catch (err) {
      onNotify('Failed to revoke portal link.');
    } finally {
      setRevoking(false);
    }
  };

  const whatsappMessage = `Dear ${job.clientName},

Warm greetings from TJW Group Tax Department.

This is a friendly reminder regarding your Malaysian Individual Income Tax Return — Form ${job.formType} for Year of Assessment (YA) ${job.yearOfAssessment} (TIN: ${job.tinNumber}).

Please click your dedicated secure link below to confirm your engagement book-in and upload your tax documents (EA Form, bank/FD statements, tenancy agreements, relief receipts & Zakat/donations):
${portalUrl}

Thank you,
TJW Group Tax Department`;

  const copyText = async (text: string, key: 'wa' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      onNotify('Unable to access clipboard in this browser.');
    }
  };

  const handleLogFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const today = todayIsoDate();
      const nextLogs = [
        ...job.bookIn.followUpLogs,
        {
          id: `fu_${Date.now()}`,
          date: today,
          channel,
          note:
            logNote.trim() ||
            `Logged ${channel} reminder for YA ${job.yearOfAssessment} Form ${job.formType}.`,
          loggedBy: staffName,
        },
      ];
      const nextStatus =
        job.status === '1. Reminder Sent' ? '2. Follow-Up Pending' : job.status;

      await updateJobBookIn(
        job.id,
        {
          ...job.bookIn,
          reminderSentDate: reminderDate || today,
          followUpCount: job.bookIn.followUpCount + 1,
          followUpLogs: nextLogs,
        },
        nextStatus
      );
      setLogNote('');
      onNotify('Follow-up reminder logged.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmBookIn = async () => {
    setSaving(true);
    try {
      const today = todayIsoDate();
      const nextLogs = [
        ...job.bookIn.followUpLogs,
        {
          id: `fu_bookin_${Date.now()}`,
          date: today,
          channel,
          note: 'Client confirmed tax engagement book-in. Client Document Upload Portal activated.',
          loggedBy: staffName,
        },
      ];
      const nextStatus =
        job.status === '1. Reminder Sent' || job.status === '2. Follow-Up Pending'
          ? '3. Booked-In (Awaiting Docs)'
          : job.status;

      await updateJobBookIn(
        job.id,
        {
          ...job.bookIn,
          reminderSentDate: reminderDate || job.bookIn.reminderSentDate || today,
          bookedInDate: job.bookIn.bookedInDate || today,
          isBookedIn: true,
          followUpLogs: nextLogs,
        },
        nextStatus
      );
      onNotify('Client book-in confirmed — Stage 3 active.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Book-In Status Banner */}
      <div className="p-4 bg-[#FAF9F6] border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#57534E]">
            Phase 1 · Book-In Confirmation
          </div>
          <div className="mt-1 text-sm font-semibold text-[#1C1917]">
            {job.bookIn.isBookedIn
              ? `Client Booked-In on ${job.bookIn.bookedInDate}`
              : 'Awaiting Client Engagement Confirmation'}
          </div>
          <div className="mt-0.5 text-xs text-[#57534E] font-mono tabular-nums">
            Initial Reminder: {job.bookIn.reminderSentDate || 'Not recorded'} · Follow-Ups Logged:{' '}
            {job.bookIn.followUpCount}
          </div>
        </div>

        {!job.bookIn.isBookedIn ? (
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmBookIn}
            className="px-4 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Client Book-In (Stage 3)</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#166534] bg-[#ECFDF5] border border-[#BBF7D0] px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Booked-In Verified</span>
          </div>
        )}
      </div>

      {/* Shareable Portal Link & WhatsApp One-Click */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[#1C1917]">
            Client Document Upload Portal &amp; WhatsApp Outreach
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={revoking}
              onClick={handleRevokeLink}
              className="px-2.5 py-1 text-xs font-semibold border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Revoke this link and generate a new secure URL if sent to wrong recipient"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${revoking ? 'animate-spin' : ''}`} />
              <span>{revoking ? 'Revoking...' : 'Revoke & New Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => copyText(portalUrl, 'link')}
              className="px-2.5 py-1 text-xs font-medium border border-[#D6D3D1] hover:bg-[#FAF9F6] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedKey === 'link' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#166534]" />
                  Portal Link Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Portal URL
                </>
              )}
            </button>
          </div>
        </div>

        <div className="px-3 py-2 bg-[#F5EFE1]/60 border border-[#E5D3AF] font-mono text-xs text-[#292524] break-all">
          {portalUrl}
        </div>

        <div className="bg-[#FAF9F6] border border-[#E5E7EB] p-3 text-xs text-[#44403C] whitespace-pre-wrap font-sans leading-relaxed">
          {whatsappMessage}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => copyText(whatsappMessage, 'wa')}
            className="px-3.5 py-2 text-xs font-semibold border border-[#790D16] text-[#790D16] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copiedKey === 'wa' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied Reminder Text
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy WhatsApp Reminder
              </>
            )}
          </button>

          <a
            href={buildWhatsAppLink(job.phone || '', whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 text-xs font-semibold bg-[#15803D] text-white hover:bg-[#166534] inline-flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open WhatsApp Web</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Record Follow-Up Form */}
      <form onSubmit={handleLogFollowUp} className="border border-[#E5E7EB] bg-white p-4 space-y-3">
        <h3 className="text-sm font-bold text-[#1C1917]">Log Reminder / Follow-Up Activity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#57534E] mb-1">
              Initial Reminder Date
            </label>
            <input
              type="date"
              value={reminderDate}
              onChange={(e) => setReminderDate(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#57534E] mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
              className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-3 py-1.5 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Log Follow-Up'}</span>
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#57534E] mb-1">Follow-Up Note</label>
          <input
            type="text"
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
            placeholder="e.g. Spoke with client — will upload EA Form and AIA statement by Friday"
            className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
          />
        </div>
      </form>

      {/* Communication History */}
      <div className="border border-[#E5E7EB] bg-white">
        <div className="px-4 py-2.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1C1917]">
            Communication &amp; Follow-Up History ({job.bookIn.followUpLogs.length})
          </h3>
        </div>
        {job.bookIn.followUpLogs.length === 0 ? (
          <div className="p-4 text-xs text-[#78716C]">No follow-up communications logged yet.</div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {[...job.bookIn.followUpLogs].reverse().map((log) => (
              <div key={log.id} className="px-4 py-2.5 flex items-start justify-between gap-4 text-xs">
                <div>
                  <div className="font-medium text-[#1C1917]">{log.note}</div>
                  <div className="mt-0.5 text-[11px] text-[#78716C]">
                    {log.channel} · Logged by {log.loggedBy}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-[#57534E] tabular-nums shrink-0">
                  {log.date}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
