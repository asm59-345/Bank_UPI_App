/**
 * ============================================================
 *  UPI ID (VPA) ROUTES
 * ============================================================
 *  Routes for managing Virtual Payment Addresses:
 *    - Create, list, deactivate UPI IDs
 *    - Set default VPA
 *    - Resolve VPA to display name
 *
 *  All routes require JWT authentication.
 * ============================================================
 */

const express = require("express");
const router = express.Router();

// ─── Middleware ───
const { authMiddleware } = require("../middleware/auth.middleware");

// ─── Controller ───
const upiIdController = require("../controllers/upiId.controller");

/**
 * POST /api/upi-id/
 * Create a new UPI ID (VPA).
 * Protected: Auth
 *
 * Body: { username, accountId, bankHandle?, displayName? }
 */
router.post(
    "/",
    authMiddleware,
    upiIdController.createUpiId
);

/**
 * GET /api/upi-id/
 * List all UPI IDs belonging to the authenticated user.
 * Protected: Auth
 */
router.get(
    "/",
    authMiddleware,
    upiIdController.listUpiIds
);

/**
 * GET /api/upi-id/resolve/:vpa
 * Resolve a VPA to its owner's display name.
 * Protected: Auth (anyone can look up a VPA to see the name)
 *
 * Note: This endpoint is intentionally placed BEFORE /:vpa
 *       routes to avoid "resolve" being treated as a VPA param.
 */
router.get(
    "/resolve/:vpa",
    authMiddleware,
    upiIdController.resolveUpiId
);

/**
 * DELETE /api/upi-id/:vpa
 * Deactivate (soft delete) a UPI ID.
 * Protected: Auth
 */
router.delete(
    "/:vpa",
    authMiddleware,
    upiIdController.deactivateUpiId
);

/**
 * PUT /api/upi-id/:vpa/default
 * Set a UPI ID as the user's default VPA.
 * Protected: Auth
 */
router.put(
    "/:vpa/default",
    authMiddleware,
    upiIdController.setDefaultUpiId
);

module.exports = router;
