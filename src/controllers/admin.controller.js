/**
 * ============================================================
 *  ADMIN PANEL CONTROLLER
 * ============================================================
 *  Administrative endpoints for monitoring, fraud management,
 *  user management, and system statistics.
 *
 *  All admin endpoints require system user authentication
 *  (authSystemUserMiddleware from existing auth.middleware).
 *
 *  Endpoints:
 *    - GET    /api/admin/transactions            → All transactions
 *    - GET    /api/admin/fraud-alerts             → Fraud alerts dashboard
 *    - PUT    /api/admin/fraud-alerts/:id/review  → Review fraud alert
 *    - POST   /api/admin/users/:id/block          → Block user
 *    - POST   /api/admin/users/:id/unblock        → Unblock user
 *    - GET    /api/admin/stats                    → System statistics
 *    - GET    /api/admin/audit-logs               → Audit trail
 * ============================================================
 */

const transactionModel = require("../models/transaction.model");
const fraudAlertModel = require("../models/fraudAlert.model");
const userModel = require("../models/user.model");
const accountModel = require("../models/account.model");
const auditLogModel = require("../models/auditLog.model");
const notificationModel = require("../models/notification.model");
const upiIdModel = require("../models/upiId.model");
const notificationService = require("../services/notification.service");

/**
 * GET /api/admin/transactions
 * Get all transactions with filtering and pagination.
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 20, max 100)
 *   - status: string (PENDING, COMPLETED, FAILED, REVERSED)
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - minAmount: number
 *   - maxAmount: number
 */
async function getAllTransactions(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        // Build filter query
        const query = {};

        if (req.query.status) {
            query.status = req.query.status.toUpperCase();
        }
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
        }
        if (req.query.minAmount || req.query.maxAmount) {
            query.amount = {};
            if (req.query.minAmount) query.amount.$gte = parseFloat(req.query.minAmount);
            if (req.query.maxAmount) query.amount.$lte = parseFloat(req.query.maxAmount);
        }

        const [transactions, total] = await Promise.all([
            transactionModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("fromAccount", "user status")
                .populate("toAccount", "user status")
                .lean(),
            transactionModel.countDocuments(query)
        ]);

        return res.status(200).json({
            status: "success",
            data: {
                transactions,
                page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error("Admin get transactions error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * GET /api/admin/fraud-alerts
 * Get fraud alerts for the admin dashboard.
 *
 * Query params:
 *   - page, limit, status, riskLevel, startDate, endDate
 */
async function getFraudAlerts(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        const query = {};

        if (req.query.status) {
            query.status = req.query.status.toUpperCase();
        }
        if (req.query.riskLevel) {
            query.riskLevel = req.query.riskLevel.toUpperCase();
        }
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
        }

        const [alerts, total] = await Promise.all([
            fraudAlertModel
                .find(query)
                .sort({ riskScore: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("user", "name email")
                .populate("reviewedBy", "name email")
                .lean(),
            fraudAlertModel.countDocuments(query)
        ]);

        // Get summary counts by status
        const statusCounts = await fraudAlertModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        return res.status(200).json({
            status: "success",
            data: {
                alerts,
                page,
                totalPages: Math.ceil(total / limit),
                total,
                statusSummary: statusCounts.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error("Admin get fraud alerts error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * PUT /api/admin/fraud-alerts/:id/review
 * Review a fraud alert (clear, confirm fraud, or escalate).
 *
 * Request body:
 *   - status: "CLEARED" | "CONFIRMED_FRAUD" | "ESCALATED"
 *   - notes: string (review notes)
 */
async function reviewFraudAlert(req, res) {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const validStatuses = ["CLEARED", "CONFIRMED_FRAUD", "ESCALATED", "UNDER_REVIEW"];
        if (!status || !validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                status: "error",
                message: `status must be one of: ${validStatuses.join(", ")}`
            });
        }

        const alert = await fraudAlertModel.findById(id);
        if (!alert) {
            return res.status(404).json({
                status: "error",
                message: "Fraud alert not found"
            });
        }

        // Update alert
        alert.status = status.toUpperCase();
        alert.reviewedBy = req.user._id;
        alert.reviewedAt = new Date();
        alert.reviewNotes = notes || "";
        await alert.save();

        // If confirmed fraud, block the user
        if (status.toUpperCase() === "CONFIRMED_FRAUD") {
            // Freeze all user accounts
            await accountModel.updateMany(
                { user: alert.user },
                { status: "FROZEN" }
            );

            // Deactivate all VPAs
            await upiIdModel.updateMany(
                { user: alert.user, status: "ACTIVE" },
                { status: "INACTIVE" }
            );

            // Send security alert to user
            notificationService.sendSecurityAlert(
                alert.user,
                "ACCOUNT_BLOCKED",
                { reason: "Confirmed fraudulent activity" }
            ).catch(err => console.error("Notification error:", err.message));
        }

        // Audit log
        await auditLogModel.create({
            action: "FRAUD_ALERT_REVIEWED",
            performedBy: req.user._id,
            targetUser: alert.user,
            resourceType: "fraudAlert",
            resourceId: alert._id,
            metadata: {
                newStatus: status.toUpperCase(),
                notes: notes,
                riskScore: alert.riskScore
            },
            ipAddress: req.ip,
            severity: status.toUpperCase() === "CONFIRMED_FRAUD" ? "CRITICAL" : "INFO"
        });

        return res.status(200).json({
            status: "success",
            message: `Fraud alert marked as ${status.toUpperCase()}`,
            data: alert
        });

    } catch (error) {
        console.error("Review fraud alert error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * POST /api/admin/users/:id/block
 * Block a user — freezes all accounts and deactivates VPAs.
 *
 * Request body:
 *   - reason: string (reason for blocking)
 */
async function blockUser(req, res) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }

        // Freeze all accounts
        const accountResult = await accountModel.updateMany(
            { user: id, status: "ACTIVE" },
            { status: "FROZEN" }
        );

        // Deactivate all VPAs
        const vpaResult = await upiIdModel.updateMany(
            { user: id, status: "ACTIVE" },
            { status: "INACTIVE" }
        );

        // Audit log
        await auditLogModel.create({
            action: "USER_BLOCKED",
            performedBy: req.user._id,
            targetUser: id,
            resourceType: "user",
            resourceId: id,
            metadata: {
                reason: reason || "Admin action",
                accountsFrozen: accountResult.modifiedCount,
                vpasDeactivated: vpaResult.modifiedCount
            },
            ipAddress: req.ip,
            severity: "CRITICAL"
        });

        // Notify user
        notificationService.sendSecurityAlert(
            id,
            "ACCOUNT_BLOCKED",
            { reason: reason || "Administrative action" }
        ).catch(err => console.error("Notification error:", err.message));

        return res.status(200).json({
            status: "success",
            message: `User ${user.name} has been blocked`,
            data: {
                accountsFrozen: accountResult.modifiedCount,
                vpasDeactivated: vpaResult.modifiedCount
            }
        });

    } catch (error) {
        console.error("Block user error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * POST /api/admin/users/:id/unblock
 * Unblock a user — reactivates all frozen accounts.
 */
async function unblockUser(req, res) {
    try {
        const { id } = req.params;

        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({
                status: "error",
                message: "User not found"
            });
        }

        // Reactivate frozen accounts
        const accountResult = await accountModel.updateMany(
            { user: id, status: "FROZEN" },
            { status: "ACTIVE" }
        );

        // Audit log
        await auditLogModel.create({
            action: "USER_UNBLOCKED",
            performedBy: req.user._id,
            targetUser: id,
            resourceType: "user",
            resourceId: id,
            metadata: { accountsReactivated: accountResult.modifiedCount },
            ipAddress: req.ip,
            severity: "WARNING"
        });

        return res.status(200).json({
            status: "success",
            message: `User ${user.name} has been unblocked`,
            data: {
                accountsReactivated: accountResult.modifiedCount
            }
        });

    } catch (error) {
        console.error("Unblock user error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * GET /api/admin/stats
 * Get system-wide statistics for the admin dashboard.
 *
 * Returns:
 *   - Total users, accounts, transactions
 *   - Transaction volume (today, this week, this month)
 *   - Success/failure rates
 *   - Fraud alert counts
 *   - Active VPA count
 */
async function getSystemStats(req, res) {
    try {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Run all queries in parallel for performance
        const [
            totalUsers,
            totalAccounts,
            totalTransactions,
            todayTransactions,
            weekTransactions,
            monthTransactions,
            transactionsByStatus,
            totalFraudAlerts,
            unreviewedAlerts,
            totalVpas,
            todayVolume
        ] = await Promise.all([
            userModel.countDocuments(),
            accountModel.countDocuments(),
            transactionModel.countDocuments(),
            transactionModel.countDocuments({ createdAt: { $gte: startOfDay } }),
            transactionModel.countDocuments({ createdAt: { $gte: startOfWeek } }),
            transactionModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
            transactionModel.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            fraudAlertModel.countDocuments(),
            fraudAlertModel.countDocuments({ status: "FLAGGED" }),
            upiIdModel.countDocuments({ status: "ACTIVE" }),
            transactionModel.aggregate([
                { $match: { createdAt: { $gte: startOfDay }, status: "COMPLETED" } },
                { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } }
            ])
        ]);

        // Calculate success rate
        const statusMap = transactionsByStatus.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {});

        const completed = statusMap["COMPLETED"] || 0;
        const failed = statusMap["FAILED"] || 0;
        const successRate = totalTransactions > 0
            ? ((completed / totalTransactions) * 100).toFixed(2)
            : "0.00";

        return res.status(200).json({
            status: "success",
            data: {
                overview: {
                    totalUsers,
                    totalAccounts,
                    totalTransactions,
                    activeVpas: totalVpas
                },
                transactionVolume: {
                    today: todayTransactions,
                    thisWeek: weekTransactions,
                    thisMonth: monthTransactions,
                    todayAmount: todayVolume.length > 0 ? todayVolume[0].totalAmount : 0
                },
                transactionStatus: statusMap,
                successRate: `${successRate}%`,
                fraud: {
                    totalAlerts: totalFraudAlerts,
                    unreviewedAlerts: unreviewedAlerts
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("System stats error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

/**
 * GET /api/admin/audit-logs
 * Get system audit logs with filtering.
 *
 * Query params:
 *   - page, limit, action, severity, userId, startDate, endDate
 */
async function getAuditLogs(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.action) query.action = req.query.action.toUpperCase();
        if (req.query.severity) query.severity = req.query.severity.toUpperCase();
        if (req.query.userId) query.performedBy = req.query.userId;
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
        }

        const [logs, total] = await Promise.all([
            auditLogModel
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("performedBy", "name email")
                .populate("targetUser", "name email")
                .lean(),
            auditLogModel.countDocuments(query)
        ]);

        return res.status(200).json({
            status: "success",
            data: {
                logs,
                page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        console.error("Audit logs error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
}

module.exports = {
    getAllTransactions,
    getFraudAlerts,
    reviewFraudAlert,
    blockUser,
    unblockUser,
    getSystemStats,
    getAuditLogs
};
