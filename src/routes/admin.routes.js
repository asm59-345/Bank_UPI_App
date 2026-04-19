/**
 * ============================================================
 *  ADMIN PANEL ROUTES
 * ============================================================
 *  Administrative routes for system monitoring and management.
 *  All routes require system user authentication.
 *
 *  Access control: Only users with systemUser=true can access.
 *  This uses the existing authSystemUserMiddleware from
 *  auth.middleware.js (no modification needed).
 * ============================================================
 */

const express = require("express");
const router = express.Router();

// ─── Middleware ───
const { authSystemUserMiddleware } = require("../middleware/auth.middleware");

// ─── Controller ───
const adminController = require("../controllers/admin.controller");

/**
 * GET /api/admin/stats
 * Get system-wide statistics (dashboard overview).
 * Protected: System User only
 */
router.get(
    "/stats",
    authSystemUserMiddleware,
    adminController.getSystemStats
);

/**
 * GET /api/admin/transactions
 * Get all transactions with filtering and pagination.
 * Protected: System User only
 *
 * Query: { page?, limit?, status?, startDate?, endDate?, minAmount?, maxAmount? }
 */
router.get(
    "/transactions",
    authSystemUserMiddleware,
    adminController.getAllTransactions
);

/**
 * GET /api/admin/fraud-alerts
 * Get fraud alerts for the dashboard.
 * Protected: System User only
 *
 * Query: { page?, limit?, status?, riskLevel?, startDate?, endDate? }
 */
router.get(
    "/fraud-alerts",
    authSystemUserMiddleware,
    adminController.getFraudAlerts
);

/**
 * PUT /api/admin/fraud-alerts/:id/review
 * Review a fraud alert.
 * Protected: System User only
 *
 * Body: { status: "CLEARED"|"CONFIRMED_FRAUD"|"ESCALATED", notes? }
 */
router.put(
    "/fraud-alerts/:id/review",
    authSystemUserMiddleware,
    adminController.reviewFraudAlert
);

/**
 * POST /api/admin/users/:id/block
 * Block a user (freeze accounts, deactivate VPAs).
 * Protected: System User only
 *
 * Body: { reason? }
 */
router.post(
    "/users/:id/block",
    authSystemUserMiddleware,
    adminController.blockUser
);

/**
 * POST /api/admin/users/:id/unblock
 * Unblock a previously blocked user.
 * Protected: System User only
 */
router.post(
    "/users/:id/unblock",
    authSystemUserMiddleware,
    adminController.unblockUser
);

/**
 * GET /api/admin/audit-logs
 * Get system audit logs.
 * Protected: System User only
 *
 * Query: { page?, limit?, action?, severity?, userId?, startDate?, endDate? }
 */
router.get(
    "/audit-logs",
    authSystemUserMiddleware,
    adminController.getAuditLogs
);

module.exports = router;
