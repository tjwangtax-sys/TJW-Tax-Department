# TJW Group Individual Tax Job Management System — Security Specification

## 1. Data Invariants
1. **Strict Ownership & Admin Isolation**: Every `taxJobs/{jobId}` document contains Malaysian client PII (`clientName`, `icOrPassport`, `tinNumber`, `email`, `phone`). Only the verified job owner (`ownerUid == request.auth.uid`) or a verified TJW Group Admin (`tjwang.tax@gmail.com` or `admins/{uid}`) may read, list, create, update, or delete a tax job.
2. **Email Verification Enforcement**: Every authenticated read/write requires `request.auth.token.email_verified == true` to defeat email spoofing.
3. **Immutable Identity & Audit Fields**: `id`, `ownerUid`, `portalToken`, and `createdAt` cannot be modified after creation.
4. **Server Temporal Integrity**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
5. **Action-Based Updates**: Every `update` on `taxJobs/{jobId}` must pass `isValidTaxJob(incoming(), jobId)` and match an explicit `affectedKeys().hasOnly(...)` action branch.
6. **Terminal State Locking**: Once `status == '14. Submitted & Completed'`, non-admin updates are blocked to preserve filed LHDN engagement integrity; only admins may override.
7. **Bounded Lists & String Lengths**: Every string enforces `.size()` bounds matching `firebase-blueprint.json` and every array (`uploadedFiles`, `bookInListing`, `missingItems`, `followUpLogs`, `reviewQueries`) enforces strict `.size() <= MAX` limits.
8. **Zero Blanket Reads / Zero Client Query Delegation**: `allow list` on `taxJobs` explicitly validates `resource.data.ownerUid == request.auth.uid || isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read (`taxJobs/job_1`)**: Unauthenticated client attempts `get` on PII-bearing tax job -> MUST DENY.
2. **Unverified Admin Email Spoof**: User with `email: "tjwang.tax@gmail.com"` and `email_verified: false` attempts read/write -> MUST DENY.
3. **Cross-Owner PII Read**: Verified User B attempts `get` on User A's `taxJobs/job_1` -> MUST DENY.
4. **Blanket List Scraping**: Verified User B executes unfiltered `list` on `taxJobs` -> MUST DENY.
5. **Identity Spoofing on Create**: Verified User A tries to create a `taxJobs` doc with `ownerUid: "user_b"` -> MUST DENY.
6. **Shadow Field Injection on Create**: Verified User A includes undeclared ghost key `isApprovedByLhdn: true` -> MUST DENY.
7. **ID Poisoning Attack**: Verified User A attempts create with 300-character or invalid-symbol document ID (`job/../../admin`) -> MUST DENY.
8. **Client Timestamp Forgery**: Verified User A creates a job with a backdated client timestamp instead of `request.time` -> MUST DENY.
9. **Immutable Field Mutation (`ownerUid` / `portalToken`)**: Verified owner tries to alter `ownerUid` or `portalToken` on update -> MUST DENY.
10. **Value Poisoning on Allowed Key**: Verified owner updates `billing` with `feeAmount: "not-a-number"` or `clientName` exceeding 160 chars -> MUST DENY.
11. **Terminal State Tampering**: Non-admin owner tries to modify a job whose status is already `'14. Submitted & Completed'` -> MUST DENY.
12. **Self-Assigned Admin Escalation**: Non-admin verified user tries to create `/admins/{theirUid}` -> MUST DENY.
