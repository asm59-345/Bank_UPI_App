/**
 * ============================================================
 *  UPI SYSTEM CONFIGURATION
 * ============================================================
 *  Centralized configuration for all UPI-related constants.
 *  Includes transaction limits, VPA rules, NPCI simulator
 *  settings, bank code mappings, and fraud detection thresholds.
 *
 *  Reference: NPCI UPI Technical Specifications v2.0
 * ============================================================
 */

const UPI_CONFIG = {

    // ─────────────────────────────────────────────────────────
    //  TRANSACTION LIMITS (in INR, per RBI guidelines)
    // ─────────────────────────────────────────────────────────
    TRANSACTION_LIMITS: {
        MIN_AMOUNT: 1,                    // Minimum ₹1 per transaction
        MAX_P2P_AMOUNT: 100000,           // ₹1,00,000 per P2P transfer (RBI cap)
        MAX_P2M_AMOUNT: 200000,           // ₹2,00,000 per merchant payment
        DAILY_LIMIT: 500000,              // ₹5,00,000 daily aggregate limit
        MAX_TRANSACTIONS_PER_DAY: 20,     // Max 20 UPI transactions per day
    },

    // ─────────────────────────────────────────────────────────
    //  VPA (Virtual Payment Address) RULES
    // ─────────────────────────────────────────────────────────
    VPA_RULES: {
        // Regex: alphanumeric + dots/underscores, 3-50 chars, @bankhandle
        PATTERN: /^[a-zA-Z0-9._]{3,50}@[a-zA-Z]{2,20}$/,
        MIN_LENGTH: 5,                    // Minimum total VPA length
        MAX_LENGTH: 70,                   // Maximum total VPA length
        MAX_VPA_PER_USER: 5,              // Max VPAs a user can create
        // Supported bank handles for VPA generation
        SUPPORTED_HANDLES: [
            "upi",        // Generic UPI handle
            "oksbi",      // State Bank of India
            "okicici",    // ICICI Bank
            "okaxis",     // Axis Bank
            "okhdfcbank", // HDFC Bank
            "ybl",        // PhonePe (Yes Bank)
            "paytm",      // Paytm Payments Bank
            "gpay",       // Google Pay
            "apl",        // Amazon Pay
        ],
        DEFAULT_HANDLE: "upi",            // Default bank handle for new VPAs
    },

    // ─────────────────────────────────────────────────────────
    //  NPCI SWITCH SIMULATOR SETTINGS
    // ─────────────────────────────────────────────────────────
    NPCI: {
        TIMEOUT_MS: 10000,                // 10 second timeout (real UPI SLA)
        MIN_LATENCY_MS: 100,              // Minimum simulated latency
        MAX_LATENCY_MS: 500,              // Maximum simulated latency
        RETRY_ATTEMPTS: 3,                // Number of retry attempts
        RETRY_DELAY_MS: 1000,             // Delay between retries
        // Simulated success rate (95% to mirror real-world UPI)
        SUCCESS_RATE: 0.95,
        // Transaction reference ID format
        TXN_REF_LENGTH: 12,               // 12-digit UPI reference number
    },

    // ─────────────────────────────────────────────────────────
    //  SIMULATED BANK CODE MAPPINGS (IFSC → Bank Name)
    // ─────────────────────────────────────────────────────────
    BANK_CODES: {
        "SBIN": { name: "State Bank of India", code: "SBIN", handle: "oksbi" },
        "ICIC": { name: "ICICI Bank", code: "ICIC", handle: "okicici" },
        "UTIB": { name: "Axis Bank", code: "UTIB", handle: "okaxis" },
        "HDFC": { name: "HDFC Bank", code: "HDFC", handle: "okhdfcbank" },
        "KKBK": { name: "Kotak Mahindra Bank", code: "KKBK", handle: "upi" },
        "PUNB": { name: "Punjab National Bank", code: "PUNB", handle: "upi" },
        "BARB": { name: "Bank of Baroda", code: "BARB", handle: "upi" },
        "YESB": { name: "Yes Bank", code: "YESB", handle: "ybl" },
        "PYTM": { name: "Paytm Payments Bank", code: "PYTM", handle: "paytm" },
    },

    // ─────────────────────────────────────────────────────────
    //  UPI PIN CONFIGURATION
    // ─────────────────────────────────────────────────────────
    UPI_PIN: {
        LENGTH: 6,                        // 6-digit UPI PIN
        MAX_ATTEMPTS: 3,                  // Max wrong PIN attempts before lockout
        LOCKOUT_DURATION_MS: 30 * 60 * 1000,  // 30 minutes lockout
        // Salt rounds for PIN hashing (bcrypt)
        SALT_ROUNDS: 12,
    },

    // ─────────────────────────────────────────────────────────
    //  FRAUD DETECTION THRESHOLDS
    // ─────────────────────────────────────────────────────────
    FRAUD: {
        // Risk score thresholds (0–100)
        LOW_RISK: 25,                     // Score 0-25: proceed normally
        MEDIUM_RISK: 50,                  // Score 26-50: flag for review
        HIGH_RISK: 75,                    // Score 51-75: require additional verification
        CRITICAL_RISK: 90,               // Score 76+: block transaction

        // Velocity checks
        MAX_TRANSACTIONS_PER_MINUTE: 5,   // More than 5 txns/min = suspicious
        MAX_UNIQUE_RECIPIENTS_PER_HOUR: 10, // More than 10 recipients/hr = suspicious

        // Amount thresholds
        HIGH_VALUE_THRESHOLD: 50000,      // ₹50,000+ triggers high-value check
        VERY_HIGH_VALUE_THRESHOLD: 100000, // ₹1,00,000+ triggers additional review

        // Time-based checks (unusual hours in IST)
        UNUSUAL_HOURS_START: 0,           // 12 AM IST
        UNUSUAL_HOURS_END: 5,             // 5 AM IST
    },

    // ─────────────────────────────────────────────────────────
    //  COLLECT REQUEST SETTINGS
    // ─────────────────────────────────────────────────────────
    COLLECT_REQUEST: {
        EXPIRY_HOURS: 24,                 // Collect requests expire in 24 hours
        MAX_PENDING_REQUESTS: 10,         // Max pending collect requests per user
        MAX_AMOUNT: 100000,               // Max collect request amount
    },

    // ─────────────────────────────────────────────────────────
    //  RATE LIMITING
    // ─────────────────────────────────────────────────────────
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000,        // 15-minute window
        MAX_REQUESTS_PER_WINDOW: 100,      // 100 requests per window (general)
        MAX_PAYMENT_REQUESTS_PER_WINDOW: 20, // 20 payment requests per window
        MAX_AUTH_REQUESTS_PER_WINDOW: 10,   // 10 auth attempts per window
    },
};

module.exports = UPI_CONFIG;
