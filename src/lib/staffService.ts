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
  const defaultRole: StaffRole = isBootstrap ? 'Admin' : 'PIC';

  const ref = doc(db, COLLECTION_NAME, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data() as StaffUser;
    // If bootstrap admin, ensure active and Admin role
    if (isBootstrap && (data.role !== 'Admin' || !data.active)) {
      const updated: StaffUser = {
        ...data,
        role: 'Admin',
        active: true,
      };
      await updateDoc(ref, { role: 'Admin', active: true });
      return updated;
    }
    return data;
  }

  // Create new staff record
  const newStaff: StaffUser = {
    uid: user.uid,
    email: emailLower,
    name: user.displayName || user.email.split('@')[0] || 'Staff Member',
    role: defaultRole,
    active: isBootstrap ? true : true, // default active
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, newStaff);
  return newStaff;
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
