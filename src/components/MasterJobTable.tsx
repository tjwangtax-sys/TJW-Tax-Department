import React from 'react';
import {
  CheckSquare,
  Square,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Check,
  Minus,
} from 'lucide-react';
import {
  formatRM,
  getStageNumber,
  type ColumnGroupKey,
  type TaxJob,
  type WorkflowStatus,
} from '../types/tax';

interface MasterJobTableProps {
  jobs: TaxJob[];
  loading: boolean;
  visibleGroups: Record<ColumnGroupKey, boolean>;
  selectedIds: Set<string>;
  activeJobId: string | null;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenJob: (job: TaxJob) => void;
  onOpenClientPortal: (token: string) => void;
  onCreateFirstJob: () => void;
}

function getStatusAccent(status: WorkflowStatus): { bg: string; text: string; border: string } {
  const n = getStageNumber(status);
  if (n === 14) {
    return { bg: 'bg-[#ECFDF5]', text: 'text-[#166534]', border: 'border-[#BBF7D0]' };
  }
  if (n === 5 || n === 10) {
    return { bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]', border: 'border-[#FECACA]' };
  }
  if (n === 12 || n === 13 || n === 11) {
    return { bg: 'bg-[#F5EFE1]', text: 'text-[#790D16]', border: 'border-[#E5D3AF]' };
  }
  if (n >= 6 && n <= 9) {
    return { bg: 'bg-[#E6EFF5]', text: 'text-[#1E3A5F]', border: 'border-[#AEC4D4]' };
  }
  return { bg: 'bg-[#F5F5F4]', text: 'text-[#44403C]', border: 'border-[#D6D3D1]' };
}

export const MasterJobTable: React.FC<MasterJobTableProps> = ({
  jobs,
  loading,
  visibleGroups,
  selectedIds,
  activeJobId,
  onToggleSelect,
  onToggleSelectAll,
  onOpenJob,
  onOpenClientPortal,
  onCreateFirstJob,
}) => {
  const allSelected = jobs.length > 0 && jobs.every((j) => selectedIds.has(j.id));

  if (loading) {
    return (
      <div className="bg-white border border-[#E5E7EB]">
        <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAF9F6] text-xs font-medium text-[#57534E]">
          Loading TJW Group Individual Tax engagements from Firestore...
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-11 px-4 flex items-center gap-4 animate-pulse">
              <div className="w-4 h-4 bg-[#E7E5E4]" />
              <div className="w-28 h-3 bg-[#E7E5E4]" />
              <div className="w-44 h-3 bg-[#E7E5E4]" />
              <div className="w-28 h-3 bg-[#E7E5E4]" />
              <div className="w-40 h-3 bg-[#E7E5E4]" />
              <div className="flex-1 h-3 bg-[#F5F5F4]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="bg-white border border-[#E5E7EB] p-12 text-center">
        <h3 className="text-base font-semibold text-[#1C1917] mb-1">
          No tax jobs match the current filters
        </h3>
        <p className="text-sm text-[#57534E] mb-5">
          Adjust your Year of Assessment, Form Type, PIC, or search query, or create a new Malaysian individual tax engagement.
        </p>
        <button
          type="button"
          onClick={onCreateFirstJob}
          className="px-4 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] transition-colors cursor-pointer"
        >
          + New Tax Job
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E7EB] overflow-hidden flex flex-col">
      <div className="overflow-auto max-h-[calc(100vh-305px)]">
        <table className="w-full border-collapse text-left min-w-[1060px]">
          <thead className="sticky top-0 z-20 bg-[#FAF9F6] border-b border-[#D6D3D1]">
            {/* Category group super-header */}
            <tr className="border-b border-[#E5E7EB] text-[10px] font-semibold tracking-wider text-[#57534E]">
              <th className="w-10 px-3 py-1.5 bg-[#FAF9F6]" />
              {visibleGroups.profile && (
                <th
                  colSpan={4}
                  className="px-3 py-1.5 border-l border-[#E5E7EB] bg-[#F5EFE1]/60 text-[#790D16]"
                >
                  Client &amp; Tax Profile
                </th>
              )}
              <th className="px-3 py-1.5 border-l border-[#E5E7EB] bg-[#FAF9F6] text-[#1C1917]">
                Workflow Stage
              </th>
              {visibleGroups.bookIn && (
                <th
                  colSpan={3}
                  className="px-3 py-1.5 border-l border-[#E5E7EB] bg-[#FAF9F6] text-[#57534E]"
                >
                  Book-In &amp; Follow-Up
                </th>
              )}
              {visibleGroups.documents && (
                <th
                  colSpan={3}
                  className="px-3 py-1.5 border-l border-[#E5E7EB] bg-[#E6EFF5]/45 text-[#1E3A5F]"
                >
                  Document Screening
                </th>
              )}
              {visibleGroups.picReview && (
                <th
                  colSpan={4}
                  className="px-3 py-1.5 border-l border-[#E5E7EB] bg-[#FAF9F6] text-[#57534E]"
                >
                  PIC &amp; Review
                </th>
              )}
              {visibleGroups.billingSubmission && (
                <th
                  colSpan={5}
                  className="px-3 py-1.5 border-l border-[#E5E7EB] bg-[#F5EFE1]/60 text-[#790D16]"
                >
                  Billing &amp; Submission
                </th>
              )}
              <th className="w-16 px-3 py-1.5 border-l border-[#E5E7EB] bg-[#FAF9F6] text-right">
                Action
              </th>
            </tr>

            {/* Column labels */}
            <tr className="text-[11px] font-semibold text-[#44403C] bg-[#FAF9F6]">
              <th className="w-10 px-3 py-2">
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  aria-label="Select all filtered jobs"
                  className="text-[#57534E] hover:text-[#790D16] flex items-center cursor-pointer"
                >
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-[#790D16]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>

              {visibleGroups.profile && (
                <>
                  <th className="px-3 py-2 border-l border-[#E5E7EB] whitespace-nowrap">
                    Client Name / Ref
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap">TIN / Tax Ref</th>
                  <th className="px-3 py-2 whitespace-nowrap">IC / Passport</th>
                  <th className="px-3 py-2 whitespace-nowrap">Form · YA</th>
                </>
              )}

              <th className="px-3 py-2 border-l border-[#E5E7EB] whitespace-nowrap">
                Current Stage (1–14)
              </th>

              {visibleGroups.bookIn && (
                <>
                  <th className="px-3 py-2 border-l border-[#E5E7EB] whitespace-nowrap">
                    Reminder Sent
                  </th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">F/Up</th>
                  <th className="px-3 py-2 whitespace-nowrap">Book-In</th>
                </>
              )}

              {visibleGroups.documents && (
                <>
                  <th className="px-3 py-2 border-l border-[#E5E7EB] text-right whitespace-nowrap">
                    Files
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap">Completeness</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Missing</th>
                </>
              )}

              {visibleGroups.picReview && (
                <>
                  <th className="px-3 py-2 border-l border-[#E5E7EB] whitespace-nowrap">
                    Assigned PIC
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap">Reviewer</th>
                  <th className="px-3 py-2 whitespace-nowrap">Start Date</th>
                  <th className="px-3 py-2 whitespace-nowrap">Review Status</th>
                </>
              )}

              {visibleGroups.billingSubmission && (
                <>
                  <th className="px-3 py-2 border-l border-[#E5E7EB] text-right whitespace-nowrap">
                    Fee (RM)
                  </th>
                  <th className="px-3 py-2 whitespace-nowrap">Draft Sent</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">Signed</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">Paid</th>
                  <th className="px-3 py-2 whitespace-nowrap">LHDN Filing</th>
                </>
              )}

              <th className="px-3 py-2 border-l border-[#E5E7EB] text-right whitespace-nowrap">
                Open
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E5E7EB] text-[12.5px]">
            {jobs.map((job) => {
              const isSelected = selectedIds.has(job.id);
              const isActive = activeJobId === job.id;
              const statusStyle = getStatusAccent(job.status);
              const openQueriesCount = job.assignment.reviewQueries.filter(
                (q) => q.status === 'Open'
              ).length;

              return (
                <tr
                  key={job.id}
                  onClick={() => onOpenJob(job)}
                  className={`transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F5EFE1]/80'
                      : isSelected
                      ? 'bg-[#FAF5EB]'
                      : 'bg-white hover:bg-[#FAF9F6]'
                  }`}
                >
                  <td
                    className="px-3 py-2 align-middle"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(job.id);
                    }}
                  >
                    <button
                      type="button"
                      aria-label={`Select ${job.clientName}`}
                      className="text-[#57534E] hover:text-[#790D16] flex items-center cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#790D16]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>

                  {visibleGroups.profile && (
                    <>
                      <td className="px-3 py-2 border-l border-[#F0EFEA] align-middle">
                        <div className="font-semibold text-[#1C1917] leading-tight whitespace-nowrap">
                          {job.clientName}
                        </div>
                        <div className="text-[11px] font-mono text-[#78716C] tabular-nums">
                          {job.fileRef}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-[#292524] tabular-nums whitespace-nowrap align-middle">
                        {job.tinNumber}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-[#57534E] tabular-nums whitespace-nowrap align-middle">
                        {job.icOrPassport}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle text-[#292524]">
                        <span className="font-semibold text-[#790D16]">Form {job.formType}</span>
                        <span className="mx-1.5 text-[#A8A29E]">·</span>
                        <span className="font-mono tabular-nums">YA {job.yearOfAssessment}</span>
                      </td>
                    </>
                  )}

                  <td className="px-3 py-2 border-l border-[#F0EFEA] whitespace-nowrap align-middle">
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] font-medium border rounded-[2px] ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      {job.status}
                    </span>
                  </td>

                  {visibleGroups.bookIn && (
                    <>
                      <td className="px-3 py-2 border-l border-[#F0EFEA] font-mono text-[12px] text-[#57534E] tabular-nums whitespace-nowrap align-middle">
                        {job.bookIn.reminderSentDate || '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-[#292524] tabular-nums whitespace-nowrap align-middle">
                        {job.bookIn.followUpCount}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        {job.bookIn.isBookedIn ? (
                          <div className="text-[12px] text-[#166534] font-medium">
                            Booked-In
                            <span className="ml-1.5 font-mono text-[11px] text-[#57534E] tabular-nums">
                              {job.bookIn.bookedInDate}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#92400E]">Awaiting</span>
                        )}
                      </td>
                    </>
                  )}

                  {visibleGroups.documents && (
                    <>
                      <td className="px-3 py-2 border-l border-[#F0EFEA] text-right font-mono tabular-nums text-[#1C1917] whitespace-nowrap align-middle">
                        {job.documents.uploadedFiles.length}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        <span
                          className={`text-[12px] font-medium ${
                            job.documents.completenessStatus === 'Complete'
                              ? 'text-[#166534]'
                              : job.documents.completenessStatus === 'Incomplete'
                              ? 'text-[#B91C1C]'
                              : job.documents.completenessStatus === 'Screening Pending'
                              ? 'text-[#1E3A5F]'
                              : 'text-[#78716C]'
                          }`}
                        >
                          {job.documents.completenessStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap align-middle">
                        {job.documents.missingItems.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[#B91C1C] font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {job.documents.missingItems.length}
                          </span>
                        ) : (
                          <span className="text-[#A8A29E]">0</span>
                        )}
                      </td>
                    </>
                  )}

                  {visibleGroups.picReview && (
                    <>
                      <td className="px-3 py-2 border-l border-[#F0EFEA] whitespace-nowrap align-middle text-[#292524]">
                        {job.assignment.picName === 'Unassigned' ? (
                          <span className="text-[#A8A29E]">Unassigned</span>
                        ) : (
                          job.assignment.picName
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle text-[#57534E]">
                        {job.assignment.reviewerName === 'Unassigned' ? (
                          <span className="text-[#A8A29E]">Unassigned</span>
                        ) : (
                          job.assignment.reviewerName.replace(/ \(.*\)/, '')
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-[#57534E] tabular-nums whitespace-nowrap align-middle">
                        {job.assignment.startedAt || '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap align-middle">
                        <span
                          className={`text-[12px] font-medium ${
                            job.assignment.reviewStatus === 'Cleared'
                              ? 'text-[#166534]'
                              : job.assignment.reviewStatus === 'Queries Raised'
                              ? 'text-[#B91C1C]'
                              : job.assignment.reviewStatus === 'Pending Review'
                              ? 'text-[#790D16]'
                              : 'text-[#57534E]'
                          }`}
                        >
                          {job.assignment.reviewStatus}
                          {openQueriesCount > 0 ? ` (${openQueriesCount} open)` : ''}
                        </span>
                      </td>
                    </>
                  )}

                  {visibleGroups.billingSubmission && (
                    <>
                      <td className="px-3 py-2 border-l border-[#F0EFEA] text-right font-mono tabular-nums font-medium text-[#1C1917] whitespace-nowrap align-middle">
                        {formatRM(job.billing.totalWithTax)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-[#57534E] tabular-nums whitespace-nowrap align-middle">
                        {job.billing.draftSentDate || '—'}
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        {job.billing.isSignedBack ? (
                          <Check className="w-4 h-4 text-[#166534] inline" aria-label="Signed back" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-[#D6D3D1] inline" aria-label="Not signed" />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        {job.billing.isPaid ? (
                          <Check className="w-4 h-4 text-[#166534] inline" aria-label="Fee paid" />
                        ) : (
                          <Minus className="w-3.5 h-3.5 text-[#D6D3D1] inline" aria-label="Unpaid" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] tabular-nums whitespace-nowrap align-middle">
                        {job.submission.lhdnSubmissionDate ? (
                          <span className="text-[#166534] font-medium">
                            {job.submission.lhdnSubmissionDate}
                          </span>
                        ) : (
                          <span className="text-[#A8A29E]">Pending</span>
                        )}
                      </td>
                    </>
                  )}

                  <td
                    className="px-3 py-2 border-l border-[#F0EFEA] text-right whitespace-nowrap align-middle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenClientPortal(job.portalToken)}
                        title="Open Client Document Book-In Portal"
                        className="p-1 text-[#57534E] hover:text-[#790D16] hover:bg-[#F5EFE1] transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenJob(job)}
                        title="Open 5-Tab Job Detail Drawer"
                        className="p-1 text-[#57534E] hover:text-[#790D16] hover:bg-[#F5EFE1] transition-colors cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
