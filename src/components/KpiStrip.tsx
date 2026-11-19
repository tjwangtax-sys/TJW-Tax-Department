import React from 'react';
import { getStageNumber, type KpiFilterKey, type TaxJob } from '../types/tax';

interface KpiStripProps {
  jobs: TaxJob[];
  activeFilter: KpiFilterKey;
  onSelectFilter: (key: KpiFilterKey) => void;
}

export function matchesKpiFilter(job: TaxJob, filter: KpiFilterKey): boolean {
  const n = getStageNumber(job.status);
  switch (filter) {
    case 'all':
      return true;
    case 'pendingBookIn':
      return n === 1 || n === 2 || n === 3;
    case 'incompleteDocs':
      return n === 4 || n === 5;
    case 'withPic':
      return n === 6 || n === 7 || n === 8;
    case 'pendingReview':
      return n === 9 || n === 10;
    case 'pendingSignOffPayment':
      return n === 11 || n === 12 || n === 13;
    case 'completed':
      return n === 14;
    default:
      return true;
  }
}

interface KpiItem {
  key: KpiFilterKey;
  label: string;
  sublabel: string;
  accentText: string;
}

const KPI_ITEMS: KpiItem[] = [
  {
    key: 'all',
    label: 'Total Active Jobs',
    sublabel: 'All 14 stages',
    accentText: 'text-[#1C1917]',
  },
  {
    key: 'pendingBookIn',
    label: 'Pending Book-In',
    sublabel: 'Stages 1–3',
    accentText: 'text-[#790D16]',
  },
  {
    key: 'incompleteDocs',
    label: 'Screening / Incomplete',
    sublabel: 'Stages 4–5',
    accentText: 'text-[#B45309]',
  },
  {
    key: 'withPic',
    label: 'With PIC / In Progress',
    sublabel: 'Stages 6–8',
    accentText: 'text-[#1E3A5F]',
  },
  {
    key: 'pendingReview',
    label: 'Pending Review / Queries',
    sublabel: 'Stages 9–10',
    accentText: 'text-[#790D16]',
  },
  {
    key: 'pendingSignOffPayment',
    label: 'Sign-Off & Payment',
    sublabel: 'Stages 11–13',
    accentText: 'text-[#92400E]',
  },
  {
    key: 'completed',
    label: 'Submitted & Completed',
    sublabel: 'Stage 14 LHDN',
    accentText: 'text-[#15803D]',
  },
];

export const KpiStrip: React.FC<KpiStripProps> = ({
  jobs,
  activeFilter,
  onSelectFilter,
}) => {
  return (
    <section
      aria-label="Workflow KPI quick filters"
      className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 bg-white border border-[#E5E7EB] divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB]"
    >
      {KPI_ITEMS.map((item) => {
        const count = jobs.filter((j) => matchesKpiFilter(j, item.key)).length;
        const isActive = activeFilter === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectFilter(isActive && item.key !== 'all' ? 'all' : item.key)}
            className={`text-left px-4 py-3 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#790D16] ${
              isActive
                ? 'bg-[#F5EFE1] shadow-[inset_0_-2px_0_0_#790D16]'
                : 'bg-white hover:bg-[#FAF9F6]'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`font-mono tabular-nums text-2xl font-semibold leading-none ${item.accentText}`}>
                {count}
              </span>
              <span className="text-[11px] font-mono text-[#78716C] whitespace-nowrap">
                {item.sublabel}
              </span>
            </div>
            <div className="mt-1.5 text-xs font-medium text-[#292524] truncate">
              {item.label}
            </div>
          </button>
        );
      })}
    </section>
  );
};
