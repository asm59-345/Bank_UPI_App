/**
 * ============================================================
 *  UPI ID (VPA) MODEL — Virtual Payment Address
 * ============================================================
 *  In the real UPI ecosystem, a VPA (Virtual Payment Address)
 *  is an alias that maps to a user's bank account. Examples:
 *    - user@upi
 *    - johndoe@oksbi
 *    - merchant@okicici
 *
 *  This model stores the mapping between VPAs and internal
 *  accounts, enabling UPI-style addressing for payments.
 *
 *  Key design decisions:
 *    - VPA is unique and immutable once created
 *    - Each VPA maps to exactly one account
 *    - A user can have multiple VPAs (max defined in config)
 *    - One VPA per user can be marked as "default"
 *    - VPAs can be deactivated but never deleted (audit trail)
 * ============================================================
 */

const mongoose = require("mongoose");

const upiIdSchema = new mongoose.Schema({

    // ─── The VPA string itself (e.g., "user@upi") ───
    vpa: {
        type: String,
        required: [true, "VPA (Virtual Payment Address) is required"],
        unique: true,
        trim: true,
        lowercase: true,
        immutable: true,  // VPAs cannot be renamed once created
        index: true,
        // Validates VPA format: alphanumeric._ @ bankhandle
        match: [
            /^[a-zA-Z0-9._]{3,50}@[a-zA-Z]{2,20}$/,
            "Invalid VPA format. Use format: username@bankhandle"
        ]
    },

    // ─── Reference to the internal account this VPA maps to ───
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "VPA must be linked to an account"],
        index: true
    },

    // ─── Reference to the user who owns this VPA ───
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "VPA must be associated with a user"],
        index: true
    },

    // ─── Whether this is the user's default VPA for payments ───
    isDefault: {
        type: Boolean,
        default: false
    },

    // ─── Display name shown to payers (e.g., "John Doe") ───
    displayName: {
        type: String,
        trim: true,
        maxlength: [100, "Display name cannot exceed 100 characters"]
    },

    // ─── VPA status: ACTIVE or INACTIVE (soft delete) ───
    status: {
        type: String,
        enum: {
            values: ["ACTIVE", "INACTIVE"],
            message: "VPA status must be either ACTIVE or INACTIVE"
        },
        default: "ACTIVE"
    },

    // ─── Bank handle portion of the VPA (e.g., "upi", "oksbi") ───
    bankHandle: {
        type: String,
        required: [true, "Bank handle is required"],
        trim: true,
        lowercase: true
    }

}, {
    timestamps: true  // Adds createdAt and updatedAt automatically
});

// ─── Compound index: quickly find all VPAs for a specific user ───
upiIdSchema.index({ user: 1, status: 1 });

// ─── Compound index: find default VPA for a user ───
upiIdSchema.index({ user: 1, isDefault: 1 });

const upiIdModel = mongoose.model("upiId", upiIdSchema);

module.exports = upiIdModel;
