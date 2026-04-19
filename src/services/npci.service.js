/**
 * ============================================================
 *  NPCI SWITCH SIMULATOR SERVICE
 * ============================================================
 *  Simulates the National Payments Corporation of India (NPCI)
 *  UPI switch — the central routing hub that connects all
 *  banks in the UPI ecosystem.
 *
 *  In the real world:
 *    1. PSP app sends payment request to NPCI
 *    2. NPCI validates and routes to remitter bank
 *    3. Remitter bank debits account
 *    4. NPCI routes credit to beneficiary bank
 *    5. Beneficiary bank credits account
 *    6. NPCI sends response back to PSP
 *
 *  This simulator mimics:
 *    - VPA validation (format + existence)
 *    - Payment routing with simulated latency
 *    - Transaction reference number generation
 *    - Random failure simulation (5% failure rate, mirrors real UPI)
 *    - Timeout handling
 *
 *  Reference: NPCI UPI Technical Specs v2.0
 * ============================================================
 */

const crypto = require("crypto");
const UPI_CONFIG = require("../config/upi.config");
const upiIdModel = require("../models/upiId.model");

/**
 * Generates a 12-digit UPI transaction reference number.
 * In real UPI, this is the RRN (Retrieval Reference Number)
 * assigned by NPCI for every transaction.
 *
 * Format: Timestamp-based + random digits (ensures uniqueness)
 * @returns {string} 12-digit reference number
 */
function generateTransactionRef() {
    // First 6 digits: timestamp-based (HHMMSS in IST)
    const now = new Date();
    const timeComponent = [
        now.getHours().toString().padStart(2, "0"),
        now.getMinutes().toString().padStart(2, "0"),
        now.getSeconds().toString().padStart(2, "0"),
    ].join("");

    // Last 6 digits: cryptographically random
    const randomComponent = crypto
        .randomInt(100000, 999999)
        .toString();

    return timeComponent + randomComponent;
}

/**
 * Generates a unique UPI transaction ID.
 * Format: UPI + timestamp + random hex (32 chars total)
 * Used as the primary identifier for the transaction in NPCI system.
 *
 * @returns {string} Unique UPI transaction ID
 */
function generateUpiTransactionId() {
    const timestamp = Date.now().toString(36);  // Base-36 timestamp
    const randomPart = crypto.randomBytes(8).toString("hex");
    return `UPI${timestamp}${randomPart}`.toUpperCase();
}

/**
 * Simulates network latency between PSP and NPCI switch.
 * Real UPI transactions take 100ms-2s for the switch routing.
 *
 * @returns {Promise<void>} Resolves after simulated delay
 */
async function simulateNetworkLatency() {
    const { MIN_LATENCY_MS, MAX_LATENCY_MS } = UPI_CONFIG.NPCI;
    const delay = Math.floor(
        Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS) + MIN_LATENCY_MS
    );
    return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Validates a VPA (Virtual Payment Address) format.
 * Checks both format validity and whether the VPA exists in our system.
 *
 * @param {string} vpa - The VPA to validate (e.g., "user@upi")
 * @returns {Object} { valid: boolean, message: string, vpaRecord?: Object }
 */
async function validateVpa(vpa) {
    // Step 1: Format validation
    if (!vpa || typeof vpa !== "string") {
        return {
            valid: false,
            message: "VPA is required and must be a string"
        };
    }

    // Normalize to lowercase
    const normalizedVpa = vpa.trim().toLowerCase();

    // Check VPA format against NPCI pattern
    if (!UPI_CONFIG.VPA_RULES.PATTERN.test(normalizedVpa)) {
        return {
            valid: false,
            message: "Invalid VPA format. Expected: username@bankhandle (e.g., user@upi)"
        };
    }

    // Step 2: Extract and validate bank handle
    const [, bankHandle] = normalizedVpa.split("@");
    if (!UPI_CONFIG.VPA_RULES.SUPPORTED_HANDLES.includes(bankHandle)) {
        return {
            valid: false,
            message: `Unsupported bank handle: @${bankHandle}. Supported: ${UPI_CONFIG.VPA_RULES.SUPPORTED_HANDLES.join(", ")}`
        };
    }

    // Step 3: Check if VPA exists in our system and is active
    const vpaRecord = await upiIdModel.findOne({
        vpa: normalizedVpa,
        status: "ACTIVE"
    }).populate("account user");

    if (!vpaRecord) {
        return {
            valid: false,
            message: `VPA '${normalizedVpa}' does not exist or is inactive`
        };
    }

    return {
        valid: true,
        message: "VPA is valid",
        vpaRecord: vpaRecord
    };
}

/**
 * Resolves a VPA to its associated account details.
 * Returns the display name and bank information (what you see
 * when you enter a VPA in GPay/PhonePe before paying).
 *
 * @param {string} vpa - The VPA to resolve
 * @returns {Object} { success, displayName, bankHandle, accountId }
 */
async function resolveVpa(vpa) {
    const validation = await validateVpa(vpa);

    if (!validation.valid) {
        return {
            success: false,
            message: validation.message
        };
    }

    const { vpaRecord } = validation;

    return {
        success: true,
        displayName: vpaRecord.displayName || vpaRecord.user?.name || "UPI User",
        vpa: vpaRecord.vpa,
        bankHandle: vpaRecord.bankHandle,
        accountId: vpaRecord.account._id,
        userId: vpaRecord.user._id,
    };
}

/**
 * Routes a payment through the NPCI switch simulator.
 * This is the core function that simulates the NPCI routing process.
 *
 * Flow:
 *   1. Validate sender VPA
 *   2. Validate receiver VPA
 *   3. Simulate NPCI switch routing (with latency)
 *   4. Generate transaction reference
 *   5. Return routing result (success/failure)
 *
 * @param {string} senderVpa - Sender's VPA
 * @param {string} receiverVpa - Receiver's VPA
 * @param {number} amount - Transaction amount in INR
 * @returns {Object} Routing result with reference numbers and account details
 */
async function routePayment(senderVpa, receiverVpa, amount) {
    // Step 1: Validate sender VPA
    const senderValidation = await validateVpa(senderVpa);
    if (!senderValidation.valid) {
        return {
            success: false,
            responseCode: "U16",  // NPCI response code: Remitter VPA not available
            message: `Sender VPA error: ${senderValidation.message}`
        };
    }

    // Step 2: Validate receiver VPA
    const receiverValidation = await validateVpa(receiverVpa);
    if (!receiverValidation.valid) {
        return {
            success: false,
            responseCode: "U14",  // NPCI response code: Beneficiary VPA not available
            message: `Receiver VPA error: ${receiverValidation.message}`
        };
    }

    // Step 3: Prevent self-transfers
    if (senderVpa.toLowerCase() === receiverVpa.toLowerCase()) {
        return {
            success: false,
            responseCode: "U10",  // Invalid transaction
            message: "Cannot transfer to the same VPA"
        };
    }

    // Step 4: Validate amount against transaction limits
    if (amount < UPI_CONFIG.TRANSACTION_LIMITS.MIN_AMOUNT) {
        return {
            success: false,
            responseCode: "U12",  // Invalid amount
            message: `Minimum transaction amount is ₹${UPI_CONFIG.TRANSACTION_LIMITS.MIN_AMOUNT}`
        };
    }

    if (amount > UPI_CONFIG.TRANSACTION_LIMITS.MAX_P2P_AMOUNT) {
        return {
            success: false,
            responseCode: "U12",
            message: `Maximum transaction amount is ₹${UPI_CONFIG.TRANSACTION_LIMITS.MAX_P2P_AMOUNT}`
        };
    }

    // Step 5: Simulate NPCI switch routing latency
    await simulateNetworkLatency();

    // Step 6: Simulate random failures (5% failure rate, like real UPI)
    const random = Math.random();
    if (random > UPI_CONFIG.NPCI.SUCCESS_RATE) {
        // Simulate various NPCI failure codes
        const failureCodes = [
            { code: "U28", message: "Remitter bank not available" },
            { code: "U29", message: "Beneficiary bank not available" },
            { code: "U30", message: "Transaction declined by NPCI switch" },
            { code: "U68", message: "Transaction timeout at NPCI" },
        ];
        const failure = failureCodes[Math.floor(Math.random() * failureCodes.length)];

        return {
            success: false,
            responseCode: failure.code,
            message: failure.message,
            upiTransactionId: generateUpiTransactionId(),
            upiRefNumber: generateTransactionRef(),
        };
    }

    // Step 7: Successful routing — return all details needed for the transaction
    return {
        success: true,
        responseCode: "00",  // NPCI success code
        message: "Transaction routed successfully via NPCI switch",
        upiTransactionId: generateUpiTransactionId(),
        upiRefNumber: generateTransactionRef(),
        sender: {
            vpa: senderValidation.vpaRecord.vpa,
            accountId: senderValidation.vpaRecord.account._id,
            userId: senderValidation.vpaRecord.user._id,
            name: senderValidation.vpaRecord.user.name,
        },
        receiver: {
            vpa: receiverValidation.vpaRecord.vpa,
            accountId: receiverValidation.vpaRecord.account._id,
            userId: receiverValidation.vpaRecord.user._id,
            name: receiverValidation.vpaRecord.user.name,
        },
        amount: amount,
        timestamp: new Date().toISOString(),
    };
}

module.exports = {
    generateTransactionRef,
    generateUpiTransactionId,
    validateVpa,
    resolveVpa,
    routePayment,
    simulateNetworkLatency,
};
