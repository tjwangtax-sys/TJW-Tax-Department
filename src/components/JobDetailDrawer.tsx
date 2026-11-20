import React, { useState } from 'react';
import { X, ExternalLink, Trash2, Copy, Check } from 'lucide-react';
import {
  buildPortalUrl,
  getStageNumber,
  getWorkflowPhase,
  WORKFLOW_STAGES,
  type TaxJob,
  type WorkflowStatus,
} from '../types/tax';
import { deleteTaxJob, updateJobStatus } from '../lib/taxJobService';
import { TabBookIn } from './drawer/TabBookIn';
import { TabDocumentScreening } from './drawer/TabDocumentScreening';
import { TabPicReview } from './drawer/TabPicReview';
import { TabBillingSignOff } from './drawer/TabBillingSignOff';
import { TabLhdnSubmission } from './drawer/TabLhdnSubmission';

export type DrawerTabKey =
  | 'bookIn'
  | 'documents'
  | 'picReview'
  | 'billing'
  | 'submission';

interface JobDetailDrawerProps {
  job: TaxJob;
  staffName: string;
  onClose: () => void;
  onOpenClientPortal: (token: string) => void;
  onNotify: (msg: string) => void;
}

const TABS: Array<{ key: DrawerTabKey; label: string }> = [
  { key: 'bookIn', label: '1. Book-In & Follow-Up' },
  { key: 'documents', label: '2. AI Screening & Listing' },
  { key: 'picReview', label: '3. PIC & Review' },
  { key: 'billing', label: '4. Work Done & Fee' },
  { key: 'submission', label: '5. LHDN Submission' },
];

function getInitialTab(status: WorkflowStatus): DrawerTabKey {
  const n = getStageNumber(status);
  if (n <= 3) return 'bookIn';
  if (n <= 6) return 'documents';
  if (n <= 10) return 'picReview';
  if (n <= 13) return 'billing';
  return 'submission';
}

export const JobDetailDrawer: React.FC<JobDetailDrawerProps> = ({
  job,
  staffName,
  onClose,
  onOpenClientPortal,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTabKey>(() => getInitialTab(job.status));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);

  const stageNum = getStageNumber(job.status);
  const phaseLabel = getWorkflowPhase(job.status);

  const handleStatusChange = async (next: WorkflowStatus) => {
    setUpdatingStage(true);
    try {
      await updateJobStatus(job.id, next);
      onNotify(`Workflow stage updated to ${next}.`);
    } finally {
      setUpdatingStage(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTaxJob(job.id);
      onNotify(`Deleted engagement ${job.fileRef}.`);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(buildPortalUrl(job.portalToken));
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      onNotify('Unable to copy link.');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Tax job details for ${job.clientName}`}
        className="relative z-10 w-[94vw] max-w-6xl h-[92vh] bg-[#F8F7F4] border border-[#D6D3D1] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Sticky Drawer Header */}
        <div className="bg-[#790D16] text-white px-6 py-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#E5D3AF] font-mono">
                <span>{job.fileRef}</span>
                <span>·</span>
                <span>Form {job.formType}</span>
                <span>·</span>
                <span>YA {job.yearOfAssessment}</span>
                <span>·</span>
                <span>TIN {job.tinNumber}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-white truncate">
                {job.clientName}
              </h2>
              <div className="mt-0.5 text-xs text-white/80 font-mono">
                IC/Passport: {job.icOrPassport} · {job.phone || 'No phone'} · {job.email || 'No email'}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyPortalLink}
                className="px-2.5 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/20 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link' : 'Copy Portal Link'}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenClientPortal(job.portalToken)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-[#E5D3AF] text-[#1C1917] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <span>Client Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close detail drawer"
                className="p-1.5 text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 14-Stage Progress Bar & Direct Stage Selector */}
          <div className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between text-[11px] text-[#E5D3AF] mb-1.5">
                <span>{phaseLabel}</span>
                <span className="font-mono tabular-nums">Stage {stageNum} / 14</span>
              </div>
              <div className="h-1.5 bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-[#E5D3AF] transition-all duration-200"
                  style={{ width: `${Math.round((stageNum / 14) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="drawer-stage-select" className="text-[11px] text-[#E5D3AF] whitespace-nowrap">
                Stage:
              </label>
              <select
                id="drawer-stage-select"
                disabled={updatingStage}
                value={job.status}
                onChange={(e) => handleStatusChange(e.target.value as WorkflowStatus)}
                className="px-2.5 py-1 text-xs font-medium bg-white text-[#1C1917] border border-white/30 focus:outline-none"
              >
                {WORKFLOW_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 5-Tab Navigation Strip */}
        <nav
          aria-label="Job detail sections"
          className="bg-white border-b border-[#E5E7EB] px-6 flex items-center gap-1 overflow-x-auto shrink-0"
        >
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`px-3.5 py-3 text-xs font-semibold whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-[#790D16] text-[#790D16]'
                    : 'border-transparent text-[#57534E] hover:text-[#1C1917]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Scrollable Active Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'bookIn' && (
            <TabBookIn job={job} staffName={staffName} onNotify={onNotify} />
          )}
          {activeTab === 'documents' && (
            <TabDocumentScreening job={job} onNotify={onNotify} />
          )}
          {activeTab === 'picReview' && (
            <TabPicReview job={job} staffName={staffName} onNotify={onNotify} />
          )}
          {activeTab === 'billing' && (
            <TabBillingSignOff job={job} staffName={staffName} onNotify={onNotify} />
          )}
          {activeTab === 'submission' && (
            <TabLhdnSubmission job={job} onNotify={onNotify} />
          )}
        </div>

        {/* Clean Footer Action Bar */}
        <div className="px-6 py-3 bg-white border-t border-[#E5E7EB] flex items-center justify-between shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#991B1B] font-medium">
                Permanently delete {job.fileRef}?
              </span>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="px-2.5 py-1 bg-[#B91C1C] text-white font-semibold hover:bg-[#991B1B] cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1 border border-[#D6D3D1] text-[#44403C] hover:bg-[#FAF9F6] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-[#78716C] hover:text-[#B91C1C] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Engagement</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold border border-[#D6D3D1] text-[#292524] hover:bg-[#FAF9F6] cursor-pointer"
          >
            Close Drawer
          </button>
        </div>
      </aside>
    </div>
  );
};
