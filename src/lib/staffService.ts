import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type StaffRole = 'Admin' | 'Reviewer' | 'PIC';

export interface StaffUser {
  uid?: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt?: unknown;
}

const COLLECTION_NAME = 'staffUsers';
const PRIMARY_ADMINS = new Set(['tjwang.tax@gmail.com', 'tjw.tax@gmail.com']);

export async function ensureStaffUserRecord(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<StaffUser> {
  if (!user.email) {
    throw new Error('Google account did not provide a valid email address.');
  }

  const emailLower = user.email.trim().toLowerCase();
  const isPrimaryAdmin = PRIMARY_ADMINS.has(emailLower);

  const ref = doc(db, COLLECTION_NAME, emailLower);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as StaffUser;
      if (data.active === false) {
        throw new Error('Your staff account has been deactivated. Please contact TJW Group IT Administrator.');
      }
      const updates: Record<string, unknown> = {};
      if (data.uid !== user.uid) {
        updates.uid = user.uid;
      }
      if (isPrimaryAdmin && (data.role !== 'Admin' || !data.active)) {
        updates.role = 'Admin';
        updates.active = true;
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(ref, updates).catch(() => {});
      }
      return { ...data, ...updates };
    }
  } catch (err) {
    if (isPrimaryAdmin) {
      const adminRecord: StaffUser = {
        uid: user.uid,
        email: emailLower,
        name: user.displayName || 'System Admin',
        role: 'Admin',
        active: true,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, adminRecord, { merge: true }).catch(() => {});
      return adminRecord;
    }
    // If not primary admin and error occurred during get, throw the error message
    throw err;
  }

  // Fallback query by email or uid
  try {
    const qEmail = query(collection(db, COLLECTION_NAME), where('email', '==', emailLower));
    const qEmailSnap = await getDocs(qEmail);
    if (!qEmailSnap.empty) {
      const docMatch = qEmailSnap.docs[0];
      const data = docMatch.data() as StaffUser;
      if (data.active === false) {
        throw new Error('Your staff account has been deactivated. Please contact TJW Group IT Administrator.');
      }
      if (data.uid !== user.uid) {
        await updateDoc(docMatch.ref, { uid: user.uid }).catch(() => {});
      }
      return { ...data, uid: user.uid };
    }

    const qUid = query(collection(db, COLLECTION_NAME), where('uid', '==', user.uid));
    const qUidSnap = await getDocs(qUid);
    if (!qUidSnap.empty) {
      const docMatch = qUidSnap.docs[0];
      const data = docMatch.data() as StaffUser;
      if (data.active === false) {
        throw new Error('Your staff account has been deactivated. Please contact TJW Group IT Administrator.');
      }
      return data;
    }
  } catch (err) {
    if (isPrimaryAdmin) {
      const adminRecord: StaffUser = {
        uid: user.uid,
        email: emailLower,
        name: user.displayName || 'System Admin',
        role: 'Admin',
        active: true,
        createdAt: serverTimestamp(),
      };
      await setDoc(ref, adminRecord, { merge: true }).catch(() => {});
      return adminRecord;
    }
    throw err;
  }

  if (isPrimaryAdmin) {
    const adminRecord: StaffUser = {
      uid: user.uid,
      email: emailLower,
      name: user.displayName || 'System Admin',
      role: 'Admin',
      active: true,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, adminRecord, { merge: true }).catch(() => {});
    return adminRecord;
  }

  throw new Error('Access Restricted — Your email is not registered in TJW Tax Department Team Access.');
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    return snap.docs.map((d) => ({
      email: d.id,
      ...d.data(),
    }) as StaffUser);
  } catch (err) {
    console.error('Failed to fetch staff users:', err);
    return [];
  }
}

export async function upsertStaffUser(
  email: string,
  name: string,
  role: StaffRole,
  active: boolean
): Promise<void> {
  const emailKey = email.trim().toLowerCase();
  const ref = doc(db, COLLECTION_NAME, emailKey);
  await setDoc(
    ref,
    {
      email: emailKey,
      name: name.trim() || emailKey.split('@')[0],
      role,
      active,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setStaffActiveStatus(email: string, active: boolean): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, email.trim().toLowerCase());
  await updateDoc(ref, { active });
}

export async function setStaffRole(email: string, role: StaffRole): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, email.trim().toLowerCase());
  await updateDoc(ref, { role });
}
