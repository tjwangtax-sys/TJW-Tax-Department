import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import type { TaxJob, YearOfAssessment } from '../types/tax';

interface RolloverYamodalProps {
  selectedJobs: TaxJob[];
  onClose: () => void;
  onRollover: (targetYA: YearOfAssessment, selectedIds: string[]) => Promise<void>;
}

export const RolloverYamodal: React.FC<RolloverYamodalProps> = ({
  selectedJobs,
  onClose,
  onRollover,
}) => {
  const [targetYA, setTargetYA] = useState<YearOfAssessment>('2026');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onRollover(
        targetYA,
        selectedJobs.map((j) => j.id)
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5E7EB] shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 bg-[#790D16] text-white flex items-center justify-between">
          <h2 className="text-base font-bold">Rollover Returning Clients to New YA</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#E5D3AF] hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-xs text-[#57534E] leading-relaxed">
            You are about to rollover <strong className="text-[#1C1917]">{selectedJobs.length}</strong> selected tax engagement(s) into a new Year of Assessment. This will create new client records with reset workflow stages, fresh portal links, and copied profile details.
          </p>

          <div>
            <label className="block text-xs font-semibold text-[#1C1917] mb-1.5">
              Target Year of Assessment (YA)
            </label>
            <select
              value={targetYA}
              onChange={(e) => setTargetYA(e.target.value as YearOfAssessment)}
              className="w-full px-3.5 py-2 text-xs font-mono border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
            >
              <option value="2024">YA 2024</option>
              <option value="2025">YA 2025</option>
              <option value="2026">YA 2026</option>
            </select>
          </div>

          <div className="max-h-48 overflow-y-auto border border-[#E5E7EB] bg-[#FAF9F6] p-3 space-y-2">
            <div className="text-[11px] font-bold text-[#57534E]">Selected Clients:</div>
            {selectedJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between text-xs bg-white p-2 border border-[#E5E7EB]">
                <div>
                  <div className="font-semibold text-[#1C1917]">{job.clientName}</div>
                  <div className="text-[11px] font-mono text-[#78716C]">{job.fileRef} · Form {job.formType} (YA {job.yearOfAssessment})</div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#790D16] shrink-0" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedJobs.length === 0}
              className="px-5 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Rolling Over...' : `Rollover ${selectedJobs.length} Client(s) to YA ${targetYA}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
