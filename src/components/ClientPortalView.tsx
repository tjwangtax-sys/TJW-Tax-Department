import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Upload,
  FileText,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Camera,
  Lock,
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

type Lang = 'en' | 'zh';

const DICT = {
  en: {
    headerTitle: 'TJW Group Tax Department',
    headerSub: 'Secure Client Document Book-In Portal',
    staffDash: 'Staff Dashboard',
    verifyTitle: 'Privacy & Identity Verification',
    verifyPrompt: 'For data privacy and security, please enter the last 4 digits of your IC / Passport or registered Phone Number to access your tax portal:',
    verifyPlaceholder: 'e.g. 5821 or 4412',
    verifyBtn: 'Access Secure Portal',
    verifyError: 'Please enter at least 3 characters for verification.',
    lockedErr: 'Portal link is locked due to too many failed verification attempts. Please contact TJW Group.',
    refLabel: 'Ref:',
    tinLabel: 'TIN:',
    formLabel: 'Form',
    yaLabel: 'YA',
    statusLabel: 'Current Status:',
    actionRequired: 'Action Required: Missing Documents Requested by TJW Tax Team',
    actionPrompt: 'Please upload the following outstanding items below so our team can complete your return:',
    step1Tag: 'STEP 1',
    step1Title: 'Confirm Annual Tax Engagement Book-In',
    step1Desc: 'Confirm that TJW Group Tax Department will prepare your tax return.',
    confirmBtn: 'Confirm Engagement Book-In',
    confirmedBadge: 'Booked-In Verified',
    step2Tag: 'STEP 2',
    step2Title: 'Malaysian Individual Tax Checklist',
    step2SubTag: 'STEP 3',
    uploadTitle: 'Upload Supporting Tax Documents',
    categoryTag: 'Document Category Tag',
    dragText: 'Tap to capture or drop PDF, JPG, PNG files',
    subDrag: 'Mobile camera capture supported (capture="environment")',
    selectDevice: 'Select Files or Take Photo',
    receivedDocs: 'Received Documents',
    securityNote: 'Documents uploaded here automatically update your TJW Group file for AI screening and tax preparation.',
  },
  zh: {
    headerTitle: 'TJW 集团税务部',
    headerSub: '客户安全税务资料提交门户',
    staffDash: '员工工作台',
    verifyTitle: '隐私与身份验证',
    verifyPrompt: '为了保护您的数据隐私与安全，请输入您的身份证/护照后4位数字或登记的电话号码以访问您的税务门户：',
    verifyPlaceholder: '例如：5821 或 4412',
    verifyBtn: '进入安全门户',
    verifyError: '请输入至少3个字符进行验证。',
    lockedErr: '由于验证失败次数过多，此链接已被锁定。请联系 TJW 集团。',
    refLabel: '档案编号：',
    tinLabel: '税务识别号 (TIN)：',
    formType: '表格',
    yaLabel: '评估年 (YA)',
    statusLabel: '当前进度：',
    actionRequired: '需要注意：TJW 税务团队请求补充文件',
    actionPrompt: '请在下方上传以下所需文件，以便我们的团队完成您的报税表：',
    step1Tag: '第一步',
    step1Title: '确认税务委托书',
    step1Desc: '确认委托 TJW 集团税务部为您办理个人所得税申报。',
    confirmBtn: '确认委托',
    confirmedBadge: '已确认委托',
    step2Tag: '第二步',
    step2Title: '马来西亚个人所得税清单',
    step2SubTag: '第三步',
    uploadTitle: '上传支持性税务文件',
    categoryTag: '文件类别标签',
    dragText: '点击拍摄或拖放 PDF、JPG、PNG 文件',
    subDrag: '支持手机相机直接拍摄 (capture="environment")',
    selectDevice: '从设备选择或拍照',
    receivedDocs: '已收到的文件',
    securityNote: '此处上传的文件将自动更新至您的 TJW 集团税务档案，以供 AI 智能审查与报税使用。',
  },
};

export const ClientPortalView: React.FC<ClientPortalViewProps> = ({
  accessToken,
  canReturnToStaff,
  onReturnToStaff,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('lang=zh')) {
      return 'zh';
    }
    return 'en';
  });

  const [portal, setPortal] = useState<ClientPortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('EA Form');
  const [notice, setNotice] = useState<string | null>(null);

  const t = DICT[lang];

  const loadPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/client-portal/${encodeURIComponent(accessToken)}`);
      const data = (await resp.json()) as { portal?: ClientPortalPayload & { locked?: boolean }; error?: string };
      if (!resp.ok || !data.portal) {
        throw new Error(data.error || 'Client tax book-in link not found.');
      }
      setPortal(data.portal);
      if (data.portal.locked) {
        setError(t.lockedErr);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load client portal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPortal();
  }, [accessToken]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationInput.trim()) {
      setError(t.verifyError);
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const resp = await fetch(`/api/client-portal/${encodeURIComponent(accessToken)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationInput }),
      });
      const data = (await resp.json()) as { verified?: boolean; portal?: ClientPortalPayload; error?: string };
      if (!resp.ok || !data.verified) {
        throw new Error(data.error || 'Verification failed.');
      }
      setVerified(true);
      if (data.portal) setPortal(data.portal);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

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
      setNotice(lang === 'zh' ? '谢谢！您的委托书已成功确认。' : 'Thank you! Your engagement book-in has been confirmed.');
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
      const data = (await resp.json()) as { portal?: ClientPortalPayload; error?: string };
      if (!resp.ok || !data.portal) {
        throw new Error(data.error || 'File upload failed.');
      }
      setPortal(data.portal);
      setNotice(
        lang === 'zh'
          ? `成功上传 ${arr.length} 个文件。税务团队已收到通知进行审查。`
          : `Uploaded ${arr.length} file(s) successfully. Our tax team has been notified.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const checklistItems = portal
    ? MALAYSIAN_TAX_CHECKLIST.filter((c) => c.forms.includes(portal.formType))
    : MALAYSIAN_TAX_CHECKLIST;

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col text-base">
      {/* Header */}
      <header className="h-16 bg-[#790D16] text-white px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-[#5E0A11] shrink-0">
        <div className="font-display font-bold text-base sm:text-lg tracking-tight">
          {t.headerTitle}
        </div>
        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="bg-white/15 border border-white/30 flex text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1.5 cursor-pointer ${lang === 'en' ? 'bg-white text-[#790D16]' : 'text-white'}`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('zh')}
              className={`px-3 py-1.5 cursor-pointer ${lang === 'zh' ? 'bg-white text-[#790D16]' : 'text-white'}`}
            >
              中文
            </button>
          </div>

          {canReturnToStaff && (
            <button
              type="button"
              onClick={onReturnToStaff}
              className="px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/25 inline-flex items-center gap-1.5 cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.staffDash}</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {loading ? (
          <div className="bg-white border border-[#E5E7EB] p-12 text-center text-base text-[#57534E]">
            Loading secure tax workspace...
          </div>
        ) : error && !portal ? (
          <div className="bg-white border border-[#E5E7EB] p-8 max-w-xl mx-auto">
            <h1 className="text-xl font-bold text-[#790D16] mb-2">Portal Unavailable</h1>
            <p className="text-base text-[#44403C] mb-6">{error}</p>
          </div>
        ) : portal && !verified ? (
          /* Wrong-Link Protection: Verification Screen */
          <div className="bg-white border border-[#E5E7EB] p-6 sm:p-10 max-w-lg mx-auto shadow-lg space-y-6">
            <div className="w-12 h-12 bg-[#790D16] text-white flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1C1917] mb-2">{t.verifyTitle}</h1>
              <p className="text-base text-[#57534E] leading-relaxed">{t.verifyPrompt}</p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-sm text-red-800 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1C1917] mb-2">
                  {lang === 'zh' ? '请输入身份证/护照后4位或电话号码' : 'IC / Passport Last 4 Digits or Phone'}
                </label>
                <input
                  type="text"
                  value={verificationInput}
                  onChange={(e) => setVerificationInput(e.target.value)}
                  placeholder={t.verifyPlaceholder}
                  required
                  className="w-full px-4 py-3 text-lg font-mono border border-[#D6D3D1] bg-[#FAF9F6] focus:border-[#790D16] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={verifying}
                className="w-full py-3.5 px-6 bg-[#790D16] hover:bg-[#5E0A11] disabled:opacity-60 text-white text-base font-bold transition-colors cursor-pointer min-h-[48px]"
              >
                {verifying ? 'Verifying...' : t.verifyBtn}
              </button>
            </form>
          </div>
        ) : portal && verified ? (
          <>
            {/* Client Identity Banner */}
            <section className="bg-white border border-[#E5E7EB] p-6 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#790D16] uppercase tracking-wider">
                    {lang === 'zh' ? '马来西亚个人所得税申报' : 'Malaysian Individual Income Tax Engagement'}
                  </div>
                  <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#1C1917]">
                    {portal.clientName}
                  </h1>
                  <div className="mt-2 text-sm text-[#57534E] font-mono tabular-nums flex flex-wrap gap-x-3 gap-y-1">
                    <span>{t.refLabel} {portal.fileRef}</span>
                    <span>·</span>
                    <span>{t.tinLabel} {portal.maskedTin}</span>
                    <span>·</span>
                    <span>{portal.formType}</span>
                    <span>·</span>
                    <span>YA {portal.yearOfAssessment}</span>
                  </div>
                </div>

                <div className="px-4 py-3 bg-[#F5EFE1] border border-[#E5D3AF] text-left md:text-right shrink-0">
                  <div className="text-xs text-[#57534E]">{t.statusLabel}</div>
                  <div className="text-sm font-bold text-[#790D16]">{portal.status}</div>
                </div>
              </div>
            </section>

            {notice && (
              <div className="p-4 bg-[#ECFDF5] border border-[#BBF7D0] text-base text-[#166534] flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-base text-red-800 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Missing Items */}
            {portal.missingItems.length > 0 && (
              <section className="bg-[#FEF2F2] border border-[#FECACA] p-6">
                <div className="flex items-center gap-2 text-base font-bold text-[#991B1B] mb-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{t.actionRequired}</span>
                </div>
                <p className="text-sm text-[#7F1D1D] mb-3 leading-relaxed">{t.actionPrompt}</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm font-medium text-[#7F1D1D]">
                  {portal.missingItems.map((m, idx) => (
                    <li key={`${m}_${idx}`}>{m}</li>
                  ))}
                </ol>
              </section>
            )}

            {/* Step 1: Book-In Confirmation */}
            <section className="bg-white border border-[#E5E7EB] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-[#790D16] font-semibold">{t.step1Tag}</div>
                  <h2 className="text-lg font-bold text-[#1C1917] mt-0.5">{t.step1Title}</h2>
                  <p className="text-sm text-[#57534E] mt-1 leading-relaxed">
                    {portal.isBookedIn
                      ? (lang === 'zh' ? `已于 ${portal.bookedInDate} 确认委托。` : `Book-in confirmed on ${portal.bookedInDate}.`)
                      : t.step1Desc}
                  </p>
                </div>

                {portal.isBookedIn ? (
                  <div className="inline-flex items-center gap-2 px-4 py-3 bg-[#ECFDF5] border border-[#BBF7D0] text-sm font-semibold text-[#166534] shrink-0 min-h-[48px]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{t.confirmedBadge}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={handleConfirmBookIn}
                    className="px-6 py-3.5 text-sm font-bold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 shrink-0 cursor-pointer min-h-[48px]"
                  >
                    {confirming ? '...' : t.confirmBtn}
                  </button>
                )}
              </div>
            </section>

            {/* Step 2: Checklist & Mobile-First Uploader */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Checklist */}
              <div className="lg:col-span-6 bg-white border border-[#E5E7EB]">
                <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAF9F6]">
                  <div className="text-xs font-mono text-[#790D16] font-semibold">{t.step2Tag}</div>
                  <h2 className="text-base font-bold text-[#1C1917]">{t.step2Title}</h2>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {checklistItems.map((item) => {
                    const isSelected = selectedCategory === item.category;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedCategory(item.category)}
                        className={`w-full text-left px-5 py-4 transition-colors cursor-pointer min-h-[52px] ${
                          isSelected ? 'bg-[#F5EFE1]/70' : 'hover:bg-[#FAF9F6]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#1C1917]">{item.title}</span>
                          <span className="text-xs font-mono text-[#790D16] font-semibold shrink-0">
                            {isSelected ? (lang === 'zh' ? '已选择' : 'Selected') : (lang === 'zh' ? '选择' : 'Select')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#57534E] leading-relaxed">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Uploader */}
              <div className="lg:col-span-6 space-y-5">
                <div className="bg-white border border-[#E5E7EB] p-6 space-y-4">
                  <div>
                    <div className="text-xs font-mono text-[#790D16] font-semibold">{t.step2SubTag}</div>
                    <h2 className="text-base font-bold text-[#1C1917]">{t.uploadTitle}</h2>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[#292524] mb-1.5">
                      {t.categoryTag}
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full px-3.5 py-3 text-base border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none min-h-[48px]"
                    >
                      <option value="EA Form">EA Form (CP8A) / EC Form</option>
                      <option value="Bank Statement">Bank / FD Interest Statements</option>
                      <option value="Tenancy Agreement">Tenancy Agreements &amp; Rental Receipts</option>
                      <option value="Personal Relief">Personal Tax Relief Receipts</option>
                      <option value="Dividend Statement">Dividend / Unit Trust Statements</option>
                      <option value="Zakat/Donation">Approved Donation &amp; Zakat Receipts</option>
                      <option value="Business Record">Business Income &amp; Expense Records</option>
                      <option value="Other">Other Supporting Documents</option>
                    </select>
                  </div>

                  <div className="border-2 border-dashed border-[#D6D3D1] bg-[#FAF9F6] p-8 text-center space-y-4">
                    <div className="flex justify-center gap-4">
                      <Upload className="w-10 h-10 text-[#790D16]" />
                      <Camera className="w-10 h-10 text-[#790D16]" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-[#1C1917]">
                        {uploading ? 'Uploading...' : t.dragText}
                      </div>
                      <p className="text-sm text-[#57534E] mt-1">{t.subDrag}</p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      capture="environment"
                      onChange={(e) => {
                        if (e.target.files?.length) void uploadFiles(e.target.files);
                      }}
                      className="hidden"
                    />

                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-6 py-3.5 text-base font-bold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 cursor-pointer min-h-[48px]"
                    >
                      {uploading ? 'Uploading...' : t.selectDevice}
                    </button>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs text-[#57534E]">
                    <ShieldCheck className="w-5 h-5 text-[#790D16] shrink-0 mt-0.5" />
                    <span>{t.securityNote}</span>
                  </div>
                </div>

                {/* Received Files List */}
                <div className="bg-white border border-[#E5E7EB]">
                  <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F6] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1C1917]">
                      {t.receivedDocs} ({portal.uploadedFiles.length})
                    </h3>
                    <span className="text-xs font-medium text-[#57534E]">
                      {portal.completenessStatus}
                    </span>
                  </div>
                  {portal.uploadedFiles.length === 0 ? (
                    <div className="p-6 text-sm text-[#78716C]">
                      {lang === 'zh' ? '暂无上传文件。' : 'No documents uploaded yet.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB]">
                      {portal.uploadedFiles.map((f) => (
                        <div
                          key={f.id}
                          className="px-5 py-4 flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-5 h-5 text-[#790D16] shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-[#1C1917] truncate">{f.fileName}</div>
                              <div className="text-xs text-[#78716C] font-mono">
                                {f.categoryHint} · {(f.sizeBytes / 1024).toFixed(0)} KB
                              </div>
                            </div>
                          </div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[#790D16] hover:underline inline-flex items-center gap-1 shrink-0 min-h-[44px] items-center"
                          >
                            View
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
