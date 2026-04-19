/**
 * ============================================================
 *  UPI PIN VALIDATION MIDDLEWARE
 * ============================================================
 *  Middleware that validates the UPI PIN before processing
 *  any payment request. This is the second factor in UPI's
 *  two-factor authentication:
 *    Factor 1: Device binding + JWT token (handled by auth middleware)
 *    Factor 2: UPI PIN (handled by this middleware)
 *
 *  Flow:
 *    1. Extract UPI PIN from request body
 *    2. Find the sender's bank account linked to the VPA
 *    3. Verify PIN against stored hash
 *    4. Handle lockout on max failed attempts
 *    5. If valid, allow request to proceed
 *
 *  Security considerations:
 *    - PIN is never logged or stored in plain text
 *    - PIN is hashed with bcrypt (12 salt rounds)
 *    - Max 3 attempts before 30-minute lockout
 *    - Lockout info is tracked per bank account
 * ============================================================
 */

const bankAccountModel = require("../models/bankAccount.model");
const upiIdModel = require("../models/upiId.model");
const auditLogModel = require("../models/auditLog.model");
const notificationService = require("../services/notification.service");

/**
 * UPI PIN validation middleware.
 * Expects req.body to contain:
 *   - senderVpa: The VPA being used for the payment
 *   - upiPin: The 6-digit UPI PIN
 *
 * On success: Sets req.bankAccount with the verified bank account
 * On failure: Returns 401/403 with appropriate error message
 */
async function validateUpiPin(req, res, next) {
    try {
        const { senderVpa, upiPin } = req.body;

        // ─── Step 1: Validate required fields ───
        if (!upiPin) {
            return res.status(400).json({
                status: "error",
                message: "UPI PIN is required for this transaction"
            });
        }

        if (!senderVpa) {
            return res.status(400).json({
                status: "error",
                message: "Sender VPA is required"
            });
        }

        // ─── Step 2: Validate PIN format (6 digits) ───
        if (!/^\d{6}$/.test(upiPin)) {
            return res.status(400).json({
                status: "error",
                message: "UPI PIN must be exactly 6 digits"
            });
        }

        // ─── Step 3: Find the VPA and its linked bank account ───
        const vpaRecord = await upiIdModel.findOne({
            vpa: senderVpa.toLowerCase(),
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!vpaRecord) {
            return res.status(404).json({
                status: "error",
                message: "VPA not found or you don't own this VPA"
            });
        }

        // Find the bank account linked to this VPA's account
        const bankAccount = await bankAccountModel
            .findOne({
                internalAccount: vpaRecord.account,
                user: req.user._id,
                status: "ACTIVE"
            })
            .select("+upiPinHash +pinAttempts +lockedUntil");

        if (!bankAccount) {
            return res.status(404).json({
                status: "error",
                message: "No bank account linked to this VPA. Please link a bank account first."
            });
        }

        // ─── Step 4: Check if UPI PIN has been set ───
        if (!bankAccount.isPinSet) {
            return res.status(400).json({
                status: "error",
                message: "UPI PIN not set for this bank account. Please set your UPI PIN first."
            });
        }

        // ─── Step 5: Verify UPI PIN ───
        const pinResult = await bankAccount.verifyUpiPin(upiPin);

        if (!pinResult.success) {
            // Log failed PIN attempt
            await auditLogModel.create({
                action: "UPI_PIN_FAILED",
                performedBy: req.user._id,
                resourceType: "bankAccount",
                resourceId: bankAccount._id,
                metadata: {
                    vpa: senderVpa,
                    remainingAttempts: pinResult.message
                },
                ipAddress: req.ip,
                severity: "WARNING"
            });

            // If locked, send security alert
            if (pinResult.message.includes("locked")) {
                await auditLogModel.create({
                    action: "UPI_PIN_LOCKED",
                    performedBy: req.user._id,
                    resourceType: "bankAccount",
                    resourceId: bankAccount._id,
                    ipAddress: req.ip,
                    severity: "CRITICAL"
                });

                // Send security notification
                notificationService.sendSecurityAlert(
                    req.user._id,
                    "PIN_LOCKED",
                    { vpa: senderVpa }
                ).catch(err => console.error("Security alert error:", err.message));
            }

            return res.status(401).json({
                status: "error",
                message: pinResult.message
            });
        }

        // ─── Step 6: PIN verified — attach bank account and proceed ───
        req.bankAccount = bankAccount;
        return next();

    } catch (error) {
        console.error("UPI PIN validation error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal error during PIN validation"
        });
    }
}

/**
 * Optional UPI PIN middleware — skips validation if no PIN provided.
 * Used for endpoints where PIN is optional (e.g., checking balance).
 */
async function optionalUpiPin(req, res, next) {
    if (req.body.upiPin) {
        return validateUpiPin(req, res, next);
    }
    return next();
}

module.exports = {
    validateUpiPin,
    optionalUpiPin
};
