/**
 * ============================================================
 *  BANK ACCOUNT ROUTES
 * ============================================================
 *  Routes for managing linked bank accounts:
 *    - Link, list, verify, unlink bank accounts
 *    - Set primary account
 *    - Set/change UPI PIN
 *
 *  All routes require JWT authentication.
 * ============================================================
 */

const express = require("express");
const router = express.Router();

// ─── Middleware ───
const { authMiddleware } = require("../middleware/auth.middleware");

// ─── Controller ───
const bankAccountController = require("../controllers/bankAccount.controller");

/**
 * POST /api/bank-accounts/link
 * Link a new bank account.
 * Protected: Auth
 *
 * Body: { bankCode, accountNumber, accountHolderName, accountType? }
 */
router.post(
    "/link",
    authMiddleware,
    bankAccountController.linkBankAccount
);

/**
 * GET /api/bank-accounts/
 * List all linked bank accounts.
 * Protected: Auth
 */
router.get(
    "/",
    authMiddleware,
    bankAccountController.listBankAccounts
);

/**
 * POST /api/bank-accounts/:id/verify
 * Verify a linked bank account via penny drop.
 * Protected: Auth
 */
router.post(
    "/:id/verify",
    authMiddleware,
    bankAccountController.verifyBankAccount
);

/**
 * DELETE /api/bank-accounts/:id
 * Unlink (deactivate) a bank account.
 * Protected: Auth
 */
router.delete(
    "/:id",
    authMiddleware,
    bankAccountController.unlinkBankAccount
);

/**
 * PUT /api/bank-accounts/:id/primary
 * Set a bank account as primary.
 * Protected: Auth
 */
router.put(
    "/:id/primary",
    authMiddleware,
    bankAccountController.setPrimaryAccount
);

/**
 * POST /api/bank-accounts/:id/set-pin
 * Set or change UPI PIN for a bank account.
 * Protected: Auth
 *
 * Body: { newPin, currentPin? (required only when changing) }
 */
router.post(
    "/:id/set-pin",
    authMiddleware,
    bankAccountController.setUpiPin
);

module.exports = router;
