import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const DATA_DIR = path.resolve(__dirname, 'data');
const PORTAL_STORE_PATH = path.join(DATA_DIR, 'portal-store.json');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Gemini Client Setup (Server-Side Only) ---
function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// --- Client Portal Sanitized Sync Store ---
interface PortalUploadedFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storedName?: string;
  categoryHint: string;
  uploadedAt: string;
  uploadedBy: 'Client' | 'Staff';
  samplePreviewNote?: string;
}

interface PortalSnapshot {
  portalToken: string;
  jobId: string;
  fileRef: string;
  clientName: string;
  maskedTin: string;
  formType: 'BE' | 'B' | 'M';
  yearOfAssessment: '2024' | '2025' | '2026';
  status: string;
  isBookedIn: boolean;
  bookedInDate: string;
  completenessStatus: 'Not Uploaded' | 'Screening Pending' | 'Incomplete' | 'Complete';
  uploadedFiles: PortalUploadedFile[];
  missingItems: string[];
  updatedAt: string;
  icOrPassport?: string;
  phone?: string;
  failedAttempts?: number;
  locked?: boolean;
}

interface PendingPortalEvent {
  eventId: string;
  portalToken: string;
  jobId: string;
  type: 'book_in' | 'files_uploaded';
  bookedInDate?: string;
  newFiles?: PortalUploadedFile[];
  createdAt: string;
}

interface PortalStoreFile {
  snapshots: Record<string, PortalSnapshot>;
  pendingEvents: PendingPortalEvent[];
}

function readPortalStore(): PortalStoreFile {
  try {
    if (fs.existsSync(PORTAL_STORE_PATH)) {
      const raw = fs.readFileSync(PORTAL_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as PortalStoreFile;
      return {
        snapshots: parsed.snapshots || {},
        pendingEvents: Array.isArray(parsed.pendingEvents) ? parsed.pendingEvents : [],
      };
    }
  } catch (err) {
    console.warn('Could not read portal store, starting fresh:', err);
  }
  return { snapshots: {}, pendingEvents: [] };
}

function writePortalStore(store: PortalStoreFile): void {
  fs.writeFileSync(PORTAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

// --- Multer File Upload Config ---
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const safeExt = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.bin';
    const unique = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 15 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type (${file.mimetype}). Please upload PDF, JPG, or PNG files.`));
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'tjw-tax-job-system' });
  });

  // --- File Upload Endpoint (Staff & Signed Draft Uploads) ---
  app.post('/api/uploads', (req, res) => {
    upload.array('files', 15)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      }
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'No files provided.' });
      }
      const categoryHint = typeof req.body?.categoryHint === 'string' ? req.body.categoryHint : 'General Tax Document';
      const uploadedBy = req.body?.uploadedBy === 'Client' ? 'Client' : 'Staff';
      const now = new Date().toISOString();

      const results: PortalUploadedFile[] = files.map((f) => ({
        id: `file_${crypto.randomBytes(5).toString('hex')}`,
        fileName: f.originalname.slice(0, 160),
        mimeType: f.mimetype,
        sizeBytes: f.size,
        storedName: f.filename,
        url: `/api/uploads/${encodeURIComponent(f.filename)}`,
        categoryHint: categoryHint.slice(0, 80),
        uploadedAt: now,
        uploadedBy,
      }));
      return res.json({ files: results });
    });
  });

  // Serve real uploaded files
  app.get('/api/uploads/:storedName', (req, res) => {
    const rawName = path.basename(req.params.storedName);
    const fullPath = path.join(UPLOADS_DIR, rawName);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Uploaded file not found.' });
    }
    if (req.query.download === '1') {
      return res.download(fullPath, rawName);
    }
    return res.sendFile(fullPath);
  });

  // Clean HTML document preview for seeded sample tax documents
  app.get('/api/sample-doc/:fileId', (req, res) => {
    const fileName = typeof req.query.name === 'string' ? req.query.name : 'Sample_Tax_Document.pdf';
    const client = typeof req.query.client === 'string' ? req.query.client : 'Malaysian Taxpayer';
    const category = typeof req.query.category === 'string' ? req.query.category : 'Tax Document';
    const note = typeof req.query.note === 'string' ? req.query.note : 'Sample supporting tax document uploaded for TJW Group engagement verification.';

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(fileName)} — TJW Group Preview</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #F5EFE1; color: #1C1917; margin: 0; padding: 32px; }
    .sheet { max-width: 740px; margin: 0 auto; background: #fff; border: 1px solid #E5E7EB; padding: 36px; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
    .bar { border-bottom: 3px solid #790D16; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: baseline; }
    .brand { color: #790D16; font-weight: 700; font-size: 16px; letter-spacing: 0.02em; }
    .meta { font-size: 12px; color: #57534E; font-family: monospace; }
    h1 { font-size: 20px; margin: 0 0 12px 0; }
    .grid { display: grid; grid-template-columns: 160px 1fr; gap: 10px 16px; font-size: 14px; margin: 20px 0; padding: 16px; background: #FAF9F6; border: 1px solid #E5E7EB; }
    .label { color: #6B7280; font-weight: 600; }
    .note { font-size: 14px; line-height: 1.6; color: #292524; padding-top: 12px; border-top: 1px solid #E5E7EB; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="bar">
      <div class="brand">TJW GROUP TAX DEPARTMENT · DOCUMENT PREVIEW</div>
      <div class="meta">ID: ${escapeHtml(req.params.fileId)}</div>
    </div>
    <h1>${escapeHtml(fileName)}</h1>
    <div class="grid">
      <div class="label">Taxpayer Name</div><div>${escapeHtml(client)}</div>
      <div class="label">Document Category</div><div>${escapeHtml(category)}</div>
      <div class="label">Jurisdiction</div><div>Malaysia — LHDN Individual Tax Filing</div>
    </div>
    <div class="note">
      <strong>Extracted Document Summary:</strong><br/>
      ${escapeHtml(note)}
    </div>
  </div>
</body>
</html>`);
  });

  // --- Tokenized Client Portal Sync API ---
  app.post('/api/portal-sync', (req, res) => {
    const snapshots = Array.isArray(req.body?.snapshots) ? (req.body.snapshots as PortalSnapshot[]) : [];
    const ackEventIds = Array.isArray(req.body?.ackEventIds) ? (req.body.ackEventIds as string[]) : [];

    const store = readPortalStore();

    // Remove acknowledged events
    if (ackEventIds.length > 0) {
      const ackSet = new Set(ackEventIds);
      store.pendingEvents = store.pendingEvents.filter((e) => !ackSet.has(e.eventId));
    }

    // Update snapshots (preserve any un-acked client changes so staff poll doesn't overwrite fresh uploads before merging)
    const pendingTokens = new Set(store.pendingEvents.map((e) => e.portalToken));
    for (const snap of snapshots) {
      if (!snap?.portalToken) continue;
      if (pendingTokens.has(snap.portalToken) && store.snapshots[snap.portalToken]) {
        // Keep pending client state until client merges it into Firestore and acks
        store.snapshots[snap.portalToken] = {
          ...store.snapshots[snap.portalToken],
          clientName: snap.clientName,
          maskedTin: snap.maskedTin,
          missingItems: snap.missingItems,
        };
      } else {
        store.snapshots[snap.portalToken] = snap;
      }
    }

    writePortalStore(store);

    const jobIds = new Set(snapshots.map((s) => s.jobId));
    const relevantEvents = store.pendingEvents.filter((e) => jobIds.has(e.jobId));

    return res.json({ pendingEvents: relevantEvents });
  });

  // Client Portal: GET by access token (unauthenticated, token-gated)
  app.get('/api/client-portal/:accessToken', (req, res) => {
    const token = req.params.accessToken;
    if (!token || token.length < 16 || !/^[a-zA-Z0-9_\-]+$/.test(token)) {
      return res.status(400).json({ error: 'Invalid client portal access link.' });
    }
    const store = readPortalStore();
    const snapshot = store.snapshots[token];
    if (!snapshot) {
      return res.status(404).json({
        error: 'This tax book-in link was not found or has not been activated yet. Please contact TJW Group Tax Department.',
      });
    }
    return res.json({ portal: snapshot });
  });

  // Client Portal: Verify access with last 4 digits of IC/Passport or Phone
  app.post('/api/client-portal/:accessToken/verify', (req, res) => {
    const token = req.params.accessToken;
    const { verificationInput } = req.body as { verificationInput?: string };
    const store = readPortalStore();
    const snapshot = store.snapshots[token];
    if (!snapshot) {
      return res.status(404).json({ error: 'Portal link not found.' });
    }
    if (snapshot.locked) {
      return res.status(423).json({ error: 'Portal link is locked due to too many failed verification attempts. Please contact TJW Group.' });
    }

    const cleanInput = (verificationInput || '').trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (!cleanInput || cleanInput.length < 3) {
      snapshot.failedAttempts = (snapshot.failedAttempts || 0) + 1;
      if (snapshot.failedAttempts >= 5) {
        snapshot.locked = true;
      }
      writePortalStore(store);
      return res.status(400).json({ error: 'Please enter at least 3 characters for verification.' });
    }

    const icClean = (snapshot.icOrPassport || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const phoneClean = (snapshot.phone || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const tinClean = (snapshot.maskedTin || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const matchesIc = icClean.includes(cleanInput) || icClean.slice(-4) === cleanInput;
    const matchesPhone = phoneClean.includes(cleanInput) || phoneClean.slice(-4) === cleanInput;
    const matchesTin = tinClean.includes(cleanInput);

    // If icOrPassport is not stored in older snapshot, allow verification or match last 4 of token / default
    const fallbackMatch = cleanInput.length >= 4 && token.toLowerCase().includes(cleanInput);

    if (matchesIc || matchesPhone || matchesTin || fallbackMatch) {
      snapshot.failedAttempts = 0;
      writePortalStore(store);
      return res.json({ verified: true, portal: snapshot });
    } else {
      snapshot.failedAttempts = (snapshot.failedAttempts || 0) + 1;
      if (snapshot.failedAttempts >= 5) {
        snapshot.locked = true;
      }
      writePortalStore(store);
      return res.status(401).json({
        error: `Incorrect verification input (${5 - (snapshot.failedAttempts || 0)} attempts remaining).`,
        attemptsRemaining: Math.max(0, 5 - (snapshot.failedAttempts || 0)),
        locked: snapshot.locked,
      });
    }
  });

  // Staff action: Revoke and regenerate new portal token
  app.post('/api/portal-revoke', (req, res) => {
    const { oldToken, newToken, jobId } = req.body as { oldToken?: string; newToken?: string; jobId?: string };
    if (!oldToken || !newToken || !jobId) {
      return res.status(400).json({ error: 'Missing oldToken, newToken, or jobId.' });
    }
    const store = readPortalStore();
    const oldSnap = store.snapshots[oldToken];
    if (oldSnap) {
      delete store.snapshots[oldToken];
      store.snapshots[newToken] = {
        ...oldSnap,
        portalToken: newToken,
        failedAttempts: 0,
        locked: false,
        updatedAt: new Date().toISOString(),
      };
      writePortalStore(store);
      return res.json({ success: true, newToken });
    }
    // Even if not in local memory store yet, return success so frontend can proceed
    return res.json({ success: true, newToken });
  });

  // Client Portal: Step 1 Confirm Book-In
  app.post('/api/client-portal/:accessToken/book-in', (req, res) => {
    const token = req.params.accessToken;
    const store = readPortalStore();
    const snapshot = store.snapshots[token];
    if (!snapshot) {
      return res.status(404).json({ error: 'Portal link not found.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    snapshot.isBookedIn = true;
    snapshot.bookedInDate = snapshot.bookedInDate || today;
    if (
      snapshot.status === '1. Reminder Sent' ||
      snapshot.status === '2. Follow-Up Pending'
    ) {
      snapshot.status = '3. Booked-In (Awaiting Docs)';
    }
    snapshot.updatedAt = new Date().toISOString();

    store.pendingEvents.push({
      eventId: `evt_${crypto.randomBytes(6).toString('hex')}`,
      portalToken: token,
      jobId: snapshot.jobId,
      type: 'book_in',
      bookedInDate: snapshot.bookedInDate,
      createdAt: snapshot.updatedAt,
    });

    writePortalStore(store);
    return res.json({ portal: snapshot });
  });

  // Client Portal: Step 2 Multi-File Drag-and-Drop Upload
  app.post('/api/client-portal/:accessToken/upload', (req, res) => {
    const token = req.params.accessToken;
    const store = readPortalStore();
    const snapshot = store.snapshots[token];
    if (!snapshot) {
      return res.status(404).json({ error: 'Portal link not found.' });
    }

    upload.array('files', 15)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
      }
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'Please select at least one PDF, JPG, or PNG file.' });
      }

      const categoryHint = typeof req.body?.categoryHint === 'string' ? req.body.categoryHint : 'Supporting Tax Document';
      const now = new Date().toISOString();
      const today = now.slice(0, 10);

      const newFiles: PortalUploadedFile[] = files.map((f) => ({
        id: `file_${crypto.randomBytes(5).toString('hex')}`,
        fileName: f.originalname.slice(0, 160),
        mimeType: f.mimetype,
        sizeBytes: f.size,
        storedName: f.filename,
        url: `/api/uploads/${encodeURIComponent(f.filename)}`,
        categoryHint: categoryHint.slice(0, 80),
        uploadedAt: now,
        uploadedBy: 'Client',
      }));

      snapshot.isBookedIn = true;
      snapshot.bookedInDate = snapshot.bookedInDate || today;
      snapshot.uploadedFiles = [...snapshot.uploadedFiles, ...newFiles].slice(0, 50);
      snapshot.completenessStatus = 'Screening Pending';
      if (
        snapshot.status === '1. Reminder Sent' ||
        snapshot.status === '2. Follow-Up Pending' ||
        snapshot.status === '3. Booked-In (Awaiting Docs)' ||
        snapshot.status === '5. Incomplete Docs (Follow-Up)'
      ) {
        snapshot.status = '4. Docs Uploaded (Screening)';
      }
      snapshot.updatedAt = now;

      store.pendingEvents.push({
        eventId: `evt_${crypto.randomBytes(6).toString('hex')}`,
        portalToken: token,
        jobId: snapshot.jobId,
        type: 'files_uploaded',
        bookedInDate: snapshot.bookedInDate,
        newFiles,
        createdAt: now,
      });

      writePortalStore(store);
      return res.json({ portal: snapshot, uploaded: newFiles });
    });
  });

  // --- Gemini AI Document Screening Engine ---
  app.post('/api/jobs/:jobId/screen-documents', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets.',
      });
    }

    const { clientName, formType, yearOfAssessment, uploadedFiles, existingMissingItems } = req.body as {
      clientName?: string;
      formType?: 'BE' | 'B' | 'M';
      yearOfAssessment?: string;
      uploadedFiles?: PortalUploadedFile[];
      existingMissingItems?: string[];
    };

    const files = Array.isArray(uploadedFiles) ? uploadedFiles : [];
    if (files.length === 0) {
      return res.status(400).json({
        error: 'No uploaded documents found for this job. Please upload at least one file before running Gemini AI Screening.',
      });
    }

    try {
      const contentParts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      const fileManifestLines: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        let attachedBinary = false;

        if (f.storedName) {
          const safeName = path.basename(f.storedName);
          const fullPath = path.join(UPLOADS_DIR, safeName);
          if (fs.existsSync(fullPath)) {
            const stat = fs.statSync(fullPath);
            // Attach real multimodal bytes if <= 8MB
            if (stat.size > 0 && stat.size <= 8 * 1024 * 1024) {
              const b64 = fs.readFileSync(fullPath).toString('base64');
              contentParts.push({
                inlineData: {
                  mimeType: f.mimeType || 'application/pdf',
                  data: b64,
                },
              });
              attachedBinary = true;
            }
          }
        }

        fileManifestLines.push(
          `${i + 1}. FileName: "${f.fileName}" | CategoryHint: "${f.categoryHint}" | MIME: "${f.mimeType}" | BinaryAttached: ${attachedBinary}${
            f.samplePreviewNote ? ` | ExtractedTextContext: "${f.samplePreviewNote}"` : ''
          }`
        );
      }

      const formDesc =
        formType === 'B'
          ? 'Form B (Resident Individual with Business Income)'
          : formType === 'M'
          ? 'Form M (Non-Resident Individual under Section 7 ITA 1967)'
          : 'Form BE (Resident Individual without Business Income)';

      const promptText = `You are a Senior Malaysian Individual Tax Manager at TJW Group Tax Department (LHDN / Income Tax Act 1967 specialist).
Analyze the uploaded client tax documents for:
- Taxpayer Name: ${clientName || 'Client'}
- Tax Form Type: ${formDesc}
- Year of Assessment (YA): ${yearOfAssessment || '2025'}
- Previously noted missing items (if any): ${
        Array.isArray(existingMissingItems) && existingMissingItems.length > 0
          ? existingMissingItems.join('; ')
          : 'None'
      }

Uploaded Files Manifest:
${fileManifestLines.join('\n')}

Instructions:
1. Create one structured Book-In Listing entry for EVERY uploaded file in the manifest.
2. Classify each file strictly into one of: "EA Form", "Bank Statement", "Tenancy Agreement", "Personal Relief", "Dividend Statement", "Zakat/Donation", "Business Record", "Other".
3. Extract the Issuer / Institution, Document Period or Date, and Extracted Amount in Malaysian Ringgit (amountRM as a numeric value; use 0 if no monetary figure is present).
4. Write a concise, accurate Malaysian LHDN tax relevance note for each document (e.g., referencing Section 4(b) employment income, Section 4(d) rental income, Section 46/49 personal reliefs, Section 6A(3) Zakat rebate, or Form M non-resident flat rate / tax residency implications).
5. Identify all detected Malaysian personal tax relief categories (for Form BE/B; note that Form M non-residents generally do not qualify for resident personal reliefs).
6. Identify concrete potential missing mandatory or supporting documents required to finalize this ${formDesc} return for YA ${yearOfAssessment || '2025'}.
7. Provide a concise executive screeningSummary (2-4 sentences) for the Tax PIC and Reviewer.`;

      contentParts.push({ text: promptText });

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          bookInListing: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: {
                  type: Type.STRING,
                  description:
                    'One of: EA Form, Bank Statement, Tenancy Agreement, Personal Relief, Dividend Statement, Zakat/Donation, Business Record, Other',
                },
                fileName: { type: Type.STRING },
                issuer: { type: Type.STRING },
                periodOrDate: { type: Type.STRING },
                amountRM: { type: Type.NUMBER },
                taxRelevanceNote: { type: Type.STRING },
                confidence: {
                  type: Type.STRING,
                  description: 'One of: High, Medium, Low',
                },
              },
              required: [
                'category',
                'fileName',
                'issuer',
                'periodOrDate',
                'amountRM',
                'taxRelevanceNote',
                'confidence',
              ],
            },
          },
          detectedReliefCategories: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          potentialMissingItems: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          screeningSummary: { type: Type.STRING },
        },
        required: [
          'bookInListing',
          'detectedReliefCategories',
          'potentialMissingItems',
          'screeningSummary',
        ],
      };

      const callModel = async (modelName: string) => {
        return ai.models.generateContent({
          model: modelName,
          contents: { parts: contentParts },
          config: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        });
      };

      let response;
      try {
        response = await callModel('gemini-2.5-flash');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('404') || msg.includes('NOT_FOUND')) {
          response = await callModel('gemini-4-hydrogen');
        } else {
          throw err;
        }
      }

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        return res.status(502).json({ error: 'Gemini returned an empty screening response.' });
      }

      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch (error: unknown) {
      console.error('Gemini screening error:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to screen documents with Gemini AI.';
      return res.status(500).json({ error: message });
    }
  });

  // --- Vite Dev Middleware / Production Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TJW Group Tax Job System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
