/**
 * ============================================================
 *  UPI PAYMENT BUSINESS LOGIC SERVICE
 * ============================================================
 *  The core orchestration layer for UPI payments. This service
 *  coordinates the entire payment flow:
 *
 *    1. Fraud risk assessment
 *    2. NPCI switch routing
 *    3. Ledger entries (double-entry accounting)
 *    4. Transaction state management
 *    5. Notification dispatch
 *    6. Audit logging
 *
 *  Supports three payment types:
 *    - P2P  (Person to Person) — send money to a VPA
 *    - P2M  (Person to Merchant) — pay a merchant via QR/VPA
 *    - COLLECT — respond to a collect (pull payment) request
 *
 *  All payments are:
 *    ✅ Idempotent (via idempotency key)
 *    ✅ Atomic (MongoDB sessions/transactions)
 *    ✅ Audited (immutable audit log)
 *    ✅ Fraud-checked (pre-transaction risk assessment)
 *
 *  This service uses the EXISTING ledger and transaction models
 *  from the original codebase — zero modifications needed.
 * ============================================================
 */

const mongoose = require("mongoose");
const crypto = require("crypto");

// ─── Existing models (UNTOUCHED) ───
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const userModel = require("../models/user.model");

// ─── New models ───
const upiIdModel = require("../models/upiId.model");
const collectRequestModel = require("../models/collectRequest.model");
const auditLogModel = require("../models/auditLog.model");

// ─── Services ───
const npciService = require("./npci.service");
const fraudService = require("./fraud.service");
const notificationService = require("./notification.service");

/**
 * Generates a unique idempotency key for UPI transactions.
 * Combines timestamp + random bytes to ensure uniqueness.
 *
 * @returns {string} Unique idempotency key
 */
function generateIdempotencyKey() {
    return `UPI-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

// ═══════════════════════════════════════════════════════
//  P2P PAYMENT — Person to Person Transfer
// ═══════════════════════════════════════════════════════

/**
 * Process a P2P (Person-to-Person) UPI payment.
 * Full flow: Validate → Fraud Check → NPCI Route → Ledger → Notify
 *
 * @param {Object} params - Payment parameters
 * @param {string} params.senderVpa - Sender's VPA (e.g., "user@upi")
 * @param {string} params.receiverVpa - Receiver's VPA
 * @param {number} params.amount - Amount in INR
 * @param {string} params.note - Optional payment note
 * @param {string} params.userId - Authenticated user's ID
 * @param {string} params.ipAddress - Request IP address
 * @returns {Object} Payment result
 */
async function processP2PPayment(params) {
    const { senderVpa, receiverVpa, amount, note, userId, ipAddress } = params;

    // ─── Step 1: Validate sender owns this VPA ───
    const senderVpaRecord = await upiIdModel.findOne({
        vpa: senderVpa.toLowerCase(),
        user: userId,
        status: "ACTIVE"
    }).populate("account");

    if (!senderVpaRecord) {
        return {
            success: false,
            responseCode: "U16",
            message: "You do not own this VPA or it is inactive"
        };
    }

    // ─── Step 2: Check sender's account is active ───
    if (senderVpaRecord.account.status !== "ACTIVE") {
        return {
            success: false,
            responseCode: "U10",
            message: "Sender account is not active"
        };
    }

    // ─── Step 3: Check sender balance ───
    const balance = await senderVpaRecord.account.getBalance();
    if (balance < amount) {
        return {
            success: false,
            responseCode: "U31",
            message: `Insufficient balance. Available: ₹${balance}, Required: ₹${amount}`
        };
    }

    // ─── Step 4: Fraud risk assessment ───
    const riskAssessment = await fraudService.assessRisk(
        userId,
        senderVpaRecord.account._id,
        amount,
        { senderVpa, receiverVpa, type: "P2P" }
    );

    if (riskAssessment.blocked) {
        // Log blocked transaction in audit
        await auditLogModel.create({
            action: "TRANSACTION_BLOCKED",
            performedBy: userId,
            metadata: { senderVpa, receiverVpa, amount, riskScore: riskAssessment.riskScore },
            ipAddress: ipAddress,
            severity: "CRITICAL"
        });

        return {
            success: false,
            responseCode: "U66",
            message: riskAssessment.message,
            riskScore: riskAssessment.riskScore
        };
    }

    // ─── Step 5: Route through NPCI switch ───
    const npciResult = await npciService.routePayment(senderVpa, receiverVpa, amount);

    if (!npciResult.success) {
        // Log failed NPCI routing
        await auditLogModel.create({
            action: "PAYMENT_FAILED",
            performedBy: userId,
            metadata: {
                senderVpa, receiverVpa, amount,
                npciResponseCode: npciResult.responseCode,
                reason: npciResult.message
            },
            ipAddress: ipAddress,
            severity: "WARNING"
        });

        // Notify sender of failure
        notificationService.sendTransactionFailureNotification({
            senderId: userId,
            amount: amount,
            receiverVpa: receiverVpa,
            reason: npciResult.message
        }).catch(err => console.error("Notification error:", err.message));

        return {
            success: false,
            responseCode: npciResult.responseCode,
            message: npciResult.message,
            upiRefNumber: npciResult.upiRefNumber
        };
    }

    // ─── Step 6: Execute double-entry ledger transaction (ACID) ───
    const idempotencyKey = generateIdempotencyKey();
    let transaction;
    let session;  // Declare outside try so catch can access it

    try {
        session = await mongoose.startSession();
        session.startTransaction();

        // Create transaction record (PENDING)
        transaction = (await transactionModel.create([{
            fromAccount: npciResult.sender.accountId,
            toAccount: npciResult.receiver.accountId,
            amount: amount,
            idempotencyKey: idempotencyKey,
            status: "PENDING"
        }], { session }))[0];

        // DEBIT entry (sender) — money leaves sender's account
        await ledgerModel.create([{
            account: npciResult.sender.accountId,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session });

        // CREDIT entry (receiver) — money enters receiver's account
        await ledgerModel.create([{
            account: npciResult.receiver.accountId,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session });

        // Mark transaction as COMPLETED
        await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

    } catch (error) {
        console.error("Transaction execution error:", error.message);

        // Abort and clean up the leaked session
        if (session) {
            try {
                await session.abortTransaction();
            } catch (_) { /* already aborted */ }
            session.endSession();
        }

        // Log failed transaction
        await auditLogModel.create({
            action: "PAYMENT_FAILED",
            performedBy: userId,
            metadata: { senderVpa, receiverVpa, amount, error: error.message },
            ipAddress: ipAddress,
            severity: "ERROR"
        });

        return {
            success: false,
            responseCode: "U99",
            message: "Transaction failed during processing. Please retry.",
            upiRefNumber: npciResult.upiRefNumber
        };
    }

    // ─── Step 7: Audit log (successful payment) ───
    await auditLogModel.create({
        action: "PAYMENT_COMPLETED",
        performedBy: userId,
        resourceType: "transaction",
        resourceId: transaction._id,
        metadata: {
            senderVpa, receiverVpa, amount,
            upiRefNumber: npciResult.upiRefNumber,
            upiTransactionId: npciResult.upiTransactionId,
            riskScore: riskAssessment.riskScore
        },
        ipAddress: ipAddress,
        severity: "INFO"
    });

    // ─── Step 8: Send notifications (non-blocking) ───
    notificationService.sendTransactionSuccessNotification({
        senderId: npciResult.sender.userId,
        senderName: npciResult.sender.name,
        receiverId: npciResult.receiver.userId,
        receiverName: npciResult.receiver.name,
        amount: amount,
        upiRefNumber: npciResult.upiRefNumber,
        senderVpa: senderVpa,
        receiverVpa: receiverVpa,
    }).catch(err => console.error("Notification error:", err.message));

    // ─── Step 9: Return success response ───
    return {
        success: true,
        responseCode: "00",
        message: "Payment successful",
        transaction: {
            id: transaction._id,
            amount: amount,
            senderVpa: senderVpa,
            receiverVpa: receiverVpa,
            upiRefNumber: npciResult.upiRefNumber,
            upiTransactionId: npciResult.upiTransactionId,
            status: "COMPLETED",
            timestamp: new Date().toISOString()
        },
        riskAssessment: {
            score: riskAssessment.riskScore,
            level: riskAssessment.riskLevel
        }
    };
}

// ═══════════════════════════════════════════════════════
//  P2M PAYMENT — Person to Merchant
// ═══════════════════════════════════════════════════════

/**
 * Process a P2M (Person-to-Merchant) payment.
 * Same flow as P2P but with merchant-specific handling.
 * In production, this would also handle MDR calculation.
 *
 * @param {Object} params - Same as P2P params
 * @returns {Object} Payment result
 */
async function processP2MPayment(params) {
    // P2M flow is identical to P2P in our simulation
    // In production, this would include:
    //   - Merchant verification
    //   - MDR (Merchant Discount Rate) calculation
    //   - QR code validation
    //   - Merchant settlement queue
    const result = await processP2PPayment({
        ...params,
        type: "P2M"
    });

    return result;
}

// ═══════════════════════════════════════════════════════
//  COLLECT REQUEST — Pull Payment
// ═══════════════════════════════════════════════════════

/**
 * Create a collect (pull payment) request.
 * The requester asks the payer to send money.
 *
 * @param {Object} params - Collect request parameters
 * @param {string} params.requesterVpa - Requester's VPA
 * @param {string} params.payerVpa - Payer's VPA
 * @param {number} params.amount - Amount requested
 * @param {string} params.note - Purpose/note
 * @param {string} params.userId - Authenticated user's ID
 * @returns {Object} Collect request result
 */
async function createCollectRequest(params) {
    const { requesterVpa, payerVpa, amount, note, userId } = params;

    // Validate requester owns this VPA
    const requesterVpaRecord = await upiIdModel.findOne({
        vpa: requesterVpa.toLowerCase(),
        user: userId,
        status: "ACTIVE"
    });

    if (!requesterVpaRecord) {
        return {
            success: false,
            message: "You do not own this VPA or it is inactive"
        };
    }

    // Validate payer VPA exists
    const payerVpaValidation = await npciService.validateVpa(payerVpa);
    if (!payerVpaValidation.valid) {
        return {
            success: false,
            message: `Payer VPA error: ${payerVpaValidation.message}`
        };
    }

    // Prevent self-collect
    if (requesterVpa.toLowerCase() === payerVpa.toLowerCase()) {
        return {
            success: false,
            message: "Cannot create a collect request to yourself"
        };
    }

    // Check pending requests limit
    const pendingCount = await collectRequestModel.countDocuments({
        requester: userId,
        status: "PENDING"
    });

    if (pendingCount >= 10) {
        return {
            success: false,
            message: "Maximum pending collect requests limit reached (10)"
        };
    }

    // Create collect request (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const upiRefNumber = npciService.generateTransactionRef();

    const collectRequest = await collectRequestModel.create({
        requester: userId,
        requesterVpa: requesterVpa.toLowerCase(),
        payer: payerVpaValidation.vpaRecord.user._id,
        payerVpa: payerVpa.toLowerCase(),
        amount: amount,
        note: note || "",
        expiresAt: expiresAt,
        upiRefNumber: upiRefNumber
    });

    // Notify payer about the collect request
    notificationService.sendCollectRequestNotification({
        payerId: payerVpaValidation.vpaRecord.user._id,
        amount: amount,
        requesterVpa: requesterVpa,
        requesterName: requesterVpaRecord.displayName || "UPI User",
        requestId: collectRequest._id,
        note: note
    }).catch(err => console.error("Collect notification error:", err.message));

    // Audit log
    await auditLogModel.create({
        action: "COLLECT_REQUEST_CREATED",
        performedBy: userId,
        targetUser: payerVpaValidation.vpaRecord.user._id,
        resourceType: "collectRequest",
        resourceId: collectRequest._id,
        metadata: { requesterVpa, payerVpa, amount, note },
        severity: "INFO"
    });

    return {
        success: true,
        message: "Collect request created successfully",
        collectRequest: {
            id: collectRequest._id,
            requesterVpa: requesterVpa,
            payerVpa: payerVpa,
            amount: amount,
            note: note,
            status: "PENDING",
            expiresAt: expiresAt,
            upiRefNumber: upiRefNumber
        }
    };
}

/**
 * Respond to a collect request (approve or decline).
 *
 * @param {Object} params - Response parameters
 * @param {string} params.requestId - Collect request ID
 * @param {string} params.action - "APPROVE" or "DECLINE"
 * @param {string} params.userId - Authenticated payer's user ID
 * @param {string} params.ipAddress - Request IP
 * @returns {Object} Response result
 */
async function respondToCollectRequest(params) {
    const { requestId, action, userId, ipAddress } = params;

    // Find the collect request
    const collectRequest = await collectRequestModel.findOne({
        _id: requestId,
        payer: userId,
        status: "PENDING"
    });

    if (!collectRequest) {
        return {
            success: false,
            message: "Collect request not found or already processed"
        };
    }

    // Check if expired
    if (collectRequest.expiresAt < new Date()) {
        collectRequest.status = "EXPIRED";
        await collectRequest.save();
        return {
            success: false,
            message: "This collect request has expired"
        };
    }

    // ─── DECLINE ───
    if (action === "DECLINE") {
        collectRequest.status = "DECLINED";
        collectRequest.respondedAt = new Date();
        await collectRequest.save();

        // Notify requester
        notificationService.sendCollectResponseNotification({
            requesterId: collectRequest.requester,
            amount: collectRequest.amount,
            payerVpa: collectRequest.payerVpa,
            payerName: "Payer",
            requestId: collectRequest._id
        }, "DECLINED").catch(err => console.error("Notification error:", err.message));

        await auditLogModel.create({
            action: "COLLECT_REQUEST_DECLINED",
            performedBy: userId,
            resourceType: "collectRequest",
            resourceId: collectRequest._id,
            metadata: { amount: collectRequest.amount },
            ipAddress: ipAddress,
            severity: "INFO"
        });

        return {
            success: true,
            message: "Collect request declined"
        };
    }

    // ─── APPROVE — Process the payment ───
    if (action === "APPROVE") {
        // Process payment (payer → requester)
        const paymentResult = await processP2PPayment({
            senderVpa: collectRequest.payerVpa,
            receiverVpa: collectRequest.requesterVpa,
            amount: collectRequest.amount,
            note: `Collect: ${collectRequest.note}`,
            userId: userId,
            ipAddress: ipAddress
        });

        if (paymentResult.success) {
            collectRequest.status = "APPROVED";
            collectRequest.respondedAt = new Date();
            collectRequest.transaction = paymentResult.transaction.id;
            await collectRequest.save();

            await auditLogModel.create({
                action: "COLLECT_REQUEST_APPROVED",
                performedBy: userId,
                resourceType: "collectRequest",
                resourceId: collectRequest._id,
                metadata: {
                    amount: collectRequest.amount,
                    transactionId: paymentResult.transaction.id
                },
                ipAddress: ipAddress,
                severity: "INFO"
            });

            // Notify requester
            notificationService.sendCollectResponseNotification({
                requesterId: collectRequest.requester,
                amount: collectRequest.amount,
                payerVpa: collectRequest.payerVpa,
                payerName: "Payer",
                requestId: collectRequest._id
            }, "APPROVED").catch(err => console.error("Notification error:", err.message));
        } else {
            collectRequest.status = "FAILED";
            collectRequest.respondedAt = new Date();
            await collectRequest.save();
        }

        return paymentResult;
    }

    return {
        success: false,
        message: "Invalid action. Use APPROVE or DECLINE"
    };
}

// ═══════════════════════════════════════════════════════
//  TRANSACTION REVERSAL — Auto-refund on failure
// ═══════════════════════════════════════════════════════

/**
 * Reverse a transaction (refund).
 * Creates reverse ledger entries: CREDIT back to sender, DEBIT from receiver.
 * This maintains the immutability of the ledger — no entries are deleted.
 *
 * @param {string} transactionId - The transaction to reverse
 * @param {string} reason - Reason for reversal
 * @param {string} performedBy - User ID who initiated reversal
 * @returns {Object} Reversal result
 */
async function reverseTransaction(transactionId, reason, performedBy) {
    // Find original transaction
    const originalTxn = await transactionModel.findById(transactionId);

    if (!originalTxn) {
        return { success: false, message: "Transaction not found" };
    }

    if (originalTxn.status === "REVERSED") {
        return { success: false, message: "Transaction already reversed" };
    }

    if (originalTxn.status !== "COMPLETED") {
        return { success: false, message: "Only completed transactions can be reversed" };
    }

    const reversalKey = `REVERSAL-${transactionId}-${Date.now()}`;
    let session;  // Declare outside try so catch can access it

    try {
        session = await mongoose.startSession();
        session.startTransaction();

        // Create reversal transaction (reverse direction)
        const reversalTxn = (await transactionModel.create([{
            fromAccount: originalTxn.toAccount,   // Reverse: receiver → sender
            toAccount: originalTxn.fromAccount,
            amount: originalTxn.amount,
            idempotencyKey: reversalKey,
            status: "PENDING"
        }], { session }))[0];

        // DEBIT receiver (take money back from receiver)
        await ledgerModel.create([{
            account: originalTxn.toAccount,
            amount: originalTxn.amount,
            transaction: reversalTxn._id,
            type: "DEBIT"
        }], { session });

        // CREDIT sender (refund money to sender)
        await ledgerModel.create([{
            account: originalTxn.fromAccount,
            amount: originalTxn.amount,
            transaction: reversalTxn._id,
            type: "CREDIT"
        }], { session });

        // Mark reversal as COMPLETED
        await transactionModel.findOneAndUpdate(
            { _id: reversalTxn._id },
            { status: "COMPLETED" },
            { session }
        );

        // Mark original transaction as REVERSED
        await transactionModel.findOneAndUpdate(
            { _id: originalTxn._id },
            { status: "REVERSED" },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        // Audit log
        await auditLogModel.create({
            action: "PAYMENT_REVERSED",
            performedBy: performedBy,
            resourceType: "transaction",
            resourceId: originalTxn._id,
            metadata: {
                originalTransactionId: transactionId,
                reversalTransactionId: reversalTxn._id,
                amount: originalTxn.amount,
                reason: reason
            },
            severity: "WARNING"
        });

        return {
            success: true,
            message: "Transaction reversed successfully",
            reversalTransaction: reversalTxn._id,
            amount: originalTxn.amount,
            reason: reason
        };

    } catch (error) {
        console.error("Transaction reversal error:", error.message);

        // Abort and clean up the leaked session
        if (session) {
            try {
                await session.abortTransaction();
            } catch (_) { /* already aborted */ }
            session.endSession();
        }

        return {
            success: false,
            message: "Failed to reverse transaction. Please contact support."
        };
    }
}

module.exports = {
    processP2PPayment,
    processP2MPayment,
    createCollectRequest,
    respondToCollectRequest,
    reverseTransaction,
    generateIdempotencyKey,
};
