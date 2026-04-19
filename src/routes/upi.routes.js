/**
 * ============================================================
 *  UPI PAYMENT ROUTES
 * ============================================================
 *  Routes for UPI payment operations:
 *    - P2P payments
 *    - P2M merchant payments
 *    - Collect requests
 *    - Transaction history
 *    - Refunds
 *
 *  All routes require JWT authentication.
 *  Payment routes additionally require rate limiting.
 * ============================================================
 */

const express = require("express");
const router = express.Router();

// ─── Middleware ───
const { authMiddleware } = require("../middleware/auth.middleware");
const { paymentLimiter } = require("../middleware/rateLimiter.middleware");

// ─── Controller ───
const upiController = require("../controllers/upi.controller");

/**
 * POST /api/upi/pay
 * Process a P2P (Person-to-Person) UPI payment.
 * Protected: Auth + Rate Limit
 *
 * Body: { senderVpa, receiverVpa, amount, upiPin, note? }
 */
router.post(
    "/pay",
    authMiddleware,
    paymentLimiter,
    upiController.payP2P
);

/**
 * POST /api/upi/pay/merchant
 * Process a P2M (Person-to-Merchant) UPI payment.
 * Protected: Auth + Rate Limit
 *
 * Body: { senderVpa, merchantVpa, amount, upiPin, note? }
 */
router.post(
    "/pay/merchant",
    authMiddleware,
    paymentLimiter,
    upiController.payMerchant
);

/**
 * POST /api/upi/collect
 * Create a new collect (pull payment) request.
 * Protected: Auth
 *
 * Body: { requesterVpa, payerVpa, amount, note? }
 */
router.post(
    "/collect",
    authMiddleware,
    upiController.createCollect
);

/**
 * POST /api/upi/collect/:requestId/respond
 * Approve or decline a collect request.
 * Protected: Auth
 *
 * Body: { action: "APPROVE" | "DECLINE", upiPin? }
 */
router.post(
    "/collect/:requestId/respond",
    authMiddleware,
    upiController.respondToCollect
);

/**
 * GET /api/upi/collect/pending
 * Get all pending collect requests for the authenticated user.
 * Protected: Auth
 */
router.get(
    "/collect/pending",
    authMiddleware,
    upiController.getPendingCollects
);

/**
 * GET /api/upi/transactions
 * Get transaction history for the authenticated user.
 * Protected: Auth
 *
 * Query: { page?, limit?, status?, type? }
 */
router.get(
    "/transactions",
    authMiddleware,
    upiController.getTransactionHistory
);

/**
 * POST /api/upi/refund
 * Reverse/refund a completed transaction.
 * Protected: Auth
 *
 * Body: { transactionId, reason }
 */
router.post(
    "/refund",
    authMiddleware,
    upiController.refundTransaction
);

module.exports = router;
