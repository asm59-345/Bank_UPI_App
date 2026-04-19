/**
 * ============================================================
 *  UPI PAYMENT CONTROLLER
 * ============================================================
 *  Handles all UPI payment-related HTTP endpoints:
 *    - POST /api/upi/pay           → P2P payment via VPA
 *    - POST /api/upi/pay/merchant  → P2M merchant payment
 *    - POST /api/upi/collect       → Create collect request
 *    - POST /api/upi/collect/:id/respond → Approve/decline collect
 *    - GET  /api/upi/transactions  → Transaction history
 *    - POST /api/upi/refund        → Reverse a transaction
 *
 *  All endpoints require JWT authentication (auth middleware).
 *  Payment endpoints also require UPI PIN validation.
 * ============================================================
 */

const upiService = require("../services/upi.service");
const collectRequestModel = require("../models/collectRequest.model");
const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");

/**
 * POST /api/upi/pay
 * Process a P2P (Person-to-Person) UPI payment.
 *
 * Request body:
 *   - senderVpa: string (sender's VPA, e.g., "user@upi")
 *   - receiverVpa: string (receiver's VPA)
 *   - amount: number (amount in INR, min ₹1, max ₹1,00,000)
 *   - upiPin: string (6-digit UPI PIN)
 *   - note: string (optional payment note)
 *
 * Response: Transaction result with UPI reference number
 */
async function payP2P(req, res) {
    try {
        const { senderVpa, receiverVpa, amount, note } = req.body;

        // Validate required fields
        if (!senderVpa || !receiverVpa || !amount) {
            return res.status(400).json({
                status: "error",
                message: "senderVpa, receiverVpa, and amount are required"
            });
        }

        // Validate amount is a positive number
        if (typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Amount must be a positive number"
            });
        }

        // Process the payment
        const result = await upiService.processP2PPayment({
            senderVpa,
            receiverVpa,
            amount,
            note: note || "",
            userId: req.user._id,
            ipAddress: req.ip
        });

        if (!result.success) {
            return res.status(400).json({
                status: "error",
                responseCode: result.responseCode,
                message: result.message,
                upiRefNumber: result.upiRefNumber || null
            });
        }

        return res.status(201).json({
            status: "success",
            message: result.message,
            data: result.transaction,
            riskAssessment: result.riskAssessment
        });

    } catch (error) {
        console.error("P2P payment error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during payment processing"
        });
    }
}

/**
 * POST /api/upi/pay/merchant
 * Process a P2M (Person-to-Merchant) payment.
 * Same interface as P2P but tagged as merchant payment.
 */
async function payMerchant(req, res) {
    try {
        const { senderVpa, merchantVpa, amount, note } = req.body;

        if (!senderVpa || !merchantVpa || !amount) {
            return res.status(400).json({
                status: "error",
                message: "senderVpa, merchantVpa, and amount are required"
            });
        }

        if (typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Amount must be a positive number"
            });
        }

        const result = await upiService.processP2MPayment({
            senderVpa,
            receiverVpa: merchantVpa,
            amount,
            note: note || "",
            userId: req.user._id,
            ipAddress: req.ip
        });

        if (!result.success) {
            return res.status(400).json({
                status: "error",
                responseCode: result.responseCode,
                message: result.message
            });
        }

        return res.status(201).json({
            status: "success",
            message: result.message,
            data: result.transaction
        });

    } catch (error) {
        console.error("P2M payment error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during merchant payment"
        });
    }
}

/**
 * POST /api/upi/collect
 * Create a collect (pull payment) request.
 *
 * Request body:
 *   - requesterVpa: string (your VPA)
 *   - payerVpa: string (payer's VPA — person you're requesting from)
 *   - amount: number (amount to request)
 *   - note: string (optional note/purpose)
 */
async function createCollect(req, res) {
    try {
        const { requesterVpa, payerVpa, amount, note } = req.body;

        if (!requesterVpa || !payerVpa || !amount) {
            return res.status(400).json({
                status: "error",
                message: "requesterVpa, payerVpa, and amount are required"
            });
        }

        if (typeof amount !== "number" || amount <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Amount must be a positive number"
            });
        }

        const result = await upiService.createCollectRequest({
            requesterVpa,
            payerVpa,
            amount,
            note: note || "",
            userId: req.user._id
        });

        if (!result.success) {
            return res.status(400).json({
                status: "error",
                message: result.message
            });
        }

        return res.status(201).json({
            status: "success",
            message: result.message,
            data: result.collectRequest
        });

    } catch (error) {
        console.error("Collect request error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error while creating collect request"
        });
    }
}

/**
 * POST /api/upi/collect/:requestId/respond
 * Approve or decline a collect request.
 *
 * URL params:
 *   - requestId: Collect request ID
 *
 * Request body:
 *   - action: "APPROVE" or "DECLINE"
 *   - upiPin: string (required only for APPROVE)
 */
async function respondToCollect(req, res) {
    try {
        const { requestId } = req.params;
        const { action } = req.body;

        if (!action || !["APPROVE", "DECLINE"].includes(action.toUpperCase())) {
            return res.status(400).json({
                status: "error",
                message: "action is required and must be APPROVE or DECLINE"
            });
        }

        const result = await upiService.respondToCollectRequest({
            requestId,
            action: action.toUpperCase(),
            userId: req.user._id,
            ipAddress: req.ip
        });

        if (!result.success) {
            return res.status(400).json({
                status: "error",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            data: result.transaction || null
        });

    } catch (error) {
        console.error("Collect response error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error while responding to collect request"
        });
    }
}

/**
 * GET /api/upi/transactions
 * Get transaction history for the authenticated user.
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20, max 50)
 *   - status: string (filter by status: PENDING, COMPLETED, FAILED, REVERSED)
 *   - type: string ("sent" or "received")
 */
async function getTransactionHistory(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);
        const skip = (page - 1) * limit;
        const { status, type } = req.query;

        // Find all accounts owned by this user
        const userAccounts = await accountModel.find({ user: req.user._id });
        const accountIds = userAccounts.map(acc => acc._id);

        if (accountIds.length === 0) {
            return res.status(200).json({
                status: "success",
                data: {
                    transactions: [],
                    page,
                    totalPages: 0,
                    total: 0
                }
            });
        }

        // Build query
        const query = {};

        // Filter by sent or received
        if (type === "sent") {
            query.fromAccount = { $in: accountIds };
        } else if (type === "received") {
            query.toAccount = { $in: accountIds };
        } else {
            // All transactions involving user's accounts
            query.$or = [
                { fromAccount: { $in: accountIds } },
                { toAccount: { $in: accountIds } }
            ];
        }

        // Filter by status
        if (status) {
            query.status = status.toUpperCase();
        }

        // Execute query with pagination
        const [transactions, total] = await Promise.all([
            transactionModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("fromAccount", "user status currency")
                .populate("toAccount", "user status currency")
                .lean(),
            transactionModel.countDocuments(query)
        ]);

        // Annotate each transaction with direction (sent/received)
        const annotated = transactions.map(txn => {
            const isSender = accountIds.some(id => id.equals(txn.fromAccount?._id));
            return {
                ...txn,
                direction: isSender ? "SENT" : "RECEIVED"
            };
        });

        return res.status(200).json({
            status: "success",
            data: {
                transactions: annotated,
                page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error("Transaction history error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error while fetching transactions"
        });
    }
}

/**
 * POST /api/upi/refund
 * Reverse/refund a completed transaction.
 *
 * Request body:
 *   - transactionId: string (transaction to reverse)
 *   - reason: string (reason for refund)
 */
async function refundTransaction(req, res) {
    try {
        const { transactionId, reason } = req.body;

        if (!transactionId || !reason) {
            return res.status(400).json({
                status: "error",
                message: "transactionId and reason are required"
            });
        }

        const result = await upiService.reverseTransaction(
            transactionId,
            reason,
            req.user._id
        );

        if (!result.success) {
            return res.status(400).json({
                status: "error",
                message: result.message
            });
        }

        return res.status(200).json({
            status: "success",
            message: result.message,
            data: {
                reversalTransactionId: result.reversalTransaction,
                amount: result.amount,
                reason: result.reason
            }
        });

    } catch (error) {
        console.error("Refund error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during refund processing"
        });
    }
}

/**
 * GET /api/upi/collect/pending
 * Get all pending collect requests for the authenticated user (as payer).
 */
async function getPendingCollects(req, res) {
    try {
        const collects = await collectRequestModel
            .find({
                payer: req.user._id,
                status: "PENDING",
                expiresAt: { $gt: new Date() }
            })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            status: "success",
            data: {
                collectRequests: collects,
                total: collects.length
            }
        });

    } catch (error) {
        console.error("Pending collects error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

module.exports = {
    payP2P,
    payMerchant,
    createCollect,
    respondToCollect,
    getTransactionHistory,
    refundTransaction,
    getPendingCollects
};
