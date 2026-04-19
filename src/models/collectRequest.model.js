/**
 * ============================================================
 *  COLLECT REQUEST MODEL — UPI Pull Payment Requests
 * ============================================================
 *  In UPI, a "collect request" is a pull-based payment where
 *  a payee (requester) requests money from a payer. Example:
 *    - A merchant sends a collect request to a customer
 *    - The customer approves/declines via their UPI app
 *
 *  Real-world flow:
 *    1. Requester creates collect request with payer's VPA
 *    2. Payer receives notification
 *    3. Payer approves (enters UPI PIN) or declines
 *    4. If approved, NPCI routes the debit/credit
 *    5. Both parties receive confirmation
 *
 *  Collect requests auto-expire after 24 hours if not acted upon.
 * ============================================================
 */

const mongoose = require("mongoose");

const collectRequestSchema = new mongoose.Schema({

    // ─── The user who is requesting money ───
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Requester user ID is required"],
        index: true
    },

    // ─── VPA of the requester (e.g., "merchant@upi") ───
    requesterVpa: {
        type: String,
        required: [true, "Requester VPA is required"],
        trim: true,
        lowercase: true
    },

    // ─── The user who is being asked to pay ───
    payer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Payer user ID is required"],
        index: true
    },

    // ─── VPA of the payer (e.g., "customer@oksbi") ───
    payerVpa: {
        type: String,
        required: [true, "Payer VPA is required"],
        trim: true,
        lowercase: true
    },

    // ─── Amount requested (in INR) ───
    amount: {
        type: Number,
        required: [true, "Amount is required for collect request"],
        min: [1, "Minimum collect amount is ₹1"],
        max: [100000, "Maximum collect amount is ₹1,00,000"]
    },

    // ─── Purpose / note for the collect request ───
    note: {
        type: String,
        trim: true,
        maxlength: [255, "Note cannot exceed 255 characters"],
        default: ""
    },

    // ─── Current status of the collect request ───
    status: {
        type: String,
        enum: {
            values: ["PENDING", "APPROVED", "DECLINED", "EXPIRED", "FAILED"],
            message: "Status must be PENDING, APPROVED, DECLINED, EXPIRED, or FAILED"
        },
        default: "PENDING"
    },

    // ─── When this collect request expires (auto-set to 24hrs from creation) ───
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },

    // ─── Reference to the transaction created if approved ───
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        default: null
    },

    // ─── UPI transaction reference number ───
    upiRefNumber: {
        type: String,
        trim: true,
        index: true
    },

    // ─── Timestamp when payer responded (approved/declined) ───
    respondedAt: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

// ─── Index for finding pending requests that have expired ───
collectRequestSchema.index({ status: 1, expiresAt: 1 });

// ─── Index for finding all requests for a specific payer ───
collectRequestSchema.index({ payer: 1, status: 1 });

// ─── Index for finding all requests by a specific requester ───
collectRequestSchema.index({ requester: 1, status: 1 });

const collectRequestModel = mongoose.model("collectRequest", collectRequestSchema);

module.exports = collectRequestModel;
