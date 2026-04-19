/**
 * ============================================================
 *  BANK ACCOUNT MODEL — External Bank Account Linking
 * ============================================================
 *  In real UPI, users link their actual bank accounts (savings,
 *  current) from banks like SBI, ICICI, HDFC etc. The PSP app
 *  stores the link between the user and their bank accounts.
 *
 *  This model simulates that linking layer. Each bank account
 *  link connects a user to a specific bank and maps it to
 *  an internal ledger account for transaction processing.
 *
 *  Key design decisions:
 *    - Account number + IFSC uniquely identifies a bank account
 *    - Verification simulated via "penny drop" (small test credit)
 *    - One account can be marked as "primary" for default payments
 *    - UPI PIN is stored per bank account (hashed with bcrypt)
 *    - PIN attempt tracking with automatic lockout
 * ============================================================
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const bankAccountSchema = new mongoose.Schema({

    // ─── Reference to the user who linked this bank account ───
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Bank account must be associated with a user"],
        index: true
    },

    // ─── Reference to the internal ledger account ───
    // This maps the external bank account to our internal system
    internalAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "Bank account must be linked to an internal account"],
        index: true
    },

    // ─── Bank name (e.g., "State Bank of India") ───
    bankName: {
        type: String,
        required: [true, "Bank name is required"],
        trim: true
    },

    // ─── Bank code / IFSC prefix (e.g., "SBIN", "ICIC") ───
    bankCode: {
        type: String,
        required: [true, "Bank code (IFSC prefix) is required"],
        trim: true,
        uppercase: true,
        // IFSC format: 4 letters + 0 + 6 alphanumeric (e.g., SBIN0001234)
        match: [
            /^[A-Z]{4}[0-9]{7}$/,
            "Invalid IFSC code format. Expected: 4 letters + 7 digits (e.g., SBIN0001234)"
        ]
    },

    // ─── Masked account number (only last 4 digits stored in plain text) ───
    accountNumberMasked: {
        type: String,
        required: [true, "Account number is required"],
        trim: true
    },

    // ─── Hash of full account number (for duplicate detection) ───
    accountNumberHash: {
        type: String,
        required: [true, "Account number hash is required"],
        index: true
    },

    // ─── Account holder's name as per bank records ───
    accountHolderName: {
        type: String,
        required: [true, "Account holder name is required"],
        trim: true
    },

    // ─── Account type: SAVINGS or CURRENT ───
    accountType: {
        type: String,
        enum: {
            values: ["SAVINGS", "CURRENT"],
            message: "Account type must be either SAVINGS or CURRENT"
        },
        default: "SAVINGS"
    },

    // ─── Whether the bank account has been verified (penny drop) ───
    isVerified: {
        type: Boolean,
        default: false
    },

    // ─── Whether this is the user's primary bank account ───
    isPrimary: {
        type: Boolean,
        default: false
    },

    // ─── UPI PIN (hashed with bcrypt, 6-digit) ───
    // Each bank account has its own UPI PIN
    upiPinHash: {
        type: String,
        select: false  // Never returned in queries by default
    },

    // ─── Whether UPI PIN has been set for this account ───
    isPinSet: {
        type: Boolean,
        default: false
    },

    // ─── PIN attempt tracking for lockout mechanism ───
    pinAttempts: {
        type: Number,
        default: 0,
        select: false
    },

    // ─── Timestamp when the account was locked due to failed PIN attempts ───
    lockedUntil: {
        type: Date,
        default: null,
        select: false
    },

    // ─── Link status: ACTIVE, INACTIVE, or SUSPENDED ───
    status: {
        type: String,
        enum: {
            values: ["ACTIVE", "INACTIVE", "SUSPENDED"],
            message: "Status must be ACTIVE, INACTIVE, or SUSPENDED"
        },
        default: "ACTIVE"
    }

}, {
    timestamps: true
});

// ─── Compound index: prevent duplicate bank account links per user ───
bankAccountSchema.index({ user: 1, accountNumberHash: 1 }, { unique: true });

// ─── Compound index: quickly find primary account ───
bankAccountSchema.index({ user: 1, isPrimary: 1 });

/**
 * Instance method: Set UPI PIN
 * Hashes the 6-digit PIN using bcrypt before storing
 * @param {string} pin - 6-digit UPI PIN
 */
bankAccountSchema.methods.setUpiPin = async function (pin) {
    const hash = await bcrypt.hash(pin, 12);
    this.upiPinHash = hash;
    this.isPinSet = true;
    this.pinAttempts = 0;
    this.lockedUntil = null;
    await this.save();
};

/**
 * Instance method: Verify UPI PIN
 * Compares provided PIN against stored hash
 * Implements lockout after max failed attempts
 * @param {string} pin - 6-digit UPI PIN to verify
 * @returns {Object} { success: boolean, message: string }
 */
bankAccountSchema.methods.verifyUpiPin = async function (pin) {
    // Check if account is currently locked
    if (this.lockedUntil && this.lockedUntil > new Date()) {
        const remainingMs = this.lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60000);
        return {
            success: false,
            message: `Account locked due to too many failed attempts. Try again in ${remainingMin} minutes.`
        };
    }

    // Reset lock if lockout period has expired
    if (this.lockedUntil && this.lockedUntil <= new Date()) {
        this.pinAttempts = 0;
        this.lockedUntil = null;
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, this.upiPinHash);

    if (!isValid) {
        this.pinAttempts += 1;
        // Lock after 3 failed attempts (30-minute lockout)
        if (this.pinAttempts >= 3) {
            this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            await this.save();
            return {
                success: false,
                message: "Account locked for 30 minutes due to 3 failed PIN attempts."
            };
        }
        await this.save();
        return {
            success: false,
            message: `Invalid UPI PIN. ${3 - this.pinAttempts} attempts remaining.`
        };
    }

    // Successful verification — reset attempts
    this.pinAttempts = 0;
    this.lockedUntil = null;
    await this.save();
    return { success: true, message: "PIN verified successfully." };
};

const bankAccountModel = mongoose.model("bankAccount", bankAccountSchema);

module.exports = bankAccountModel;
