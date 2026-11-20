import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  Plus,
  Search,
  Download,
  SlidersHorizontal,
  Send,
  LogOut,
  FileSpreadsheet,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import {
  clearAllTaxJobs,
  createTaxJob,
  rolloverTaxJobs,
  subscribeTaxJobs,
  syncPortalsWithServer,
} from './lib/taxJobService';
import {
  exportJobsToCsv,
  exportJobsToExcel,
  exportJobsToPdf,
} from './lib/exportUtils';
import {
  COLUMN_GROUP_LABELS,
  WORKFLOW_STAGES,
  buildPortalUrl,
  buildWhatsAppLink,
  getStageNumber,
  type ColumnGroupKey,
  type FormType,
  type KpiFilterKey,
  type TaxJob,
  type WorkflowStatus,
  type YearOfAssessment,
} from './types/tax';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { KpiStrip, matchesKpiFilter } from './components/KpiStrip';
import { MasterJobTable } from './components/MasterJobTable';
import { NewJobModal } from './components/NewJobModal';
import { BulkReminderModal } from './components/BulkReminderModal';
import { JobDetailDrawer } from './components/JobDetailDrawer';
import { ClientPortalView } from './components/ClientPortalView';
import { TeamAccessModal } from './components/TeamAccessModal';
import { RolloverYamodal } from './components/RolloverYamodal';

function parsePortalTokenFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/client-portal\/([a-zA-Z0-9_\-]+)\/?$/);
  return match ? match[1] : null;
}

function TaxAppContent() {
  const [portalTokenRoute, setPortalTokenRoute] = useState<string | null>(() =>
    parsePortalTokenFromPath(window.location.pathname)
  );
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const staffDisplayName = user?.displayName || user?.email || 'Tax Staff';
  const staffEmail = user?.email || '';

  // Tax Jobs State
  const [jobs, setJobs] = useState<TaxJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Filters & Table UI State (preserved when opening drawer!)
  const [kpiFilter, setKpiFilter] = useState<KpiFilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYA, setFilterYA] = useState<YearOfAssessment | 'ALL'>('ALL');
  const [filterForm, setFilterForm] = useState<FormType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<WorkflowStatus | 'ALL'>('ALL');
  const [filterPic, setFilterPic] = useState<string>('ALL');
  const [filterReviewer, setFilterReviewer] = useState<string>('ALL');
  const [myAssignedOnly, setMyAssignedOnly] = useState(false);

  const [visibleGroups, setVisibleGroups] = useState<Record<ColumnGroupKey, boolean>>({
    profile: true,
    bookIn: true,
    documents: true,
    picReview: true,
    billingSubmission: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Selection, Drawer & Modals
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [showBulkReminderModal, setShowBulkReminderModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [syncingPortals, setSyncingPortals] = useState(false);
  const [clearingTestData, setClearingTestData] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleCopyPortalLink = (job: TaxJob) => {
    const url = buildPortalUrl(job.portalToken);
    navigator.clipboard.writeText(url);
    notify(`Copied secure portal link for ${job.clientName}`);
  };

  const handleWhatsAppFollowUp = (job: TaxJob) => {
    const n = getStageNumber(job.status);
    const link = buildPortalUrl(job.portalToken);
    let msg = '';
    if (n <= 3) {
      msg = `Hi ${job.clientName}, kindly submit your LHDN tax documents for YA ${job.yearOfAssessment} via your secure TJW Group portal: ${link}`;
    } else if (n === 4 || n === 5) {
      const missing = job.documents.missingItems.length > 0 ? job.documents.missingItems.join(', ') : 'requested supporting documents';
      msg = `Hi ${job.clientName}, regarding your YA ${job.yearOfAssessment} Form ${job.formType} tax filing, please provide the following missing items: ${missing}. Portal: ${link}`;
    } else if (n >= 11 && n <= 13) {
      msg = `Hi ${job.clientName}, your YA ${job.yearOfAssessment} tax computation draft & fee invoice (RM ${job.billing.totalWithTax}) are ready for your sign-off and payment. Portal: ${link}`;
    } else {
      msg = `Hi ${job.clientName}, here is your secure TJW Group tax portal link for YA ${job.yearOfAssessment}: ${link}`;
    }
    const waUrl = buildWhatsAppLink(job.phone, msg);
    window.open(waUrl, '_blank');
  };

  const handleRollover = async (targetYA: YearOfAssessment, ids: string[]) => {
    const targets = jobs.filter((j) => ids.includes(j.id));
    if (targets.length === 0) return;
    const count = await rolloverTaxJobs(targets, targetYA, user?.uid || '');
    notify(`Successfully rolled over ${count} client engagement(s) to YA ${targetYA}.`);
    setSelectedIds(new Set());
  };

  // Sync browser popstate for SPA navigation
  useEffect(() => {
    const onPop = () => {
      setPortalTokenRoute(parsePortalTokenFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigateToClientPortal = (token: string) => {
    window.history.pushState({}, '', `/client-portal/${token}`);
    setPortalTokenRoute(token);
  };

  const navigateToStaffDashboard = () => {
    window.history.pushState({}, '', '/');
    setPortalTokenRoute(null);
  };

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscription + auto-seeding when authenticated
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setJobs([]);
      setLoadingJobs(false);
      return;
    }

    let unsub: (() => void) | null = null;
    let cancelled = false;

    const init = () => {
      setLoadingJobs(true);
      setFirestoreError(null);
      unsub = subscribeTaxJobs(
        user.uid,
        user.email,
        (incomingJobs) => {
          setJobs(incomingJobs);
          setLoadingJobs(false);
        },
        (err) => {
          setFirestoreError(err.message);
          setLoadingJobs(false);
        }
      );
    };

    init();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [authReady, user]);

  // Bidirectional sync with Client Portal store whenever jobs update or on interval
  useEffect(() => {
    if (!user || jobs.length === 0) return;

    let active = true;
    const runSync = async () => {
      try {
        const merged = await syncPortalsWithServer(jobs);
        if (active && merged > 0) {
          notify(`Synced ${merged} client portal update(s) into Firestore.`);
        }
      } catch {
        // Non-fatal background sync error
      }
    };

    void runSync();
    const timer = window.setInterval(() => {
      void runSync();
    }, 12000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user, jobs]);

  const handleManualPortalSync = async () => {
    if (!user || jobs.length === 0) return;
    setSyncingPortals(true);
    try {
      const merged = await syncPortalsWithServer(jobs);
      notify(
        merged > 0
          ? `Imported ${merged} new Client Portal update(s).`
          : 'All client portal links are up to date.'
      );
    } finally {
      setSyncingPortals(false);
    }
  };



  const handleClearAllTestData = async () => {
    if (!window.confirm('Are you sure you want to delete ALL existing tax jobs from Firestore? This will reset the app to an empty live state.')) {
      return;
    }
    setClearingTestData(true);
    setFirestoreError(null);
    try {
      const count = await clearAllTaxJobs();
      notify(`Successfully cleared ${count} tax job record(s) from Firestore.`);
    } catch (err: unknown) {
      setFirestoreError(err instanceof Error ? err.message : 'Failed to clear test data.');
    } finally {
      setClearingTestData(false);
    }
  };

  const availablePics = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => {
      if (j.assignment?.picName) s.add(j.assignment.picName);
    });
    if (s.size === 0) s.add('Unassigned');
    return Array.from(s);
  }, [jobs]);

  const availableReviewers = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => {
      if (j.assignment?.reviewerName) s.add(j.assignment.reviewerName);
    });
    if (s.size === 0) s.add('Unassigned');
    return Array.from(s);
  }, [jobs]);

  // Filtered jobs computation
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const staffNameLower = staffDisplayName.toLowerCase();
    const staffEmailUser = staffEmail.split('@')[0].toLowerCase();

    return jobs.filter((job) => {
      if (!matchesKpiFilter(job, kpiFilter)) return false;
      if (filterYA !== 'ALL' && job.yearOfAssessment !== filterYA) return false;
      if (filterForm !== 'ALL' && job.formType !== filterForm) return false;
      if (filterStatus !== 'ALL' && job.status !== filterStatus) return false;
      if (filterPic !== 'ALL' && job.assignment.picName !== filterPic) return false;
      if (filterReviewer !== 'ALL' && job.assignment.reviewerName !== filterReviewer) return false;

      if (myAssignedOnly) {
        const picLower = job.assignment.picName.toLowerCase();
        const revLower = job.assignment.reviewerName.toLowerCase();
        const matchesPic = picLower.includes(staffNameLower) || picLower.includes(staffEmailUser);
        const matchesRev = revLower.includes(staffNameLower) || revLower.includes(staffEmailUser);
        if (!matchesPic && !matchesRev) return false;
      }

      if (q) {
        const haystack = [
          job.clientName,
          job.tinNumber,
          job.icOrPassport,
          job.fileRef,
          job.email,
          job.phone,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, kpiFilter, filterYA, filterForm, filterStatus, filterPic, filterReviewer, searchQuery, myAssignedOnly, staffDisplayName, staffEmail]);

  const activeJob = useMemo(
    () => (activeJobId ? jobs.find((j) => j.id === activeJobId) || null : null),
    [jobs, activeJobId]
  );

  const selectedJobs = useMemo(
    () => jobs.filter((j) => selectedIds.has(j.id)),
    [jobs, selectedIds]
  );

  // Route 1: Standalone Client Document Book-In Portal (/client-portal/:accessToken)
  if (portalTokenRoute) {
    return (
      <ClientPortalView
        accessToken={portalTokenRoute}
        canReturnToStaff={Boolean(user)}
        onReturnToStaff={navigateToStaffDashboard}
      />
    );
  }

  // Wait for auth initialization
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center text-sm text-[#57534E]">
        Initializing TJW Group Tax Department Workspace...
      </div>
    );
  }

  // Require Staff Sign-In
  if (!user) {
    return <AuthGate />;
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const allFilteredSelected =
      filteredJobs.length > 0 && filteredJobs.every((j) => selectedIds.has(j.id));
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJobs.map((j) => j.id)));
    }
  };

  const toggleColumnGroup = (key: ColumnGroupKey) => {
    setVisibleGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetAllFilters = () => {
    setKpiFilter('all');
    setSearchQuery('');
    setFilterYA('ALL');
    setFilterForm('ALL');
    setFilterStatus('ALL');
    setFilterPic('ALL');
    setFilterReviewer('ALL');
  };

  const hasActiveFilters =
    kpiFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    filterYA !== 'ALL' ||
    filterForm !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterPic !== 'ALL' ||
    filterReviewer !== 'ALL';

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* Top Bar (Clean 3-Zone Enterprise Contract) */}
      <header className="h-14 bg-[#790D16] text-white px-5 flex items-center justify-between gap-8 border-b border-[#5E0A11] shrink-0">
        <div className="font-display font-bold text-base tracking-tight whitespace-nowrap shrink-0">
          TJW Group Tax Department
        </div>

        <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-[#F5EFE1]">
          <button
            type="button"
            onClick={() => setKpiFilter('all')}
            className={`whitespace-nowrap shrink-0 hover:text-white transition-colors cursor-pointer ${
              kpiFilter === 'all' ? 'underline underline-offset-4 text-white font-semibold' : ''
            }`}
          >
            Master Tracker
          </button>
          <button
            type="button"
            onClick={() => setKpiFilter('pendingBookIn')}
            className={`whitespace-nowrap shrink-0 hover:text-white transition-colors cursor-pointer ${
              kpiFilter === 'pendingBookIn' ? 'underline underline-offset-4 text-white font-semibold' : ''
            }`}
          >
            Book-In Queue
          </button>
          <button
            type="button"
            onClick={() => setKpiFilter('incompleteDocs')}
            className={`whitespace-nowrap shrink-0 hover:text-white transition-colors cursor-pointer ${
              kpiFilter === 'incompleteDocs' ? 'underline underline-offset-4 text-white font-semibold' : ''
            }`}
          >
            AI Screening
          </button>
          <button
            type="button"
            onClick={() => setKpiFilter('pendingReview')}
            className={`whitespace-nowrap shrink-0 hover:text-white transition-colors cursor-pointer ${
              kpiFilter === 'pendingReview' ? 'underline underline-offset-4 text-white font-semibold' : ''
            }`}
          >
            Technical Review
          </button>
          <button
            type="button"
            onClick={() => setKpiFilter('pendingSignOffPayment')}
            className={`whitespace-nowrap shrink-0 hover:text-white transition-colors cursor-pointer ${
              kpiFilter === 'pendingSignOffPayment'
                ? 'underline underline-offset-4 text-white font-semibold'
                : ''
            }`}
          >
            Billing &amp; Filing
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden md:inline text-xs text-[#E5D3AF] whitespace-nowrap truncate max-w-[180px]">
            {staffDisplayName}
          </span>
          <button
            type="button"
            onClick={() => setShowTeamModal(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/25 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Team Access</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewJobModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-[#E5D3AF] text-[#1C1917] hover:bg-[#F5EFE1] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Tax Job</span>
          </button>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            title="Sign out"
            aria-label="Sign out"
            className="p-1.5 text-[#E5D3AF] hover:text-white cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-5 py-4 space-y-3.5">
        {/* Page Heading + Toast */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#1C1917] tracking-tight">
              Individual Tax Job Management System
            </h1>
            <p className="text-xs text-[#57534E]">
              Malaysian LHDN Form BE, Form B &amp; Form M · 14-Stage Compliance Tracker · Showing{' '}
              <span className="font-mono font-semibold text-[#1C1917] tabular-nums">
                {filteredJobs.length}
              </span>{' '}
              of{' '}
              <span className="font-mono font-semibold text-[#1C1917] tabular-nums">
                {jobs.length}
              </span>{' '}
              engagements
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {toastMsg && (
              <div className="px-3 py-1.5 bg-[#ECFDF5] border border-[#BBF7D0] text-xs font-medium text-[#166534]">
                {toastMsg}
              </div>
            )}

            <button
              type="button"
              disabled={clearingTestData}
              onClick={handleClearAllTestData}
              className="px-2.5 py-1.5 text-xs font-semibold border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <span>{clearingTestData ? 'Clearing...' : 'Clear Test Data'}</span>
            </button>
            <button
              type="button"
              disabled={syncingPortals}
              onClick={handleManualPortalSync}
              className="px-2.5 py-1.5 text-xs font-medium border border-[#D6D3D1] bg-white text-[#44403C] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingPortals ? 'animate-spin' : ''}`} />
              <span>Sync Client Portals</span>
            </button>
          </div>
        </div>

        {firestoreError && (
          <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
            Firestore error: {firestoreError}
          </div>
        )}

        {/* Top 7-KPI Quick Filter Strip */}
        <KpiStrip
          jobs={jobs}
          activeFilter={kpiFilter}
          onSelectFilter={setKpiFilter}
        />

        {/* Operational Filter Toolbar + Column Toggles + Exports */}
        <div className="bg-white border border-[#E5E7EB] px-3.5 py-2.5 flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Client Name, TIN, IC/Passport, File Ref..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
            />
          </div>

          {/* YA Filter */}
          <select
            aria-label="Filter by Year of Assessment"
            value={filterYA}
            onChange={(e) => setFilterYA(e.target.value as YearOfAssessment | 'ALL')}
            className="px-2.5 py-1.5 text-xs font-mono border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
          >
            <option value="ALL">All YA</option>
            <option value="2024">YA 2024</option>
            <option value="2025">YA 2025</option>
            <option value="2026">YA 2026</option>
          </select>

          {/* Form Type Filter */}
          <select
            aria-label="Filter by Form Type"
            value={filterForm}
            onChange={(e) => setFilterForm(e.target.value as FormType | 'ALL')}
            className="px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
          >
            <option value="ALL">All Forms</option>
            <option value="BE">Form BE</option>
            <option value="B">Form B</option>
            <option value="M">Form M</option>
          </select>

          {/* Workflow Stage Filter */}
          <select
            aria-label="Filter by Workflow Stage"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as WorkflowStatus | 'ALL')}
            className="px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white max-w-[190px] focus:border-[#790D16] focus:outline-none"
          >
            <option value="ALL">All 14 Stages</option>
            {WORKFLOW_STAGES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* PIC Filter */}
          <select
            aria-label="Filter by Assigned PIC"
            value={filterPic}
            onChange={(e) => setFilterPic(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
          >
            <option value="ALL">All PICs</option>
            {availablePics.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Reviewer Filter */}
          <select
            aria-label="Filter by Reviewer"
            value={filterReviewer}
            onChange={(e) => setFilterReviewer(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-[#D6D3D1] bg-white max-w-[160px] focus:border-[#790D16] focus:outline-none"
          >
            <option value="ALL">All Reviewers</option>
            {availableReviewers.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* My Assigned Jobs Toggle */}
          <button
            type="button"
            onClick={() => setMyAssignedOnly((v) => !v)}
            className={`px-3 py-1.5 text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              myAssignedOnly
                ? 'bg-[#790D16] text-white border-[#790D16]'
                : 'bg-white text-[#44403C] border-[#D6D3D1] hover:bg-[#F5EFE1]'
            }`}
          >
            <span>My Assigned Jobs</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="px-2.5 py-1.5 text-xs font-medium text-[#790D16] hover:underline whitespace-nowrap cursor-pointer"
            >
              Reset
            </button>
          )}

          {/* Category Column Visibility Toggle Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColumnMenu((v) => !v);
                setShowExportMenu(false);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold border border-[#D6D3D1] bg-white text-[#292524] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Columns</span>
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-1 w-60 bg-white border border-[#D6D3D1] shadow-lg z-30 p-3 space-y-2">
                <div className="text-[11px] font-bold text-[#57534E] pb-1 border-b border-[#E5E7EB]">
                  Toggle Column Categories
                </div>
                {(Object.keys(COLUMN_GROUP_LABELS) as ColumnGroupKey[]).map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-xs text-[#1C1917] cursor-pointer py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={visibleGroups[key]}
                      onChange={() => toggleColumnGroup(key)}
                      className="accent-[#790D16]"
                    />
                    <span>{COLUMN_GROUP_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Batch Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowExportMenu((v) => !v);
                setShowColumnMenu(false);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold border border-[#D6D3D1] bg-white text-[#292524] hover:bg-[#F5EFE1] inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-[#D6D3D1] shadow-lg z-30 py-1">
                <button
                  type="button"
                  onClick={() => {
                    exportJobsToCsv(selectedJobs.length > 0 ? selectedJobs : filteredJobs);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-[#1C1917] hover:bg-[#F5EFE1] inline-flex items-center gap-2 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>
                    Export CSV ({selectedJobs.length > 0 ? selectedJobs.length : filteredJobs.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportJobsToExcel(selectedJobs.length > 0 ? selectedJobs : filteredJobs);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-[#1C1917] hover:bg-[#F5EFE1] inline-flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#166534]" />
                  <span>
                    Export Excel .xlsx (
                    {selectedJobs.length > 0 ? selectedJobs.length : filteredJobs.length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportJobsToPdf(selectedJobs.length > 0 ? selectedJobs : filteredJobs);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-[#1C1917] hover:bg-[#F5EFE1] inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#790D16]" />
                  <span>
                    Export PDF Report (
                    {selectedJobs.length > 0 ? selectedJobs.length : filteredJobs.length})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Action Bar (visible when >= 1 row selected) */}
        {selectedJobs.length > 0 && (
          <div className="px-4 py-2.5 bg-[#F5EFE1] border border-[#E5D3AF] flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-[#790D16]">
              {selectedJobs.length} tax engagement(s) selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkReminderModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Bulk Send Reminder</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRolloverModal(true)}
                className="px-3 py-1.5 text-xs font-semibold bg-[#1E3A5F] text-white hover:bg-[#152A45] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Rollover YA</span>
              </button>
              <button
                type="button"
                onClick={() => exportJobsToExcel(selectedJobs)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#D6D3D1] text-[#292524] hover:bg-[#FAF9F6] cursor-pointer"
              >
                Export Selected Excel
              </button>
              <button
                type="button"
                onClick={() => exportJobsToPdf(selectedJobs)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#D6D3D1] text-[#292524] hover:bg-[#FAF9F6] cursor-pointer"
              >
                Export Selected PDF
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 text-xs text-[#57534E] hover:text-[#1C1917] cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Master Job Tracker Table */}
        <MasterJobTable
          jobs={filteredJobs}
          loading={loadingJobs}
          visibleGroups={visibleGroups}
          selectedIds={selectedIds}
          activeJobId={activeJobId}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onOpenJob={(job) => setActiveJobId(job.id)}
          onOpenClientPortal={navigateToClientPortal}
          onCopyPortalLink={handleCopyPortalLink}
          onWhatsAppFollowUp={handleWhatsAppFollowUp}
          onCreateFirstJob={() => setShowNewJobModal(true)}
        />
      </main>

      {/* Modals & Slide-Over Drawer */}
      {showNewJobModal && (
        <NewJobModal
          ownerUid={user.uid}
          existingCount={jobs.length}
          onClose={() => setShowNewJobModal(false)}
          onCreate={async (input) => {
            const id = await createTaxJob(input);
            setActiveJobId(id);
            notify(`Created engagement ${input.fileRef} for ${input.clientName}.`);
          }}
        />
      )}

      {showBulkReminderModal && selectedJobs.length > 0 && (
        <BulkReminderModal
          jobs={selectedJobs}
          staffName={staffDisplayName}
          onClose={() => setShowBulkReminderModal(false)}
          onComplete={(count) => {
            setSelectedIds(new Set());
            notify(`Logged bulk reminders for ${count} client engagement(s).`);
          }}
        />
      )}

      {showTeamModal && (
        <TeamAccessModal onClose={() => setShowTeamModal(false)} onNotify={notify} />
      )}

      {showRolloverModal && selectedJobs.length > 0 && (
        <RolloverYamodal
          selectedJobs={selectedJobs}
          onClose={() => setShowRolloverModal(false)}
          onRollover={handleRollover}
        />
      )}

      {activeJob && (
        <JobDetailDrawer
          job={activeJob}
          staffName={staffDisplayName}
          onClose={() => setActiveJobId(null)}
          onOpenClientPortal={navigateToClientPortal}
          onNotify={notify}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TaxAppContent />
    </ErrorBoundary>
  );
}
