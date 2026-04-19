/**
 * ============================================================
 *  FRAUD DETECTION ENGINE SERVICE
 * ============================================================
 *  Real-time fraud detection system that assesses risk for
 *  every UPI transaction before it's processed. Uses a
 *  rule-based scoring engine that evaluates multiple signals.
 *
 *  Risk Assessment Rules:
 *    1. Velocity Check: Too many transactions in a short period
 *    2. High Value: Transaction amount exceeds thresholds
 *    3. Unusual Hours: Transactions during 12AM-5AM IST
 *    4. Rapid Recipient Changes: Many unique recipients in 1 hour
 *    5. New Account: Account created less than 24 hours ago
 *    6. Cumulative Daily Amount: Total daily volume exceeds limit
 *
 *  Each rule contributes a weighted score. The total risk score
 *  determines whether the transaction proceeds, gets flagged,
 *  or gets blocked.
 *
 *  Scoring:
 *    0-25:  LOW — proceed normally
 *    26-50: MEDIUM — flag for post-transaction review
 *    51-75: HIGH — require additional verification
 *    76+:   CRITICAL — block the transaction
 * ============================================================
 */

const mongoose = require("mongoose");
const transactionModel = require("../models/transaction.model");
const fraudAlertModel = require("../models/fraudAlert.model");
const accountModel = require("../models/account.model");
const UPI_CONFIG = require("../config/upi.config");

/**
 * Main fraud assessment function.
 * Evaluates a pending transaction across all fraud rules
 * and returns a comprehensive risk assessment.
 *
 * @param {string} userId - The user initiating the transaction
 * @param {string|ObjectId} fromAccountId - Sender's account ID
 * @param {number} amount - Transaction amount in INR
 * @param {Object} metadata - Additional context (receiverVpa, type, ipAddress, etc.)
 * @returns {Object} { riskScore, riskLevel, triggers[], blocked, alertId }
 */
async function assessRisk(userId, fromAccountId, amount, metadata = {}) {
    const triggers = [];
    let totalScore = 0;

    // Ensure fromAccountId is a proper ObjectId for MongoDB queries
    const accountObjectId = typeof fromAccountId === "string"
        ? new mongoose.Types.ObjectId(fromAccountId)
        : fromAccountId;

    // ─── RULE 1: Velocity Check ───
    // Detect rapid-fire transactions (possible bot/automated fraud)
    try {
        const velocityResult = await checkVelocity(accountObjectId);
        if (velocityResult.triggered) {
            triggers.push(velocityResult.trigger);
            totalScore += velocityResult.score;
        }
    } catch (err) {
        console.error("Fraud rule VELOCITY_CHECK failed:", err.message);
    }

    // ─── RULE 2: High Value Transaction Check ───
    // Flag unusually large transactions
    const highValueResult = checkHighValue(amount);
    if (highValueResult.triggered) {
        triggers.push(highValueResult.trigger);
        totalScore += highValueResult.score;
    }

    // ─── RULE 3: Unusual Hours Check ───
    // Transactions between 12AM-5AM IST are suspicious
    const unusualHoursResult = checkUnusualHours();
    if (unusualHoursResult.triggered) {
        triggers.push(unusualHoursResult.trigger);
        totalScore += unusualHoursResult.score;
    }

    // ─── RULE 4: Rapid Recipient Changes ───
    // Many unique recipients in a short time suggests money mule activity
    try {
        const recipientResult = await checkRapidRecipients(accountObjectId);
        if (recipientResult.triggered) {
            triggers.push(recipientResult.trigger);
            totalScore += recipientResult.score;
        }
    } catch (err) {
        console.error("Fraud rule RAPID_RECIPIENTS failed:", err.message);
    }

    // ─── RULE 5: New Account Check ───
    // Newly created accounts transacting heavily are suspicious
    try {
        const newAccountResult = await checkNewAccount(accountObjectId);
        if (newAccountResult.triggered) {
            triggers.push(newAccountResult.trigger);
            totalScore += newAccountResult.score;
        }
    } catch (err) {
        console.error("Fraud rule NEW_ACCOUNT failed:", err.message);
    }

    // ─── RULE 6: Cumulative Daily Amount ───
    // Total daily volume exceeding limit
    try {
        const dailyAmountResult = await checkDailyAmount(accountObjectId, amount);
        if (dailyAmountResult.triggered) {
            triggers.push(dailyAmountResult.trigger);
            totalScore += dailyAmountResult.score;
        }
    } catch (err) {
        console.error("Fraud rule DAILY_AMOUNT failed:", err.message);
    }

    // Cap score at 100
    totalScore = Math.min(totalScore, 100);

    // Determine risk level based on score
    const riskLevel = getRiskLevel(totalScore);
    const blocked = totalScore >= UPI_CONFIG.FRAUD.CRITICAL_RISK;

    // Create fraud alert if score is above LOW threshold
    let alertId = null;
    if (totalScore > UPI_CONFIG.FRAUD.LOW_RISK) {
        try {
            const alert = await fraudAlertModel.create({
                user: userId,
                riskScore: totalScore,
                riskLevel: riskLevel,
                triggers: triggers,
                status: "FLAGGED",
                transactionBlocked: blocked,
                transactionSnapshot: {
                    amount: amount,
                    senderVpa: metadata.senderVpa || null,
                    receiverVpa: metadata.receiverVpa || null,
                    type: metadata.type || "P2P"
                }
            });
            alertId = alert._id;
        } catch (err) {
            console.error("Failed to create fraud alert:", err.message);
        }
    }

    return {
        riskScore: totalScore,
        riskLevel: riskLevel,
        triggers: triggers,
        blocked: blocked,
        alertId: alertId,
        message: blocked
            ? "Transaction blocked due to high fraud risk. Please contact support."
            : riskLevel === "HIGH"
                ? "Transaction flagged for additional verification."
                : "Risk assessment passed."
    };
}

// ═══════════════════════════════════════════════════════
//  INDIVIDUAL FRAUD DETECTION RULES
// ═══════════════════════════════════════════════════════

/**
 * RULE 1: Velocity Check
 * Detects too many transactions from the same account in 1 minute.
 * Pattern: Bot-driven automated fraud, card testing attacks.
 *
 * @param {ObjectId} fromAccountId - Sender account ObjectId
 */
async function checkVelocity(fromAccountId) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);

    // Count transactions from this account in the last minute
    // Using transaction model which HAS timestamps
    const recentTxnCount = await transactionModel.countDocuments({
        fromAccount: fromAccountId,
        createdAt: { $gte: oneMinuteAgo },
        status: { $in: ["PENDING", "COMPLETED"] }
    });

    if (recentTxnCount >= UPI_CONFIG.FRAUD.MAX_TRANSACTIONS_PER_MINUTE) {
        return {
            triggered: true,
            score: 30,  // Heavy weight — velocity is a strong fraud signal
            trigger: {
                rule: "VELOCITY_CHECK",
                description: `${recentTxnCount} transactions in the last minute (threshold: ${UPI_CONFIG.FRAUD.MAX_TRANSACTIONS_PER_MINUTE})`,
                scoreContribution: 30
            }
        };
    }

    return { triggered: false };
}

/**
 * RULE 2: High Value Transaction
 * Flags transactions above ₹50,000 and ₹1,00,000 thresholds.
 * Higher amounts get higher risk scores.
 *
 * @param {number} amount - Transaction amount
 */
function checkHighValue(amount) {
    if (amount >= UPI_CONFIG.FRAUD.VERY_HIGH_VALUE_THRESHOLD) {
        return {
            triggered: true,
            score: 25,
            trigger: {
                rule: "VERY_HIGH_VALUE",
                description: `Transaction amount ₹${amount} exceeds ₹${UPI_CONFIG.FRAUD.VERY_HIGH_VALUE_THRESHOLD} threshold`,
                scoreContribution: 25
            }
        };
    }

    if (amount >= UPI_CONFIG.FRAUD.HIGH_VALUE_THRESHOLD) {
        return {
            triggered: true,
            score: 15,
            trigger: {
                rule: "HIGH_VALUE",
                description: `Transaction amount ₹${amount} exceeds ₹${UPI_CONFIG.FRAUD.HIGH_VALUE_THRESHOLD} threshold`,
                scoreContribution: 15
            }
        };
    }

    return { triggered: false };
}

/**
 * RULE 3: Unusual Hours Check
 * Transactions between 12AM-5AM IST are statistically
 * more likely to be unauthorized/fraudulent.
 */
function checkUnusualHours() {
    // Get current hour in IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset * 60 * 1000);
    const hour = istTime.getUTCHours();

    if (hour >= UPI_CONFIG.FRAUD.UNUSUAL_HOURS_START && hour < UPI_CONFIG.FRAUD.UNUSUAL_HOURS_END) {
        return {
            triggered: true,
            score: 15,
            trigger: {
                rule: "UNUSUAL_HOURS",
                description: `Transaction initiated at ${hour}:00 IST (unusual hours: ${UPI_CONFIG.FRAUD.UNUSUAL_HOURS_START}:00-${UPI_CONFIG.FRAUD.UNUSUAL_HOURS_END}:00)`,
                scoreContribution: 15
            }
        };
    }

    return { triggered: false };
}

/**
 * RULE 4: Rapid Recipient Changes
 * Detects money being sent to many different people in a short
 * time — a strong indicator of money mule/laundering activity.
 *
 * @param {ObjectId} fromAccountId - Sender account ObjectId
 */
async function checkRapidRecipients(fromAccountId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Find unique recipients in the last hour
    // Using transaction model which HAS timestamps
    const recentRecipients = await transactionModel.distinct("toAccount", {
        fromAccount: fromAccountId,
        createdAt: { $gte: oneHourAgo },
        status: { $in: ["PENDING", "COMPLETED"] }
    });

    if (recentRecipients.length >= UPI_CONFIG.FRAUD.MAX_UNIQUE_RECIPIENTS_PER_HOUR) {
        return {
            triggered: true,
            score: 25,
            trigger: {
                rule: "RAPID_RECIPIENT_CHANGES",
                description: `${recentRecipients.length} unique recipients in the last hour (threshold: ${UPI_CONFIG.FRAUD.MAX_UNIQUE_RECIPIENTS_PER_HOUR})`,
                scoreContribution: 25
            }
        };
    }

    return { triggered: false };
}

/**
 * RULE 5: New Account Check
 * Newly created accounts (< 24 hours old) that immediately
 * start transacting are suspicious.
 *
 * @param {ObjectId} fromAccountId - Sender account ObjectId
 */
async function checkNewAccount(fromAccountId) {
    const account = await accountModel.findById(fromAccountId);

    if (!account) {
        return { triggered: false };
    }

    const accountAge = Date.now() - account.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (accountAge < twentyFourHours) {
        return {
            triggered: true,
            score: 20,
            trigger: {
                rule: "NEW_ACCOUNT",
                description: `Account created ${Math.round(accountAge / 3600000)} hours ago (threshold: 24 hours)`,
                scoreContribution: 20
            }
        };
    }

    return { triggered: false };
}

/**
 * RULE 6: Cumulative Daily Amount
 * Checks if the user's total daily transaction volume
 * (including this transaction) would exceed the daily limit.
 *
 * NOTE: Uses transaction model (has timestamps) instead of
 * ledger model (no timestamps) for accurate date filtering.
 *
 * @param {ObjectId} fromAccountId - Sender account ObjectId
 * @param {number} currentAmount - Current transaction amount
 */
async function checkDailyAmount(fromAccountId, currentAmount) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Sum all completed outgoing transactions from this account today
    // Using TRANSACTION model which HAS timestamps (ledger model does NOT)
    const dailyTransactions = await transactionModel.aggregate([
        {
            $match: {
                fromAccount: fromAccountId,
                status: "COMPLETED",
                createdAt: { $gte: startOfDay }
            }
        },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: "$amount" }
            }
        }
    ]);

    const totalToday = (dailyTransactions.length > 0 ? dailyTransactions[0].totalAmount : 0) + currentAmount;

    if (totalToday >= UPI_CONFIG.TRANSACTION_LIMITS.DAILY_LIMIT) {
        return {
            triggered: true,
            score: 20,
            trigger: {
                rule: "DAILY_LIMIT_EXCEEDED",
                description: `Daily transaction volume ₹${totalToday} would exceed ₹${UPI_CONFIG.TRANSACTION_LIMITS.DAILY_LIMIT} limit`,
                scoreContribution: 20
            }
        };
    }

    return { triggered: false };
}

/**
 * Helper: Convert numeric risk score to risk level string
 *
 * @param {number} score - Risk score (0-100)
 * @returns {string} Risk level (LOW, MEDIUM, HIGH, CRITICAL)
 */
function getRiskLevel(score) {
    if (score >= UPI_CONFIG.FRAUD.CRITICAL_RISK) return "CRITICAL";
    if (score >= UPI_CONFIG.FRAUD.HIGH_RISK) return "HIGH";
    if (score >= UPI_CONFIG.FRAUD.MEDIUM_RISK) return "MEDIUM";
    return "LOW";
}

module.exports = {
    assessRisk,
    getRiskLevel,
};
