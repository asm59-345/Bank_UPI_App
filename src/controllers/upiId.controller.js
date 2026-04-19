/**
 * ============================================================
 *  UPI ID (VPA) CONTROLLER
 * ============================================================
 *  Manages Virtual Payment Addresses (VPAs) — the UPI IDs
 *  that users use to send and receive money.
 *
 *  Endpoints:
 *    - POST   /api/upi-id/              → Create new UPI ID
 *    - GET    /api/upi-id/              → List user's UPI IDs
 *    - DELETE /api/upi-id/:vpa          → Deactivate a UPI ID
 *    - PUT    /api/upi-id/:vpa/default  → Set as default VPA
 *    - GET    /api/upi-id/resolve/:vpa  → Resolve VPA to name
 * ============================================================
 */

const upiIdModel = require("../models/upiId.model");
const accountModel = require("../models/account.model");
const auditLogModel = require("../models/auditLog.model");
const npciService = require("../services/npci.service");
const UPI_CONFIG = require("../config/upi.config");

/**
 * POST /api/upi-id/
 * Create a new UPI ID (VPA) for the authenticated user.
 *
 * Request body:
 *   - username: string (the part before @, e.g., "johndoe")
 *   - bankHandle: string (optional, defaults to "upi")
 *   - accountId: string (internal account ID to link)
 *   - displayName: string (optional, name shown to payers)
 *
 * The final VPA will be: username@bankHandle
 */
async function createUpiId(req, res) {
    try {
        const { username, bankHandle, accountId, displayName } = req.body;

        // ─── Validate required fields ───
        if (!username || !accountId) {
            return res.status(400).json({
                status: "error",
                message: "username and accountId are required"
            });
        }

        // ─── Validate username format ───
        if (!/^[a-zA-Z0-9._]{3,50}$/.test(username)) {
            return res.status(400).json({
                status: "error",
                message: "Username must be 3-50 characters, containing only letters, numbers, dots, and underscores"
            });
        }

        // ─── Validate bank handle ───
        const handle = (bankHandle || UPI_CONFIG.VPA_RULES.DEFAULT_HANDLE).toLowerCase();
        if (!UPI_CONFIG.VPA_RULES.SUPPORTED_HANDLES.includes(handle)) {
            return res.status(400).json({
                status: "error",
                message: `Unsupported bank handle. Supported: ${UPI_CONFIG.VPA_RULES.SUPPORTED_HANDLES.join(", ")}`
            });
        }

        // ─── Construct VPA ───
        const vpa = `${username.toLowerCase()}@${handle}`;

        // ─── Check VPA uniqueness ───
        const existingVpa = await upiIdModel.findOne({ vpa });
        if (existingVpa) {
            return res.status(409).json({
                status: "error",
                message: `VPA '${vpa}' is already taken. Please choose a different username.`
            });
        }

        // ─── Validate account ownership ───
        const account = await accountModel.findOne({
            _id: accountId,
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!account) {
            return res.status(404).json({
                status: "error",
                message: "Account not found or you don't own this account"
            });
        }

        // ─── Check max VPAs per user ───
        const userVpaCount = await upiIdModel.countDocuments({
            user: req.user._id,
            status: "ACTIVE"
        });

        if (userVpaCount >= UPI_CONFIG.VPA_RULES.MAX_VPA_PER_USER) {
            return res.status(400).json({
                status: "error",
                message: `Maximum ${UPI_CONFIG.VPA_RULES.MAX_VPA_PER_USER} VPAs allowed per user`
            });
        }

        // ─── Set as default if it's the user's first VPA ───
        const isDefault = userVpaCount === 0;

        // ─── Create VPA ───
        const newVpa = await upiIdModel.create({
            vpa: vpa,
            account: accountId,
            user: req.user._id,
            isDefault: isDefault,
            displayName: displayName || req.user.name,
            bankHandle: handle
        });

        // ─── Audit log ───
        await auditLogModel.create({
            action: "VPA_CREATED",
            performedBy: req.user._id,
            resourceType: "upiId",
            resourceId: newVpa._id,
            metadata: { vpa: vpa, accountId: accountId, isDefault },
            ipAddress: req.ip,
            severity: "INFO"
        });

        return res.status(201).json({
            status: "success",
            message: `UPI ID '${vpa}' created successfully`,
            data: {
                vpa: newVpa.vpa,
                displayName: newVpa.displayName,
                isDefault: newVpa.isDefault,
                bankHandle: newVpa.bankHandle,
                accountId: newVpa.account,
                status: newVpa.status,
                createdAt: newVpa.createdAt
            }
        });

    } catch (error) {
        console.error("Create UPI ID error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error while creating UPI ID"
        });
    }
}

/**
 * GET /api/upi-id/
 * List all UPI IDs belonging to the authenticated user.
 */
async function listUpiIds(req, res) {
    try {
        const vpas = await upiIdModel
            .find({ user: req.user._id })
            .populate("account", "status currency")
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        return res.status(200).json({
            status: "success",
            data: {
                upiIds: vpas,
                total: vpas.length
            }
        });

    } catch (error) {
        console.error("List UPI IDs error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * DELETE /api/upi-id/:vpa
 * Deactivate (soft delete) a UPI ID.
 * VPAs are never hard-deleted for audit trail purposes.
 */
async function deactivateUpiId(req, res) {
    try {
        const { vpa } = req.params;

        const vpaRecord = await upiIdModel.findOne({
            vpa: vpa.toLowerCase(),
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!vpaRecord) {
            return res.status(404).json({
                status: "error",
                message: "UPI ID not found or already deactivated"
            });
        }

        // Cannot deactivate default VPA if it's the only one
        if (vpaRecord.isDefault) {
            const activeCount = await upiIdModel.countDocuments({
                user: req.user._id,
                status: "ACTIVE"
            });

            if (activeCount <= 1) {
                return res.status(400).json({
                    status: "error",
                    message: "Cannot deactivate your only UPI ID. Create another one first."
                });
            }

            // Transfer default to another VPA
            const otherVpa = await upiIdModel.findOne({
                user: req.user._id,
                status: "ACTIVE",
                _id: { $ne: vpaRecord._id }
            });

            if (otherVpa) {
                otherVpa.isDefault = true;
                await otherVpa.save();
            }
        }

        vpaRecord.status = "INACTIVE";
        vpaRecord.isDefault = false;
        await vpaRecord.save();

        // Audit log
        await auditLogModel.create({
            action: "VPA_DEACTIVATED",
            performedBy: req.user._id,
            resourceType: "upiId",
            resourceId: vpaRecord._id,
            metadata: { vpa: vpa },
            ipAddress: req.ip,
            severity: "INFO"
        });

        return res.status(200).json({
            status: "success",
            message: `UPI ID '${vpa}' has been deactivated`
        });

    } catch (error) {
        console.error("Deactivate UPI ID error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * PUT /api/upi-id/:vpa/default
 * Set a UPI ID as the user's default VPA.
 */
async function setDefaultUpiId(req, res) {
    try {
        const { vpa } = req.params;

        const vpaRecord = await upiIdModel.findOne({
            vpa: vpa.toLowerCase(),
            user: req.user._id,
            status: "ACTIVE"
        });

        if (!vpaRecord) {
            return res.status(404).json({
                status: "error",
                message: "UPI ID not found or inactive"
            });
        }

        // Remove default from all other VPAs
        await upiIdModel.updateMany(
            { user: req.user._id, isDefault: true },
            { isDefault: false }
        );

        // Set this VPA as default
        vpaRecord.isDefault = true;
        await vpaRecord.save();

        // Audit log
        await auditLogModel.create({
            action: "VPA_DEFAULT_CHANGED",
            performedBy: req.user._id,
            resourceType: "upiId",
            resourceId: vpaRecord._id,
            metadata: { vpa: vpa },
            ipAddress: req.ip,
            severity: "INFO"
        });

        return res.status(200).json({
            status: "success",
            message: `'${vpa}' is now your default UPI ID`
        });

    } catch (error) {
        console.error("Set default UPI ID error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * GET /api/upi-id/resolve/:vpa
 * Resolve a VPA to its owner's display name.
 * This is what happens when you enter a VPA in GPay/PhonePe
 * before confirming a payment — it shows you the name.
 */
async function resolveUpiId(req, res) {
    try {
        const { vpa } = req.params;

        const result = await npciService.resolveVpa(vpa);

        if (!result.success) {
            return res.status(404).json({
                status: "error",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            data: {
                vpa: result.vpa,
                displayName: result.displayName,
                bankHandle: result.bankHandle
            }
        });

    } catch (error) {
        console.error("Resolve VPA error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

module.exports = {
    createUpiId,
    listUpiIds,
    deactivateUpiId,
    setDefaultUpiId,
    resolveUpiId
};
