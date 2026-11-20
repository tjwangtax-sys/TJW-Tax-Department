import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  type FormType,
  type YearOfAssessment,
} from '../types/tax';
import type { CreateTaxJobInput } from '../lib/taxJobService';
import { fetchStaffUsers, type StaffUser } from '../lib/staffService';

interface NewJobModalProps {
  ownerUid: string;
  existingCount: number;
  onClose: () => void;
  onCreate: (input: CreateTaxJobInput) => Promise<void>;
}

export const NewJobModal: React.FC<NewJobModalProps> = ({
  ownerUid,
  existingCount,
  onClose,
  onCreate,
}) => {
  const [clientName, setClientName] = useState('');
  const [icOrPassport, setIcOrPassport] = useState('');
  const [tinNumber, setTinNumber] = useState('IG ');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+60');
  const [formType, setFormType] = useState<FormType>('BE');
  const [yearOfAssessment, setYearOfAssessment] = useState<YearOfAssessment>('2025');
  const [fileRef, setFileRef] = useState(
    `TJW/IND/2025/${String(existingCount + 1).padStart(3, '0')}`
  );
  const [picName, setPicName] = useState<string>('Unassigned');
  const [reviewerName, setReviewerName] = useState<string>('Unassigned');
  const [feeAmount, setFeeAmount] = useState<string>('850');
  const [sendReminderNow, setSendReminderNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);

  useEffect(() => {
    fetchStaffUsers()
      .then((list) => setStaffList(list.filter((s) => s.active)))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !icOrPassport.trim() || !tinNumber.trim()) {
      setError('Client Name, IC/Passport, and TIN / Tax Reference are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        ownerUid,
        fileRef: fileRef.trim(),
        clientName: clientName.trim(),
        icOrPassport: icOrPassport.trim(),
        tinNumber: tinNumber.trim(),
        email: email.trim(),
        phone: phone.trim(),
        formType,
        yearOfAssessment,
        picName,
        reviewerName,
        feeAmount: Number(feeAmount) || 0,
        sendReminderNow,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tax job.');
    } finally {
      setSaving(false);
    }
  };

  const staffNames = staffList.map((s) => s.name);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-job-title"
        className="w-full max-w-2xl bg-white border border-[#E5E7EB] shadow-xl max-h-[92vh] flex flex-col"
      >
        <div className="px-6 py-4 bg-[#790D16] text-white flex items-center justify-between">
          <div>
            <h2 id="new-job-title" className="text-base font-bold">
              New Individual Tax Engagement
            </h2>
            <p className="text-xs text-[#E5D3AF]">
              Generates unique tokenized Client Document Book-In Portal link automatically
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Client Full Name (as per MyKad / Passport) *
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Wong Siew Ling"
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                LHDN TIN / Tax Reference No. *
              </label>
              <input
                type="text"
                required
                value={tinNumber}
                onChange={(e) => setTinNumber(e.target.value)}
                placeholder="IG 24891034020"
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                MyKad (IC) / Passport No. *
              </label>
              <input
                type="text"
                required
                value={icOrPassport}
                onChange={(e) => setIcOrPassport(e.target.value)}
                placeholder="880514-14-5210"
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Client Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@company.com.my"
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                WhatsApp / Mobile Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+6012-345 6789"
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Malaysian Tax Form Type
              </label>
              <select
                value={formType}
                onChange={(e) => {
                  const ft = e.target.value as FormType;
                  setFormType(ft);
                  setFeeAmount(ft === 'B' ? '2200' : ft === 'M' ? '1800' : '850');
                }}
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
              >
                <option value="BE">Form BE (Resident — Non-Business)</option>
                <option value="B">Form B (Resident — Business Income)</option>
                <option value="M">Form M (Non-Resident Individual)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Year of Assessment (YA)
              </label>
              <select
                value={yearOfAssessment}
                onChange={(e) => {
                  const ya = e.target.value as YearOfAssessment;
                  setYearOfAssessment(ya);
                  setFileRef(`TJW/IND/${ya}/${String(existingCount + 1).padStart(3, '0')}`);
                }}
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
              >
                <option value="2024">YA 2024</option>
                <option value="2025">YA 2025</option>
                <option value="2026">YA 2026</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Internal File Reference
              </label>
              <input
                type="text"
                value={fileRef}
                onChange={(e) => setFileRef(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Estimated Base Professional Fee (RM)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-[#D6D3D1] focus:border-[#790D16] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#292524] mb-1">
                Initial PIC (Optional)
              </label>
              <select
                value={picName}
                onChange={(e) => setPicName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
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
                Assigned Reviewer
              </label>
              <select
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#D6D3D1] bg-white focus:border-[#790D16] focus:outline-none"
              >
                <option value="Unassigned">Unassigned</option>
                {staffNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendReminderNow}
              onChange={(e) => setSendReminderNow(e.target.checked)}
              className="w-4 h-4 accent-[#790D16]"
            />
            <span className="text-xs text-[#292524]">
              Log initial annual tax reminder as sent today (Stage 1: Reminder Sent)
            </span>
          </label>

          <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#44403C] border border-[#D6D3D1] hover:bg-[#FAF9F6] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold bg-[#790D16] text-white hover:bg-[#5E0A11] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Creating Engagement...' : 'Create Tax Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
