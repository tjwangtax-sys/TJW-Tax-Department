import React, { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Send, ShieldCheck } from 'lucide-react';
import {
  todayIsoDate,
  type ReviewQuery,
  type ReviewStatus,
  type TaxJob,
  type WorkflowStatus,
} from '../../types/tax';
import { updateJobAssignment } from '../../lib/taxJobService';
import { fetchStaffUsers, type StaffUser } from '../../lib/staffService';

interface TabPicReviewProps {
  job: TaxJob;
  staffName: string;
  onNotify: (msg: string) => void;
}

export const TabPicReview: React.FC<TabPicReviewProps> = ({ job, staffName, onNotify }) => {
  const [picName, setPicName] = useState(job.assignment.picName || 'Unassigned');
  const [reviewerName, setReviewerName] = useState(job.assignment.reviewerName || 'Unassigned');
  const [startedAt, setStartedAt] = useState(job.assignment.startedAt || '');
  const [targetCompletionDate, setTargetCompletionDate] = useState(
    job.assignment.targetCompletionDate || ''
  );
  const [newQueryText, setNewQueryText] = useState('');
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  useEffect(() => {
    fetchStaffUsers()
      .then((list) => setStaffList(list.filter((s) => s.active)))
      .catch(() => {});
  }, []);

  const openCount = job.assignment.reviewQueries.filter((q) => q.status === 'Open').length;

  const saveAssignment = async (
    nextStatus: WorkflowStatus,
    nextReviewStatus: ReviewStatus,
    overrides?: Partial<TaxJob['assignment']>,
    toast?: string
  ) => {
    setSaving(true);
    try {
      await updateJobAssignment(
        job.id,
        {
          ...job.assignment,
          picName,
          reviewerName,
          startedAt,
          targetCompletionDate,
          reviewStatus: nextReviewStatus,
          ...overrides,
        },
        nextStatus
      );
      if (toast) onNotify(toast);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToPic = () =>
    saveAssignment(
      '7. Assigned to PIC',
      'Unassigned',
      undefined,
      `Assigned to ${picName} (Stage 7).`
    );

  const handleStartPreparation = () => {
    const today = todayIsoDate();
    setStartedAt(startedAt || today);
    return saveAssignment(
      '8. In Progress',
      'In Preparation',
      { startedAt: startedAt || today },
      'Tax preparation started (Stage 8: In Progress).'
    );
  };

  const handleSubmitForReview = () => {
    const today = todayIsoDate();
    return saveAssignment(
      '9. Pending Review',
      'Pending Review',
      { submittedForReviewAt: today },
      'Draft tax computation submitted for technical review (Stage 9).'
    );
  };

  const handleAddQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryText.trim()) return;
    const today = todayIsoDate();
    const newQ: ReviewQuery = {
      id: `rq_${Date.now()}`,
      raisedAt: today,
      raisedBy: reviewerName !== 'Unassigned' ? reviewerName : staffName,
      assignedTo: picName !== 'Unassigned' ? picName : 'Tax PIC',
      queryText: newQueryText.trim(),
      picResponse: '',
      status: 'Open',
      clearedAt: '',
    };
    setNewQueryText('');
    await saveAssignment(
      '10. Review Queries',
      'Queries Raised',
      {
        reviewQueries: [...job.assignment.reviewQueries, newQ],
      },
      'Review query logged — Stage 10 active.'
    );
  };

  const handleUpdateQueryResponse = async (queryId: string, response: string) => {
    const nextQueries = job.assignment.reviewQueries.map((q) =>
      q.id === queryId ? { ...q, picResponse: response } : q
    );
    await saveAssignment(job.status, job.assignment.reviewStatus, { reviewQueries: nextQueries });
  };

  const handleToggleQueryStatus = async (queryId: string) => {
    const today = todayIsoDate();
    const nextQueries = job.assignment.reviewQueries.map((q) => {
      if (q.id !== queryId) return q;
      const nextSt: 'Open' | 'Cleared' = q.status === 'Open' ? 'Cleared' : 'Open';
      return {
        ...q,
        status: nextSt,
        clearedAt: nextSt === 'Cleared' ? today : '',
      };
    });
    const remainingOpen = nextQueries.filter((q) => q.status === 'Open').length;
    await saveAssignment(
      remainingOpen > 0 ? '10. Review Queries' : '9. Pending Review',
      remainingOpen > 0 ? 'Queries Raised' : 'Pending Review',
      { reviewQueries: nextQueries },
      remainingOpen === 0 ? 'All review queries cleared — ready for Reviewer Sign-Off.' : 'Query status updated.'
    );
  };

  const handleReviewerSignOff = async () => {
    const today = todayIsoDate();
    const clearedQueries = job.assignment.reviewQueries.map((q) =>
      q.status === 'Open' ? { ...q, status: 'Cleared' as const, clearedAt: today } : q
    );
    await saveAssignment(
      '11. Work Done & Fee Confirmed',
      'Cleared',
      {
        reviewClearedAt: today,
        reviewQueries: clearedQueries,
      },
      'Reviewer technical sign-off recorded — Stage 11 (Work Done & Fee Confirmed).'
    );
  };

  const staffNames = staffList.map((s) => s.name);

  return (
    <div className="space-y-6">
      {/* Assignment Grid */}
      <div className="border border-[#E5E7EB] bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[#57534E]">
              Phase 3 · Job Assignment, Preparation &amp; Technical Review
            </div>
            <h3 className="text-sm font-bold text-[#1C1917] mt-0.5">
              PIC &amp; Reviewer Allocation
            </h3>
          </div>
          <div className="text-xs font-mono text-[#1E3A5F] bg-[#E6EFF5] border border-[#AEC4D4] px-2.5 py-1">
            Review Status: {job.assignment.reviewStatus}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Person-In-Charge (PIC)
            </label>
            <select
              value={picName}
              onChange={(e) => setPicName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
            >
              <option value="Unassigned">Unassigned</option>
              {staffNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Technical Reviewer
            </label>
            <select
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
            >
              <option value="Unassigned">Unassigned</option>
              {staffNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Job Start Date
            </label>
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292524] mb-1">
              Target Completion Date
            </label>
            <input
              type="date"
              value={targetCompletionDate}
              onChange={(e) => setTargetCompletionDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>
        </div>

        {/* Stage 7 -> 8 -> 9 -> 11 Transition Bar */}
        <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || picName === 'Unassigned'}
            onClick={handleAssignToPic}
            className="px-3 py-1.5 text-xs font-semibold border border-[#D6D3D1] bg-white text-[#292524] hover:bg-[#F5EFE1] disabled:opacity-40 cursor-pointer"
          >
            Save &amp; Assign (Stage 7)
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleStartPreparation}
            className="px-3 py-1.5 text-xs font-semibold border border-[#AEC4D4] bg-[#E6EFF5] text-[#1E3A5F] hover:bg-[#D5E5F0] cursor-pointer"
          >
            Mark In Progress (Stage 8)
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmitForReview}
            className="px-3 py-1.5 text-xs font-semibold bg-[#292524] text-white hover:bg-[#1C1917] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Submit for Review (Stage 9)</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleReviewerSignOff}
            className="ml-auto px-3.5 py-1.5 text-xs font-semibold bg-[#15803D] text-white hover:bg-[#166534] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Reviewer Sign-Off (Stage 11)</span>
          </button>
        </div>

        {(job.assignment.submittedForReviewAt || job.assignment.reviewClearedAt) && (
          <div className="text-[11px] font-mono text-[#57534E] flex flex-wrap gap-4">
            {job.assignment.submittedForReviewAt && (
              <span>Submitted for Review: {job.assignment.submittedForReviewAt}</span>
            )}
            {job.assignment.reviewClearedAt && (
              <span className="text-[#166534] font-semibold">
                Reviewer Cleared: {job.assignment.reviewClearedAt}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Review Queries Log */}
      <div className="border border-[#E5E7EB] bg-white">
        <div className="px-4 py-2.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1C1917]">
            Technical Review Queries Log ({job.assignment.reviewQueries.length} Total · {openCount}{' '}
            Open)
          </h3>
        </div>

        <form onSubmit={handleAddQuery} className="p-4 border-b border-[#E5E7EB] bg-[#FAF9F6]/50 space-y-2">
          <label className="block text-xs font-semibold text-[#292524]">
            Raise New Reviewer Query (Auto-sets Stage 10: Review Queries)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newQueryText}
              onChange={(e) => setNewQueryText(e.target.value)}
              placeholder="e.g. Confirm Section 39(1)(l) 50% entertainment add-back or verify housing loan interest certificate"
              className="flex-1 px-3 py-1.5 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving || !newQueryText.trim()}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-40 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Query</span>
            </button>
          </div>
        </form>

        {job.assignment.reviewQueries.length === 0 ? (
          <div className="p-4 text-xs text-[#78716C]">
            No technical review queries logged for this engagement.
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {job.assignment.reviewQueries.map((q, idx) => (
              <div key={q.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#1C1917]">
                      Q{idx + 1}. {q.queryText}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#78716C] font-mono">
                      Raised {q.raisedAt} by {q.raisedBy} · Assigned to {q.assignedTo}
                      {q.clearedAt ? ` · Cleared ${q.clearedAt}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleQueryStatus(q.id)}
                    className={`px-2.5 py-1 text-[11px] font-semibold border shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                      q.status === 'Cleared'
                        ? 'bg-[#ECFDF5] text-[#166534] border-[#BBF7D0]'
                        : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                    }`}
                  >
                    {q.status === 'Cleared' && <CheckCircle2 className="w-3 h-3" />}
                    {q.status}
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#57534E] mb-1">
                    PIC Resolution Note
                  </label>
                  <input
                    type="text"
                    defaultValue={q.picResponse}
                    onBlur={(e) => {
                      if (e.target.value !== q.picResponse) {
                        void handleUpdateQueryResponse(q.id, e.target.value);
                      }
                    }}
                    placeholder="Enter PIC technical response / adjustment made..."
                    className="w-full px-2.5 py-1.5 text-xs border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
