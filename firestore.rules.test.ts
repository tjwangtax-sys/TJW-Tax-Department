/**
 * Security Rules Verification Suite — TJW Group Individual Tax Job Management System
 * Validates the "Dirty Dozen" adversarial payloads against firestore.rules.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated PII Read',
    operation: 'get',
    path: 'taxJobs/job_ya2025_001',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoof',
    operation: 'get',
    path: 'taxJobs/job_ya2025_001',
    auth: { uid: 'attacker_1', email: 'tjwang.tax@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-Owner PII Read',
    operation: 'get',
    path: 'taxJobs/job_ya2025_001',
    auth: { uid: 'user_b', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Blanket Collection List Scrape',
    operation: 'list',
    path: 'taxJobs',
    auth: { uid: 'user_b', email: 'other@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Create',
    operation: 'create',
    path: 'taxJobs/job_spoof',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { id: 'job_spoof', ownerUid: 'user_b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow Field Injection',
    operation: 'create',
    path: 'taxJobs/job_shadow',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { id: 'job_shadow', ownerUid: 'user_a', ghostAdminFlag: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: `taxJobs/${'x'.repeat(200)}`,
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { id: 'x'.repeat(200), ownerUid: 'user_a' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: 'taxJobs/job_backdate',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { id: 'job_backdate', ownerUid: 'user_a', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Field Mutation (ownerUid)',
    operation: 'update',
    path: 'taxJobs/job_ya2025_001',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { ownerUid: 'user_b' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Allowed Key',
    operation: 'update',
    path: 'taxJobs/job_ya2025_001',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { clientName: 'A'.repeat(500) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Tampering by Non-Admin',
    operation: 'update',
    path: 'taxJobs/job_completed_001',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { status: '8. In Progress' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Assigned Admin Privilege Escalation',
    operation: 'create',
    path: 'admins/user_a',
    auth: { uid: 'user_a', email: 'a@example.com', email_verified: true },
    payload: { uid: 'user_a', email: 'a@example.com', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
];
