import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';

const COLLECTION_NAME = 'auditLogs';

export interface AuditLogEntry {
  id?: string;
  timestamp?: unknown;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  action: string;
  fileRef: string;
  clientName: string;
  details: string;
}

export async function logAuditAction(params: {
  action: string;
  fileRef?: string;
  clientName?: string;
  details?: string;
  actorRole?: string;
}): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const entry = {
      actorUid: user.uid,
      actorEmail: user.email || 'unknown@tjwang.com.my',
      actorName: user.displayName || user.email?.split('@')[0] || 'Staff',
      actorRole: params.actorRole || 'Staff',
      action: params.action,
      fileRef: params.fileRef || 'N/A',
      clientName: params.clientName || 'N/A',
      details: params.details || '',
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, COLLECTION_NAME), entry);
  } catch (err) {
    console.error('Failed to log audit action:', err);
  }
}

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as AuditLogEntry[];
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    return [];
  }
}
