# UPI Banking System — Backend Expansion Plan

## Goal
Expand the existing Backend-Ledger into a full **UPI Banking System** backend with NPCI simulation, VPA management, bank linking, fraud detection, and admin APIs — **without modifying any existing files**.

---

## Existing Code (UNTOUCHED)
| Layer | Files |
|-------|-------|
| Models | `user.model.js`, `account.model.js`, `ledger.model.js`, `transaction.model.js`, `blackList.model.js` |
| Controllers | `auth.controller.js`, `account.controller.js`, `transaction.controller.js` |
| Routes | `auth.routes.js`, `account.routes.js`, `transaction.routes.js` |
| Middleware | `auth.middleware.js` |
| Services | `email.service.js` |
| Config | `db.js` |
| Entry | `app.js`, `server.js` |

---

## Proposed Changes

### 1. New Models (6 files)

#### [NEW] `src/models/upiId.model.js`
- VPA (Virtual Payment Address) schema: `vpa`, `accountId`, `userId`, `isDefault`, `isPrimary`
- Unique index on `vpa`
- Maps UPI ID → Bank Account

#### [NEW] `src/models/bankAccount.model.js`
- Bank account linking: `userId`, `bankName`, `bankCode` (IFSC), `accountNumber`, `accountHolderName`, `isVerified`, `isPrimary`
- Maps real bank accounts to internal accounts

#### [NEW] `src/models/collectRequest.model.js`
- Pull payment requests: `requesterId`, `payerId`, `payerVpa`, `requesterVpa`, `amount`, `status` (PENDING/APPROVED/DECLINED/EXPIRED), `expiresAt`

#### [NEW] `src/models/fraudAlert.model.js`
- Fraud detection events: `userId`, `transactionId`, `riskScore`, `riskLevel`, `triggers[]`, `status` (FLAGGED/REVIEWED/CLEARED), `reviewedBy`

#### [NEW] `src/models/notification.model.js`
- Notification log: `userId`, `type` (SMS/EMAIL/PUSH), `title`, `message`, `status` (SENT/FAILED/PENDING), `metadata`

#### [NEW] `src/models/auditLog.model.js`
- Immutable audit trail: `action`, `performedBy`, `targetUser`, `metadata`, `ipAddress`, `timestamp`
- All fields immutable (like ledger)

---

### 2. New Services (4 files)

#### [NEW] `src/services/npci.service.js`
- **NPCI Switch Simulator** — the core UPI routing engine
- `routePayment(senderVpa, receiverVpa, amount)` — simulates NPCI routing
- `validateVpa(vpa)` — VPA format + existence check
- `generateTransactionRef()` — 12-digit UPI reference number
- Simulated latency (100-500ms) to mirror real NPCI behavior

#### [NEW] `src/services/fraud.service.js`
- **Fraud Detection Engine**
- `assessRisk(userId, amount, metadata)` — returns risk score 0-100
- Rules: velocity check (>5 txns/min), high-value threshold (>₹1L), new device, unusual hours, rapid recipient changes
- Creates `FraudAlert` documents when score > threshold

#### [NEW] `src/services/notification.service.js`
- **Unified Notification Service**
- `sendTransactionAlert(userId, txnDetails)` — transaction notifications
- `sendCollectRequestNotification(payerId, requestDetails)` — collect request alerts
- `sendSecurityAlert(userId, alertType)` — security notifications
- Integrates with existing `email.service.js`, adds SMS/push stubs

#### [NEW] `src/services/upi.service.js`
- **UPI Business Logic Service**
- `processP2PPayment(senderVpa, receiverVpa, amount, pin)` — full P2P flow
- `processP2MPayment(senderVpa, merchantVpa, amount, pin)` — merchant payment
- `processCollectRequest(requesterVpa, payerVpa, amount)` — collect flow
- `reverseTransaction(txnId, reason)` — auto-reversal on failure
- Orchestrates: fraud check → NPCI route → ledger entries → notification

---

### 3. New Controllers (4 files)

#### [NEW] `src/controllers/upi.controller.js`
- `POST /api/upi/pay` — P2P payment via VPA
- `POST /api/upi/pay/merchant` — P2M QR payment
- `POST /api/upi/collect` — Create collect request
- `POST /api/upi/collect/:requestId/respond` — Approve/decline collect
- `GET /api/upi/transactions` — Transaction history with filters

#### [NEW] `src/controllers/upiId.controller.js`
- `POST /api/upi-id/` — Create UPI ID
- `GET /api/upi-id/` — List user's UPI IDs
- `DELETE /api/upi-id/:vpa` — Deactivate UPI ID
- `PUT /api/upi-id/:vpa/default` — Set default VPA
- `GET /api/upi-id/resolve/:vpa` — Resolve VPA to account name

#### [NEW] `src/controllers/bankAccount.controller.js`
- `POST /api/bank-accounts/link` — Link bank account
- `GET /api/bank-accounts/` — List linked accounts
- `POST /api/bank-accounts/:id/verify` — Verify account (penny drop simulation)
- `DELETE /api/bank-accounts/:id` — Unlink account
- `PUT /api/bank-accounts/:id/primary` — Set primary account

#### [NEW] `src/controllers/admin.controller.js`
- `GET /api/admin/transactions` — All transactions with filters
- `GET /api/admin/fraud-alerts` — Fraud alerts dashboard
- `PUT /api/admin/fraud-alerts/:id/review` — Review fraud alert
- `POST /api/admin/users/:id/block` — Block user
- `POST /api/admin/users/:id/unblock` — Unblock user
- `GET /api/admin/stats` — System statistics (volume, success rate, etc.)

---

### 4. New Routes (4 files)

#### [NEW] `src/routes/upi.routes.js`
#### [NEW] `src/routes/upiId.routes.js`
#### [NEW] `src/routes/bankAccount.routes.js`
#### [NEW] `src/routes/admin.routes.js`

---

### 5. New Middleware (2 files)

#### [NEW] `src/middleware/rateLimiter.middleware.js`
- In-memory rate limiter (no Redis dependency)
- Configurable: window size, max requests
- Per-IP and per-user limiting

#### [NEW] `src/middleware/upiPin.middleware.js`
- UPI PIN validation middleware
- PIN encryption/verification
- Max retry lockout (3 attempts → 30 min block)

---

### 6. New Config (1 file)

#### [NEW] `src/config/upi.config.js`
- UPI system constants: transaction limits, VPA rules, NPCI timeouts
- Bank code mappings (IFSC simulation)
- Fraud thresholds

---

### 7. App Integration (1 file)

#### [NEW] `src/app.upi.js`
- New Express app that extends the original `app.js`
- Imports original app + mounts all new routes
- Zero changes to `app.js`

---

## Architecture Flow

```
User App → API Gateway (rate limit) → UPI Controller
    → UPI PIN Validation
    → Fraud Detection Engine (risk score)
    → NPCI Switch Simulator (route payment)
    → Ledger Service (double-entry, existing)
    → Notification Service (email/SMS/push)
    → Response
```

---

## Verification Plan

### Automated Tests
- `npm run dev` — Server starts without errors
- All new routes respond correctly
- Existing routes remain functional (backward compatibility)

### Manual Verification
- Test UPI pay flow via Postman
- Test collect request lifecycle
- Test fraud detection triggers
- Test admin dashboard APIs

---

## New Dependencies
- `crypto` (built-in Node.js — for PIN hashing, reference generation)
- `uuid` (for UPI transaction reference IDs)

No heavy external dependencies added.
