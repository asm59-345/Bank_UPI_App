/**
 * ============================================================
 *  BANK ACCOUNT CONTROLLER
 * ============================================================
 *  Manages external bank account linking — the process of
 *  connecting a user's real bank account to our UPI system.
 *
 *  Endpoints:
 *    - POST   /api/bank-accounts/link          → Link bank account
 *    - GET    /api/bank-accounts/              → List linked accounts
 *    - POST   /api/bank-accounts/:id/verify    → Verify via penny drop
 *    - DELETE /api/bank-accounts/:id           → Unlink account
 *    - PUT    /api/bank-accounts/:id/primary   → Set as primary
 *    - POST   /api/bank-accounts/:id/set-pin   → Set/change UPI PIN
 * ============================================================
 */

const crypto = require("crypto");
const bankAccountModel = require("../models/bankAccount.model");
const accountModel = require("../models/account.model");
const auditLogModel = require("../models/auditLog.model");
const notificationService = require("../services/notification.service");
const UPI_CONFIG = require("../config/upi.config");

/**
 * POST /api/bank-accounts/link
 * Link a new bank account to the user's UPI profile.
 *
 * Request body:
 *   - bankCode: string (IFSC code, e.g., "SBIN0001234")
 *   - accountNumber: string (full bank account number)
 *   - accountHolderName: string (name as per bank records)
 *   - accountType: string ("SAVINGS" or "CURRENT", default "SAVINGS")
 *
 * This creates both:
 *   1. An internal ledger account (in existing account model)
 *   2. A bank account link record (in new bankAccount model)
 */
async function linkBankAccount(req, res) {
    try {
        const { bankCode, accountNumber, accountHolderName, accountType } = req.body;

        // ─── Validate required fields ───
        if (!bankCode || !accountNumber || !accountHolderName) {
            return res.status(400).json({
                status: "error",
                message: "bankCode (IFSC), accountNumber, and accountHolderName are required"
            });
        }

        // ─── Validate IFSC format ───
        if (!/^[A-Z]{4}[0-9]{7}$/.test(bankCode.toUpperCase())) {
            return res.status(400).json({
                status: "error",
                message: "Invalid IFSC code format. Expected: 4 letters + 7 digits (e.g., SBIN0001234)"
            });
        }

        // ─── Look up bank from IFSC prefix ───
        const ifscPrefix = bankCode.substring(0, 4).toUpperCase();
        const bankInfo = UPI_CONFIG.BANK_CODES[ifscPrefix];
        const bankName = bankInfo ? bankInfo.name : `Bank (${ifscPrefix})`;

        // ─── Hash the account number (for duplicate detection) ───
        const accountNumberHash = crypto
            .createHash("sha256")
            .update(accountNumber.trim())
            .digest("hex");

        // ─── Mask account number (show only last 4 digits) ───
        const masked = "XXXX" + accountNumber.slice(-4);

        // ─── Check for duplicate bank account link ───
        const existing = await bankAccountModel.findOne({
            user: req.user._id,
            accountNumberHash: accountNumberHash
        });

        if (existing) {
            return res.status(409).json({
                status: "error",
                message: `Bank account ending in ${masked.slice(-4)} is already linked`
            });
        }

        // ─── Create internal ledger account for this bank account ───
        const internalAccount = await accountModel.create({
            user: req.user._id,
            status: "ACTIVE",
            currency: "INR"
        });

        // ─── Determine if this should be primary (first account = primary) ───
        const existingCount = await bankAccountModel.countDocuments({
            user: req.user._id,
            status: "ACTIVE"
        });
        const isPrimary = existingCount === 0;

        // ─── Create bank account link ───
        const bankAccount = await bankAccountModel.create({
            user: req.user._id,
            internalAccount: internalAccount._id,
            bankName: bankName,
            bankCode: bankCode.toUpperCase(),
            accountNumberMasked: masked,
            accountNumberHash: accountNumberHash,
            accountHolderName: accountHolderName.trim(),
            accountType: accountType || "SAVINGS",
            isPrimary: isPrimary,
            isVerified: false,
            isPinSet: false
        });

        // ─── Audit log ───
        await auditLogModel.create({
            action: "BANK_ACCOUNT_LINKED",
            performedBy: req.user._id,
            resourceType: "bankAccount",
            resourceId: bankAccount._id,
            metadata: {
                bankName,
                bankCode: bankCode.toUpperCase(),
                accountMasked: masked,
                isPrimary
            },
            ipAddress: req.ip,
            severity: "INFO"
        });

        // ─── Security notification ───
        notificationService.sendSecurityAlert(
            req.user._id,
            "BANK_LINKED",
            { accountLast4: accountNumber.slice(-4) }
        ).catch(err => console.error("Notification error:", err.message));

        return res.status(201).json({
            status: "success",
            message: `Bank account (${bankName}) linked successfully`,
            data: {
                id: bankAccount._id,
                bankName: bankAccount.bankName,
                bankCode: bankAccount.bankCode,
                accountMasked: bankAccount.accountNumberMasked,
                accountHolderName: bankAccount.accountHolderName,
                accountType: bankAccount.accountType,
                isPrimary: bankAccount.isPrimary,
                isVerified: bankAccount.isVerified,
                isPinSet: bankAccount.isPinSet,
                internalAccountId: internalAccount._id,
                createdAt: bankAccount.createdAt
            }
        });

    } catch (error) {
        console.error("Link bank account error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error while linking bank account"
        });
    }
}

/**
 * GET /api/bank-accounts/
 * List all bank accounts linked by the authenticated user.
 */
async function listBankAccounts(req, res) {
    try {
        const accounts = await bankAccountModel
            .find({ user: req.user._id })
            .select("-accountNumberHash")
            .populate("internalAccount", "status currency")
            .sort({ isPrimary: -1, createdAt: -1 })
            .lean();

        return res.status(200).json({
            status: "success",
            data: {
                bankAccounts: accounts,
                total: accounts.length
            }
        });

    } catch (error) {
        console.error("List bank accounts error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * POST /api/bank-accounts/:id/verify
 * Verify a linked bank account via penny drop simulation.
 *
 * In real UPI, the bank verifies ownership by:
 *   1. Sending ₹1 to the bank account
 *   2. User confirms they received it
 *   3. Account is marked as verified
 *
 * This endpoint simulates that process.
 */
async function verifyBankAccount(req, res) {
    try {
        const { id } = req.params;

        const bankAccount = await bankAccountModel.findOne({
            _id: id,
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!bankAccount) {
            return res.status(404).json({
                status: "error",
                message: "Bank account not found"
            });
        }

        if (bankAccount.isVerified) {
            return res.status(200).json({
                status: "success",
                message: "Bank account is already verified"
            });
        }

        // ─── Simulate penny drop verification ───
        // In production, this would call the bank's API
        // Simulate a small delay to mimic bank API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Mark as verified (95% success rate simulation)
        const verificationSuccess = Math.random() < 0.95;

        if (!verificationSuccess) {
            return res.status(400).json({
                status: "error",
                message: "Verification failed. Bank did not respond. Please try again."
            });
        }

        bankAccount.isVerified = true;
        await bankAccount.save();

        // Audit log
        await auditLogModel.create({
            action: "BANK_ACCOUNT_VERIFIED",
            performedBy: req.user._id,
            resourceType: "bankAccount",
            resourceId: bankAccount._id,
            metadata: { bankName: bankAccount.bankName },
            ipAddress: req.ip,
            severity: "INFO"
        });

        // Notification
        notificationService.sendSecurityAlert(
            req.user._id,
            "BANK_VERIFIED",
            { accountLast4: bankAccount.accountNumberMasked.slice(-4) }
        ).catch(err => console.error("Notification error:", err.message));

        return res.status(200).json({
            status: "success",
            message: "Bank account verified successfully via penny drop"
        });

    } catch (error) {
        console.error("Verify bank account error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * DELETE /api/bank-accounts/:id
 * Unlink (deactivate) a bank account.
 */
async function unlinkBankAccount(req, res) {
    try {
        const { id } = req.params;

        const bankAccount = await bankAccountModel.findOne({
            _id: id,
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!bankAccount) {
            return res.status(404).json({
                status: "error",
                message: "Bank account not found"
            });
        }

        // Can't unlink if it's the only account
        const activeCount = await bankAccountModel.countDocuments({
            user: req.user._id,
            status: "ACTIVE"
        });

        if (activeCount <= 1) {
            return res.status(400).json({
                status: "error",
                message: "Cannot unlink your only bank account. Link another account first."
            });
        }

        bankAccount.status = "INACTIVE";

        // If this was primary, transfer primary to another account
        if (bankAccount.isPrimary) {
            bankAccount.isPrimary = false;
            const otherAccount = await bankAccountModel.findOne({
                user: req.user._id,
                status: "ACTIVE",
                _id: { $ne: bankAccount._id }
            });
            if (otherAccount) {
                otherAccount.isPrimary = true;
                await otherAccount.save();
            }
        }

        await bankAccount.save();

        // Audit log
        await auditLogModel.create({
            action: "BANK_ACCOUNT_UNLINKED",
            performedBy: req.user._id,
            resourceType: "bankAccount",
            resourceId: bankAccount._id,
            metadata: { bankName: bankAccount.bankName },
            ipAddress: req.ip,
            severity: "INFO"
        });

        return res.status(200).json({
            status: "success",
            message: `Bank account (${bankAccount.bankName}) unlinked successfully`
        });

    } catch (error) {
        console.error("Unlink bank account error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * PUT /api/bank-accounts/:id/primary
 * Set a bank account as the user's primary account.
 */
async function setPrimaryAccount(req, res) {
    try {
        const { id } = req.params;

        const bankAccount = await bankAccountModel.findOne({
            _id: id,
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!bankAccount) {
            return res.status(404).json({
                status: "error",
                message: "Bank account not found"
            });
        }

        // Remove primary from all accounts
        await bankAccountModel.updateMany(
            { user: req.user._id, isPrimary: true },
            { isPrimary: false }
        );

        // Set this as primary
        bankAccount.isPrimary = true;
        await bankAccount.save();

        return res.status(200).json({
            status: "success",
            message: `${bankAccount.bankName} account is now your primary account`
        });

    } catch (error) {
        console.error("Set primary error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * POST /api/bank-accounts/:id/set-pin
 * Set or change the UPI PIN for a bank account.
 *
 * Request body:
 *   - newPin: string (6-digit PIN)
 *   - currentPin: string (required only when changing existing PIN)
 */
async function setUpiPin(req, res) {
    try {
        const { id } = req.params;
        const { newPin, currentPin } = req.body;

        // Validate new PIN format
        if (!newPin || !/^\d{6}$/.test(newPin)) {
            return res.status(400).json({
                status: "error",
                message: "UPI PIN must be exactly 6 digits"
            });
        }

        const bankAccount = await bankAccountModel
            .findOne({
                _id: id,
                user: req.user._id,
                status: "ACTIVE"
            })
            .select("+upiPinHash +pinAttempts +lockedUntil");

        if (!bankAccount) {
            return res.status(404).json({
                status: "error",
                message: "Bank account not found"
            });
        }

        // Capture state BEFORE mutation so response message is correct
        const wasPinAlreadySet = bankAccount.isPinSet;

        // If PIN already set, require current PIN for change
        if (wasPinAlreadySet) {
            if (!currentPin) {
                return res.status(400).json({
                    status: "error",
                    message: "Current PIN is required to change your UPI PIN"
                });
            }

            const verification = await bankAccount.verifyUpiPin(currentPin);
            if (!verification.success) {
                return res.status(401).json({
                    status: "error",
                    message: verification.message
                });
            }

            // Audit: PIN changed
            await auditLogModel.create({
                action: "UPI_PIN_CHANGED",
                performedBy: req.user._id,
                resourceType: "bankAccount",
                resourceId: bankAccount._id,
                ipAddress: req.ip,
                severity: "WARNING"
            });
        } else {
            // Audit: PIN set for first time
            await auditLogModel.create({
                action: "UPI_PIN_SET",
                performedBy: req.user._id,
                resourceType: "bankAccount",
                resourceId: bankAccount._id,
                ipAddress: req.ip,
                severity: "INFO"
            });
        }

        // Set the new PIN (hashed via model method — sets isPinSet to true)
        await bankAccount.setUpiPin(newPin);

        // Security notification
        notificationService.sendSecurityAlert(
            req.user._id,
            "PIN_CHANGED",
            {}
        ).catch(err => console.error("Notification error:", err.message));

        return res.status(200).json({
            status: "success",
            message: wasPinAlreadySet
                ? "UPI PIN changed successfully"
                : "UPI PIN set successfully"
        });

    } catch (error) {
        console.error("Set UPI PIN error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

module.exports = {
    linkBankAccount,
    listBankAccounts,
    verifyBankAccount,
    unlinkBankAccount,
    setPrimaryAccount,
    setUpiPin
};
