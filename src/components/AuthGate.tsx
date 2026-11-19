import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Lock, ArrowRight, FileCheck2, ShieldCheck, Layers } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

export const AuthGate: React.FC = () => {
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setErrorMsg(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
      setErrorMsg(msg);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col">
      <header className="h-14 bg-[#790D16] text-white px-6 flex items-center justify-between border-b border-[#5E0A11]">
        <div className="font-display font-bold text-base tracking-tight whitespace-nowrap">
          TJW Group Tax Department
        </div>
        <div className="text-xs text-[#E5D3AF] font-mono tabular-nums whitespace-nowrap">
          LHDN Individual Tax Practice · Malaysia
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white border border-[#E5E7EB]">
          {/* Left institutional overview */}
          <div className="md:col-span-7 p-8 md:p-10 bg-[#F5EFE1] border-b md:border-b-0 md:border-r border-[#E5E7EB] flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold text-[#790D16] tracking-wide mb-3">
                Individual Tax Engagement Platform
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-[#1C1917] leading-tight text-balance mb-4">
                End-to-End Malaysian Individual Tax Job Management
              </h1>
              <p className="text-sm text-[#44403C] leading-relaxed mb-8">
                Centralize Form BE, Form B, and Form M compliance from initial annual reminder and tokenized client book-in through AI-assisted document screening, technical review, billing, and LHDN MyTax e-Filing closure.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Layers className="w-4 h-4 text-[#790D16] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-[#1C1917]">14-Stage Compliance State Machine</div>
                    <div className="text-xs text-[#57534E]">
                      Enforced progression across Book-In, Screening, PIC Preparation, Technical Review, Billing, and e-Filing.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FileCheck2 className="w-4 h-4 text-[#790D16] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-[#1C1917]">AI Document Screening & Book-In Listing</div>
                    <div className="text-xs text-[#57534E]">
                      Classifies EA Forms, bank statements, tenancy agreements, personal reliefs, and Zakat receipts into exportable Excel & PDF listings.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#790D16] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-[#1C1917]">Tokenized Client Document Book-In Portal</div>
                    <div className="text-xs text-[#57534E]">
                      Shareable client upload links with guided Malaysian tax checklists and real-time missing document tracking.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#E5D3AF] text-xs text-[#57534E] font-mono">
              Form BE · Form B · Form M · YA 2024 – YA 2026
            </div>
          </div>

          {/* Right sign-in panel */}
          <div className="md:col-span-5 p-8 md:p-10 flex flex-col justify-center">
            <div className="w-10 h-10 bg-[#790D16] text-white flex items-center justify-center mb-6">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#1C1917] mb-2">Staff Portal Sign In</h2>
            <p className="text-sm text-[#57534E] mb-6 leading-relaxed">
              Sign in with your verified Google Workspace account to access the TJW Group Individual Tax Job Tracker and Firestore database.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full py-2.5 px-4 bg-[#790D16] hover:bg-[#5E0A11] disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{signingIn ? 'Authenticating...' : 'Sign in with Google'}</span>
              {!signingIn && <ArrowRight className="w-4 h-4" />}
            </button>

            <p className="mt-6 text-xs text-[#78716C] leading-relaxed">
              Protected by verified Google Authentication and Firestore security rules. Client document uploads remain accessible externally via individual tokenized book-in links.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
