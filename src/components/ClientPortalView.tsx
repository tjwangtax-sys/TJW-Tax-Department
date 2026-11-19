import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Upload,
  FileText,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import {
  MALAYSIAN_TAX_CHECKLIST,
  type ClientPortalPayload,
} from '../types/tax';

interface ClientPortalViewProps {
  accessToken: string;
  canReturnToStaff: boolean;
  onReturnToStaff: () => void;
}

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  accessToken,
  canReturnToStaff,
  onReturnToStaff,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [portal, setPortal] = useState<ClientPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('EA Form');
  const [isDragging, setIsDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/client-portal/${encodeURIComponent(accessToken)}`);
      const data = (await resp.json()) as { portal?: ClientPortalPayload; error?: string };
      if (!resp.ok || !data.portal) {
        throw new Error(
          data.error || 'Client tax book-in link not found. Please contact TJW Group Tax Department.'
        );
      }
      setPortal(data.portal);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load client portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPortal();
  }, [accessToken]);

  const handleConfirmBookIn = async () => {
    setConfirming(true);
    setError(null);
    try {
      const resp = await fetch(`/api/client-portal/${encodeURIComponent(accessToken)}/book-in`, {
        method: 'POST',
      });
      const data = (await resp.json()) as { portal?: ClientPortalPayload; error?: string };
      if (!resp.ok || !data.portal) {
        throw new Error(data.error || 'Unable to confirm book-in.');
      }
      setPortal(data.portal);
      setNotice('Thank you! Your engagement book-in has been confirmed with TJW Group Tax Department.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Book-in confirmation failed.');
    } finally {
      setConfirming(false);
    }
  };

  const uploadFiles = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      arr.forEach((f) => formData.append('files', f));
      formData.append('categoryHint', selectedCategory);

      const resp = await fetch(`/api/client-portal/${encodeURIComponent(accessToken)}/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = (await resp.json()) as {
        portal?: ClientPortalPayload;
        error?: string;
      };
      if (!resp.ok || !data.portal) {
        throw new Error(data.error || 'File upload failed.');
      }
      setPortal(data.portal);
      setNotice(
        `Uploaded ${arr.length} file(s) successfully. Our tax team has been notified for document screening.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      void uploadFiles(e.dataTransfer.files);
    }
  };

  const checklistItems = portal
    ? MALAYSIAN_TAX_CHECKLIST.filter((c) => c.forms.includes(portal.formType))
    : MALAYSIAN_TAX_CHECKLIST;

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      {/* TJW Brand Header */}
      <header className="h-14 bg-[#790D16] text-white px-6 flex items-center justify-between gap-4 border-b border-[#5E0A11]">
        <div className="font-display font-bold text-base tracking-tight whitespace-nowrap">
          TJW Group Tax Department
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-xs text-[#E5D3AF] font-mono">
            Secure Client Document Book-In Portal
          </span>
          {canReturnToStaff && (
            <button
              type="button"
              onClick={onReturnToStaff}
              className="px-3 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/25 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Staff Dashboard</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {loading ? (
          <div className="bg-white border border-[#E5E7EB] p-10 text-center text-sm text-[#57534E]">
            Loading your TJW Group tax engagement workspace...
          </div>
        ) : error && !portal ? (
          <div className="bg-white border border-[#E5E7EB] p-8 max-w-xl mx-auto">
            <h1 className="text-lg font-bold text-[#790D16] mb-2">
              Portal Link Unavailable
            </h1>
            <p className="text-sm text-[#44403C] mb-5">{error}</p>
            {canReturnToStaff && (
              <button
                type="button"
                onClick={onReturnToStaff}
                className="px-4 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] cursor-pointer"
              >
                Return to Staff Dashboard
              </button>
            )}
          </div>
        ) : portal ? (
          <>
            {/* Client Engagement Identity Banner */}
            <section className="bg-white border border-[#E5E7EB] p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#790D16]">
                    Malaysian Individual Income Tax Engagement
                  </div>
                  <h1 className="mt-1 text-2xl font-bold text-[#1C1917]">
                    {portal.clientName}
                  </h1>
                  <div className="mt-1.5 text-xs text-[#57534E] font-mono tabular-nums flex flex-wrap gap-x-3 gap-y-1">
                    <span>Ref: {portal.fileRef}</span>
                    <span>·</span>
                    <span>TIN: {portal.maskedTin}</span>
                    <span>·</span>
                    <span>Form {portal.formType}</span>
                    <span>·</span>
                    <span>Year of Assessment {portal.yearOfAssessment}</span>
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-[#F5EFE1] border border-[#E5D3AF] text-right shrink-0">
                  <div className="text-[11px] text-[#57534E]">Current Engagement Status</div>
                  <div className="text-sm font-bold text-[#790D16]">{portal.status}</div>
                </div>
              </div>
            </section>

            {notice && (
              <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] text-sm text-[#166534] flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-sm text-red-800 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Missing Documents Alert from TJW Tax Team */}
            {portal.missingItems.length > 0 && (
              <section className="bg-[#FEF2F2] border border-[#FECACA] p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#991B1B] mb-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Action Required: Missing Documents Requested by TJW Tax Team</span>
                </div>
                <p className="text-xs text-[#7F1D1D] mb-3">
                  Please upload the following outstanding items below so our team can complete your YA{' '}
                  {portal.yearOfAssessment} Form {portal.formType} computation:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-xs font-medium text-[#7F1D1D]">
                  {portal.missingItems.map((m, idx) => (
                    <li key={`${m}_${idx}`}>{m}</li>
                  ))}
                </ol>
              </section>
            )}

            {/* Step 1: Confirm Book-In */}
            <section className="bg-white border border-[#E5E7EB] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-[#790D16] font-semibold">STEP 1</div>
                  <h2 className="text-base font-bold text-[#1C1917] mt-0.5">
                    Confirm Annual Tax Engagement Book-In
                  </h2>
                  <p className="text-xs text-[#57534E] mt-1">
                    {portal.isBookedIn
                      ? `Book-in confirmed on ${portal.bookedInDate}. You may proceed to upload your tax documents below.`
                      : `Confirm that TJW Group Tax Department will prepare your YA ${portal.yearOfAssessment} Form ${portal.formType} return.`}
                  </p>
                </div>

                {portal.isBookedIn ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#ECFDF5] border border-[#BBF7D0] text-xs font-semibold text-[#166534] shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Booked-In ({portal.bookedInDate})</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={handleConfirmBookIn}
                    className="px-5 py-2.5 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 shrink-0 cursor-pointer"
                  >
                    {confirming ? 'Confirming...' : 'Confirm Engagement Book-In'}
                  </button>
                )}
              </div>
            </section>

            {/* Step 2: Document Checklist & Multi-File Uploader */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Guided Malaysian Individual Tax Checklist */}
              <div className="lg:col-span-6 bg-white border border-[#E5E7EB]">
                <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F6]">
                  <div className="text-xs font-mono text-[#790D16] font-semibold">STEP 2A</div>
                  <h2 className="text-sm font-bold text-[#1C1917]">
                    Malaysian Individual Tax Checklist (Form {portal.formType})
                  </h2>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {checklistItems.map((item) => {
                    const isSelected = selectedCategory === item.category;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCategory(item.category)}
                        className={`w-full text-left px-5 py-3.5 transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#F5EFE1]/70' : 'hover:bg-[#FAF9F6]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#1C1917]">{item.title}</span>
                          <span className="text-[11px] font-mono text-[#790D16] shrink-0">
                            {isSelected ? 'Selected' : 'Select'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#57534E] leading-relaxed">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Drag-and-Drop Multi-File Uploader & Received Files */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-white border border-[#E5E7EB] p-5 space-y-4">
                  <div>
                    <div className="text-xs font-mono text-[#790D16] font-semibold">STEP 2B</div>
                    <h2 className="text-sm font-bold text-[#1C1917]">
                      Upload Supporting Tax Documents
                    </h2>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#292524] mb-1">
                      Document Category Tag
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
                    >
                      <option value="EA Form">EA Form (CP8A) / EC Form</option>
                      <option value="Bank Statement">Bank / FD Interest Statements</option>
                      <option value="Tenancy Agreement">Tenancy Agreements &amp; Rental Receipts</option>
                      <option value="Personal Relief">Personal Tax Relief Receipts (Medical/Lifestyle/SSPN/Insurance)</option>
                      <option value="Dividend Statement">Dividend / Unit Trust Statements</option>
                      <option value="Zakat/Donation">Approved Donation &amp; Zakat Receipts</option>
                      <option value="Business Record">Business Income &amp; Expense Records (Form B)</option>
                      <option value="Other">Other Supporting Documents</option>
                    </select>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed p-7 text-center transition-colors ${
                      isDragging
                        ? 'border-[#790D16] bg-[#F5EFE1]/60'
                        : 'border-[#D6D3D1] bg-[#FAF9F6]'
                    }`}
                  >
                    <Upload className="w-7 h-7 text-[#790D16] mx-auto mb-2.5" />
                    <div className="text-sm font-semibold text-[#1C1917]">
                      {uploading
                        ? 'Uploading files securely...'
                        : 'Drag and drop PDF, JPG, or PNG files here'}
                    </div>
                    <p className="text-xs text-[#57534E] mt-1 mb-4">
                      Multiple files supported (up to 15 MB per file)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        if (e.target.files?.length) void uploadFiles(e.target.files);
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 cursor-pointer"
                    >
                      {uploading ? 'Uploading...' : 'Select Files from Device'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#57534E]">
                    <ShieldCheck className="w-4 h-4 text-[#790D16] shrink-0" />
                    <span>
                      Documents uploaded here automatically update your TJW Group file for AI screening and tax preparation.
                    </span>
                  </div>
                </div>

                {/* Live Received Documents List */}
                <div className="bg-white border border-[#E5E7EB]">
                  <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#FAF9F6] flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#1C1917]">
                      Received Documents ({portal.uploadedFiles.length})
                    </h3>
                    <span className="text-[11px] font-medium text-[#57534E]">
                      {portal.completenessStatus}
                    </span>
                  </div>
                  {portal.uploadedFiles.length === 0 ? (
                    <div className="p-5 text-xs text-[#78716C]">
                      No documents uploaded yet. Upload your EA Form and relief receipts above to begin.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB]">
                      {portal.uploadedFiles.map((f) => (
                        <div
                          key={f.id}
                          className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-[#790D16] shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-[#1C1917] truncate">
                                {f.fileName}
                              </div>
                              <div className="text-[11px] text-[#78716C] font-mono">
                                {f.categoryHint} · {(f.sizeBytes / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-[#790D16] hover:underline inline-flex items-center gap-1 shrink-0"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
};
