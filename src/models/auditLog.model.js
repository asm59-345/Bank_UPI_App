/**
 * ============================================================
 *  AUDIT LOG MODEL — Immutable System Activity Trail
 * ============================================================
 *  Records every significant action in the system for
 *  compliance and security auditing. Like the ledger model,
 *  audit log entries are immutable — they cannot be updated
 *  or deleted once created.
 *
 *  Required by:
 *    - RBI compliance for payment systems
 *    - PCI DSS audit trail requirements
 *    - Internal security monitoring
 *
 *  Logs actions like:
 *    - User registration, login, logout
 *    - Account creation, bank linking
 *    - VPA creation
 *    - Payment initiation, completion, failure
 *    - Admin actions (user blocking, fraud review)
 *    - PIN changes, security events
 * ============================================================
 */

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({

    // ─── The type of action performed ───
    action: {
        type: String,
        required: [true, "Audit action is required"],
        immutable: true,
        enum: {
            values: [
                // Auth events
                "USER_REGISTER",
                "USER_LOGIN",
                "USER_LOGOUT",
                "USER_BLOCKED",
                "USER_UNBLOCKED",

                // Account events
                "ACCOUNT_CREATED",
                "ACCOUNT_FROZEN",
                "ACCOUNT_CLOSED",

                // Bank account events
                "BANK_ACCOUNT_LINKED",
                "BANK_ACCOUNT_VERIFIED",
                "BANK_ACCOUNT_UNLINKED",

                // VPA events
                "VPA_CREATED",
                "VPA_DEACTIVATED",
                "VPA_DEFAULT_CHANGED",

                // UPI PIN events
                "UPI_PIN_SET",
                "UPI_PIN_CHANGED",
                "UPI_PIN_FAILED",
                "UPI_PIN_LOCKED",

                // Payment events
                "PAYMENT_INITIATED",
                "PAYMENT_COMPLETED",
                "PAYMENT_FAILED",
                "PAYMENT_REVERSED",

                // Collect request events
                "COLLECT_REQUEST_CREATED",
                "COLLECT_REQUEST_APPROVED",
                "COLLECT_REQUEST_DECLINED",
                "COLLECT_REQUEST_EXPIRED",

                // Fraud events
                "FRAUD_ALERT_CREATED",
                "FRAUD_ALERT_REVIEWED",
                "FRAUD_ALERT_ESCALATED",
                "TRANSACTION_BLOCKED",

                // Admin events
                "ADMIN_ACTION",
            ],
            message: "Invalid audit action type"
        }
    },

    // ─── The user who performed the action ───
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Performing user ID is required"],
        immutable: true,
        index: true
    },

    // ─── The user affected by the action (if different from performer) ───
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null,
        immutable: true,
        index: true
    },

    // ─── Reference to a related resource (transaction, account, etc.) ───
    resourceType: {
        type: String,
        enum: ["transaction", "account", "bankAccount", "upiId", "collectRequest", "fraudAlert", "user"],
        immutable: true
    },

    // ─── ID of the related resource ───
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
        immutable: true
    },

    // ─── Detailed metadata about the action ───
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
        immutable: true
    },

    // ─── IP address of the request (for security analysis) ───
    ipAddress: {
        type: String,
        trim: true,
        immutable: true
    },

    // ─── User agent string (device/browser identification) ───
    userAgent: {
        type: String,
        trim: true,
        immutable: true
    },

    // ─── Severity level of the audit event ───
    severity: {
        type: String,
        enum: {
            values: ["INFO", "WARNING", "ERROR", "CRITICAL"],
            message: "Severity must be INFO, WARNING, ERROR, or CRITICAL"
        },
        default: "INFO",
        immutable: true
    }

}, {
    timestamps: true  // createdAt serves as the immutable timestamp
});

// ─── IMMUTABILITY ENFORCEMENT ───
// Audit logs, like ledger entries, must never be modified or deleted.
// This is a core compliance requirement for financial systems.

function preventAuditModification() {
    throw new Error("Audit log entries are immutable and cannot be modified or deleted. This is a compliance requirement.");
}

auditLogSchema.pre("findOneAndUpdate", preventAuditModification);
auditLogSchema.pre("updateOne", preventAuditModification);
auditLogSchema.pre("deleteOne", preventAuditModification);
auditLogSchema.pre("remove", preventAuditModification);
auditLogSchema.pre("deleteMany", preventAuditModification);
auditLogSchema.pre("updateMany", preventAuditModification);
auditLogSchema.pre("findOneAndDelete", preventAuditModification);
auditLogSchema.pre("findOneAndReplace", preventAuditModification);

// ─── Search indexes ───
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });

const auditLogModel = mongoose.model("auditLog", auditLogSchema);

module.exports = auditLogModel;
