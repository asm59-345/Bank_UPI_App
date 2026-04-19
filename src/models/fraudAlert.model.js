/**
 * ============================================================
 *  FRAUD ALERT MODEL — Transaction Risk Detection
 * ============================================================
 *  Stores fraud detection events raised by the fraud detection
 *  engine. Each alert is associated with a user and optionally
 *  a transaction, and includes the computed risk score, the
 *  specific rules that triggered it, and its review status.
 *
 *  Used by:
 *    - Fraud detection service (creates alerts)
 *    - Admin panel (reviews/clears alerts)
 *    - UPI payment flow (blocks high-risk transactions)
 *
 *  Risk levels:
 *    - LOW (0-25):      Proceed normally
 *    - MEDIUM (26-50):  Flag for post-transaction review
 *    - HIGH (51-75):    Require additional verification
 *    - CRITICAL (76+):  Block the transaction
 * ============================================================
 */

const mongoose = require("mongoose");

const fraudAlertSchema = new mongoose.Schema({

    // ─── The user whose activity triggered the alert ───
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Fraud alert must be associated with a user"],
        index: true
    },

    // ─── The transaction that triggered the alert (if applicable) ───
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        default: null,
        index: true
    },

    // ─── Computed risk score (0-100) ───
    riskScore: {
        type: Number,
        required: [true, "Risk score is required"],
        min: [0, "Risk score cannot be negative"],
        max: [100, "Risk score cannot exceed 100"]
    },

    // ─── Risk level derived from score ───
    riskLevel: {
        type: String,
        enum: {
            values: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            message: "Risk level must be LOW, MEDIUM, HIGH, or CRITICAL"
        },
        required: [true, "Risk level is required"]
    },

    // ─── Array of specific fraud rules that triggered this alert ───
    // Each trigger describes what specific pattern was detected
    triggers: [{
        rule: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        // How much this rule contributed to the total risk score
        scoreContribution: {
            type: Number,
            default: 0
        }
    }],

    // ─── Alert review status ───
    status: {
        type: String,
        enum: {
            values: ["FLAGGED", "UNDER_REVIEW", "CLEARED", "CONFIRMED_FRAUD", "ESCALATED"],
            message: "Status must be FLAGGED, UNDER_REVIEW, CLEARED, CONFIRMED_FRAUD, or ESCALATED"
        },
        default: "FLAGGED"
    },

    // ─── Admin who reviewed this alert ───
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },

    // ─── Timestamp when alert was reviewed ───
    reviewedAt: {
        type: Date,
        default: null
    },

    // ─── Admin's review notes ───
    reviewNotes: {
        type: String,
        trim: true,
        maxlength: [1000, "Review notes cannot exceed 1000 characters"],
        default: ""
    },

    // ─── Transaction details snapshot (for reference even if txn is modified) ───
    transactionSnapshot: {
        amount: { type: Number },
        senderVpa: { type: String },
        receiverVpa: { type: String },
        type: { type: String }  // P2P, P2M, COLLECT
    },

    // ─── Whether the transaction was blocked due to this alert ───
    transactionBlocked: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});

// ─── Index for admin dashboard: find unreviewed alerts ───
fraudAlertSchema.index({ status: 1, riskLevel: 1, createdAt: -1 });

// ─── Index for finding high-risk alerts quickly ───
fraudAlertSchema.index({ riskScore: -1, createdAt: -1 });

const fraudAlertModel = mongoose.model("fraudAlert", fraudAlertSchema);

module.exports = fraudAlertModel;
