/**
 * ============================================================
 *  NOTIFICATION MODEL — Transactional Notification Log
 * ============================================================
 *  Stores all notifications sent to users across channels
 *  (Email, SMS, Push). This provides:
 *    - Audit trail of all communications
 *    - Retry capability for failed notifications
 *    - Notification history for user's activity feed
 *
 *  Notifications are triggered by:
 *    - Successful/failed transactions
 *    - Collect requests (sent/received)
 *    - Security alerts (login, PIN change, fraud)
 *    - Account events (linking, verification)
 * ============================================================
 */

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({

    // ─── The user who receives this notification ───
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Notification must be associated with a user"],
        index: true
    },

    // ─── Notification channel ───
    channel: {
        type: String,
        enum: {
            values: ["EMAIL", "SMS", "PUSH", "IN_APP"],
            message: "Channel must be EMAIL, SMS, PUSH, or IN_APP"
        },
        required: [true, "Notification channel is required"]
    },

    // ─── Notification category for filtering ───
    category: {
        type: String,
        enum: {
            values: [
                "TRANSACTION_SUCCESS",
                "TRANSACTION_FAILED",
                "COLLECT_REQUEST_RECEIVED",
                "COLLECT_REQUEST_APPROVED",
                "COLLECT_REQUEST_DECLINED",
                "COLLECT_REQUEST_EXPIRED",
                "SECURITY_ALERT",
                "ACCOUNT_LINKED",
                "ACCOUNT_VERIFIED",
                "PIN_CHANGED",
                "FRAUD_ALERT",
                "SYSTEM"
            ],
            message: "Invalid notification category"
        },
        required: [true, "Notification category is required"]
    },

    // ─── Short notification title ───
    title: {
        type: String,
        required: [true, "Notification title is required"],
        trim: true,
        maxlength: [200, "Title cannot exceed 200 characters"]
    },

    // ─── Full notification message body ───
    message: {
        type: String,
        required: [true, "Notification message is required"],
        trim: true,
        maxlength: [2000, "Message cannot exceed 2000 characters"]
    },

    // ─── Delivery status ───
    status: {
        type: String,
        enum: {
            values: ["PENDING", "SENT", "DELIVERED", "FAILED", "RETRY"],
            message: "Status must be PENDING, SENT, DELIVERED, FAILED, or RETRY"
        },
        default: "PENDING"
    },

    // ─── Number of delivery attempts ───
    attempts: {
        type: Number,
        default: 0
    },

    // ─── Error message if delivery failed ───
    errorMessage: {
        type: String,
        default: null
    },

    // ─── Whether the user has read this notification ───
    isRead: {
        type: Boolean,
        default: false
    },

    // ─── Additional metadata (transaction ID, amount, etc.) ───
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true
});

// ─── Index for user's notification feed (most recent first) ───
notificationSchema.index({ user: 1, createdAt: -1 });

// ─── Index for finding failed notifications to retry ───
notificationSchema.index({ status: 1, attempts: 1 });

// ─── Index for finding unread notifications ───
notificationSchema.index({ user: 1, isRead: 1 });

// ─── TTL index: auto-delete notifications older than 90 days ───
notificationSchema.index({ createdAt: 1 }, {
    expireAfterSeconds: 90 * 24 * 60 * 60  // 90 days
});

const notificationModel = mongoose.model("notification", notificationSchema);

module.exports = notificationModel;
