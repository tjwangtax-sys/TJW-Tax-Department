import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type StaffRole = 'Admin' | 'Reviewer' | 'PIC';

export interface StaffUser {
  uid: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  createdAt?: unknown;
}

const COLLECTION_NAME = 'staffUsers';
const BOOTSTRAPPED_ADMIN = 'tjwang.tax@gmail.com';

export async function ensureStaffUserRecord(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<StaffUser> {
  if (!user.email) {
    throw new Error('User email is required for staff verification.');
  }

  const emailLower = user.email.trim().toLowerCase();
  const isBootstrap = emailLower === BOOTSTRAPPED_ADMIN || emailLower.endsWith('@tjwang.com.my');

  const ref = doc(db, COLLECTION_NAME, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as StaffUser;
    if (isBootstrap && (data.role !== 'Admin' || !data.active)) {
      await updateDoc(ref, { role: 'Admin', active: true });
      return { ...data, role: 'Admin', active: true };
    }
    return data;
  }

  // If bootstrap admin, auto-bootstrap record
  if (isBootstrap) {
    const newStaff: StaffUser = {
      uid: user.uid,
      email: emailLower,
      name: user.displayName || emailLower.split('@')[0] || 'System Admin',
      role: 'Admin',
      active: true,
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, newStaff);
    return newStaff;
  }

  throw new Error('Access Restricted: Your account is not registered in the TJW staff directory. Please contact your System Administrator to provision your staff access.');
}

export async function fetchStaffUsers(): Promise<StaffUser[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    return snap.docs.map((d) => d.data() as StaffUser);
  } catch (err) {
    console.error('Failed to fetch staff users:', err);
    return [];
  }
}

export async function upsertStaffUser(
  uid: string,
  email: string,
  name: string,
  role: StaffRole,
  active: boolean
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, uid);
  await setDoc(
    ref,
    {
      uid,
      email: email.trim().toLowerCase(),
      name: name.trim() || email.split('@')[0],
      role,
      active,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setStaffActiveStatus(uid: string, active: boolean): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, uid);
  await updateDoc(ref, { active });
}

export async function setStaffRole(uid: string, role: StaffRole): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, uid);
  await updateDoc(ref, { role });
}
