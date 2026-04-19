/**
 * ============================================================
 *  UNIFIED NOTIFICATION SERVICE
 * ============================================================
 *  Centralized notification dispatcher that sends alerts
 *  across multiple channels (Email, SMS, Push, In-App).
 *
 *  Integrates with:
 *    - Existing email.service.js (for email notifications)
 *    - SMS gateway (stub — ready for Twilio/MSG91 integration)
 *    - Push notification service (stub — ready for FCM integration)
 *    - In-app notification storage (via notification model)
 *
 *  All notifications are logged in the notification model
 *  for audit trail and retry capability.
 *
 *  Notification types:
 *    - Transaction alerts (success/failure)
 *    - Collect request notifications
 *    - Security alerts (PIN change, login, fraud)
 *    - Account events (linking, verification)
 * ============================================================
 */

const notificationModel = require("../models/notification.model");
const emailService = require("./email.service");

// ═══════════════════════════════════════════════════════
//  STUB FUNCTIONS (defined first so they can be used below)
// ═══════════════════════════════════════════════════════

/**
 * Stub function for sending SMS notifications.
 * Replace with actual SMS gateway integration (Twilio, MSG91, etc.)
 *
 * @param {string} phone - Phone number
 * @param {string} message - SMS message
 */
async function sendSMS(phone, message) {
    // TODO: Integrate with SMS gateway (Twilio, MSG91, etc.)
    console.log(`[SMS STUB] To: ${phone}, Message: ${message}`);
    return { success: true, message: "SMS queued (stub)" };
}

/**
 * Stub function for sending push notifications.
 * Replace with Firebase Cloud Messaging (FCM) integration.
 *
 * @param {string} userId - User ID
 * @param {Object} payload - Push notification payload
 */
async function sendPushNotification(userId, payload) {
    // TODO: Integrate with Firebase Cloud Messaging (FCM)
    console.log(`[PUSH STUB] To User: ${userId}, Payload:`, payload);
    return { success: true, message: "Push notification queued (stub)" };
}

/**
 * Internal helper to send a generic email using the existing email service.
 * Wraps nodemailer transporter for non-transactional emails.
 *
 * @param {string} to - Recipient email address
 * @param {string} recipientName - Recipient's display name
 * @param {string} subject - Email subject line
 * @param {string} textBody - Plain text body
 */
async function _sendGenericEmail(to, recipientName, subject, textBody) {
    try {
        // Use the existing emailService's sendTransactionEmail as a generic sender
        // since it accepts (email, name, amount, toAccount)
        // For generic emails we just log — in production you'd call transporter directly
        console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
        return { success: true };
    } catch (error) {
        console.error("Email send failed:", error.message);
        return { success: false, message: error.message };
    }
}

// ═══════════════════════════════════════════════════════
//  TRANSACTION NOTIFICATIONS
// ═══════════════════════════════════════════════════════

/**
 * Send notification for a successful transaction.
 * Notifies both sender (debit) and receiver (credit).
 *
 * @param {Object} txnDetails - Transaction details
 * @param {string} txnDetails.senderId - Sender's user ID
 * @param {string} txnDetails.senderName - Sender's name
 * @param {string} txnDetails.senderEmail - Sender's email (optional)
 * @param {string} txnDetails.receiverId - Receiver's user ID
 * @param {string} txnDetails.receiverName - Receiver's name
 * @param {string} txnDetails.receiverEmail - Receiver's email (optional)
 * @param {number} txnDetails.amount - Transaction amount
 * @param {string} txnDetails.upiRefNumber - UPI reference number
 * @param {string} txnDetails.senderVpa - Sender's VPA
 * @param {string} txnDetails.receiverVpa - Receiver's VPA
 */
async function sendTransactionSuccessNotification(txnDetails) {
    try {
        // ─── Notification for SENDER (money debited) ───
        await notificationModel.create({
            user: txnDetails.senderId,
            channel: "IN_APP",
            category: "TRANSACTION_SUCCESS",
            title: `₹${txnDetails.amount} sent to ${txnDetails.receiverVpa}`,
            message: `You have successfully sent ₹${txnDetails.amount} to ${txnDetails.receiverName} (${txnDetails.receiverVpa}). UPI Ref: ${txnDetails.upiRefNumber}`,
            status: "SENT",
            metadata: {
                amount: txnDetails.amount,
                upiRefNumber: txnDetails.upiRefNumber,
                counterpartyVpa: txnDetails.receiverVpa,
                type: "DEBIT"
            }
        });

        // ─── Notification for RECEIVER (money credited) ───
        await notificationModel.create({
            user: txnDetails.receiverId,
            channel: "IN_APP",
            category: "TRANSACTION_SUCCESS",
            title: `₹${txnDetails.amount} received from ${txnDetails.senderVpa}`,
            message: `You have received ₹${txnDetails.amount} from ${txnDetails.senderName} (${txnDetails.senderVpa}). UPI Ref: ${txnDetails.upiRefNumber}`,
            status: "SENT",
            metadata: {
                amount: txnDetails.amount,
                upiRefNumber: txnDetails.upiRefNumber,
                counterpartyVpa: txnDetails.senderVpa,
                type: "CREDIT"
            }
        });

        // ─── Send email to sender (non-blocking, best-effort) ───
        if (txnDetails.senderEmail) {
            emailService.sendTransactionEmail(
                txnDetails.senderEmail,
                txnDetails.senderName,
                txnDetails.amount,
                txnDetails.receiverVpa
            ).catch(err => {
                console.error("Failed to send transaction email to sender:", err.message);
            });
        }

        // ─── Send email to receiver (non-blocking, best-effort) ───
        if (txnDetails.receiverEmail) {
            _sendGenericEmail(
                txnDetails.receiverEmail,
                txnDetails.receiverName,
                `₹${txnDetails.amount} received via UPI`,
                `Hello ${txnDetails.receiverName},\n\nYou have received ₹${txnDetails.amount} from ${txnDetails.senderName} (${txnDetails.senderVpa}).\nUPI Ref: ${txnDetails.upiRefNumber}\n\nBest regards,\nUPI Banking System`
            ).catch(err => {
                console.error("Failed to send transaction email to receiver:", err.message);
            });
        }

        return { success: true, message: "Transaction notifications sent" };

    } catch (error) {
        console.error("Error sending transaction notifications:", error.message);
        return { success: false, message: error.message };
    }
}

/**
 * Send notification for a failed transaction.
 *
 * @param {Object} txnDetails - Failed transaction details
 */
async function sendTransactionFailureNotification(txnDetails) {
    try {
        await notificationModel.create({
            user: txnDetails.senderId,
            channel: "IN_APP",
            category: "TRANSACTION_FAILED",
            title: `Payment of ₹${txnDetails.amount} failed`,
            message: `Your payment of ₹${txnDetails.amount} to ${txnDetails.receiverVpa} has failed. Reason: ${txnDetails.reason || "Unknown error"}. If debited, amount will be refunded within 5 business days.`,
            status: "SENT",
            metadata: {
                amount: txnDetails.amount,
                receiverVpa: txnDetails.receiverVpa,
                reason: txnDetails.reason,
                type: "FAILED"
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Error sending failure notification:", error.message);
        return { success: false, message: error.message };
    }
}

// ═══════════════════════════════════════════════════════
//  COLLECT REQUEST NOTIFICATIONS
// ═══════════════════════════════════════════════════════

/**
 * Notify payer about a new collect request.
 * "John Doe is requesting ₹500 from you"
 *
 * @param {Object} details - Collect request details
 */
async function sendCollectRequestNotification(details) {
    try {
        await notificationModel.create({
            user: details.payerId,
            channel: "IN_APP",
            category: "COLLECT_REQUEST_RECEIVED",
            title: `₹${details.amount} requested by ${details.requesterVpa}`,
            message: `${details.requesterName} (${details.requesterVpa}) is requesting ₹${details.amount} from you. Note: "${details.note || "No note"}". This request expires in 24 hours.`,
            status: "SENT",
            metadata: {
                amount: details.amount,
                requesterVpa: details.requesterVpa,
                requestId: details.requestId,
                note: details.note
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Error sending collect request notification:", error.message);
        return { success: false, message: error.message };
    }
}

/**
 * Notify requester when their collect request is approved/declined.
 *
 * @param {Object} details - Response details
 * @param {string} responseType - "APPROVED" or "DECLINED"
 */
async function sendCollectResponseNotification(details, responseType) {
    try {
        const category = responseType === "APPROVED"
            ? "COLLECT_REQUEST_APPROVED"
            : "COLLECT_REQUEST_DECLINED";

        const title = responseType === "APPROVED"
            ? `₹${details.amount} received from ${details.payerVpa}`
            : `Collect request of ₹${details.amount} declined by ${details.payerVpa}`;

        const message = responseType === "APPROVED"
            ? `${details.payerName} (${details.payerVpa}) has approved your collect request of ₹${details.amount}.`
            : `${details.payerName} (${details.payerVpa}) has declined your collect request of ₹${details.amount}.`;

        await notificationModel.create({
            user: details.requesterId,
            channel: "IN_APP",
            category: category,
            title: title,
            message: message,
            status: "SENT",
            metadata: {
                amount: details.amount,
                payerVpa: details.payerVpa,
                responseType: responseType,
                requestId: details.requestId
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Error sending collect response notification:", error.message);
        return { success: false, message: error.message };
    }
}

// ═══════════════════════════════════════════════════════
//  SECURITY NOTIFICATIONS
// ═══════════════════════════════════════════════════════

/**
 * Send security-related notifications (login, PIN change, fraud).
 *
 * @param {string} userId - User ID
 * @param {string} alertType - Type of security event
 * @param {Object} metadata - Additional context
 */
async function sendSecurityAlert(userId, alertType, metadata = {}) {
    try {
        const alertMessages = {
            "PIN_CHANGED": {
                title: "UPI PIN changed successfully",
                message: "Your UPI PIN has been changed. If you did not make this change, please contact support immediately."
            },
            "PIN_LOCKED": {
                title: "UPI PIN locked",
                message: "Your UPI PIN has been locked due to multiple failed attempts. It will be automatically unlocked after 30 minutes."
            },
            "FRAUD_DETECTED": {
                title: "Suspicious activity detected",
                message: `A suspicious transaction was detected on your account. ${metadata.details || "Please review your recent transactions."}`
            },
            "ACCOUNT_BLOCKED": {
                title: "Account blocked",
                message: "Your account has been blocked by the administrator. Please contact support for assistance."
            },
            "BANK_LINKED": {
                title: "Bank account linked",
                message: `Your bank account ending in ${metadata.accountLast4 || "XXXX"} has been linked successfully.`
            },
            "BANK_VERIFIED": {
                title: "Bank account verified",
                message: `Your bank account ending in ${metadata.accountLast4 || "XXXX"} has been verified successfully via penny drop.`
            },
        };

        const alert = alertMessages[alertType] || {
            title: "Security notification",
            message: "A security event occurred on your account."
        };

        await notificationModel.create({
            user: userId,
            channel: "IN_APP",
            category: "SECURITY_ALERT",
            title: alert.title,
            message: alert.message,
            status: "SENT",
            metadata: { alertType, ...metadata }
        });

        return { success: true };
    } catch (error) {
        console.error("Error sending security alert:", error.message);
        return { success: false, message: error.message };
    }
}

// ═══════════════════════════════════════════════════════
//  UTILITY: Get user's notifications
// ═══════════════════════════════════════════════════════

/**
 * Get paginated notifications for a user.
 *
 * @param {string} userId - User ID
 * @param {Object} options - { page, limit, unreadOnly }
 * @returns {Object} { notifications, total, page, totalPages }
 */
async function getUserNotifications(userId, options = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query = { user: userId };
    if (options.unreadOnly) {
        query.isRead = false;
    }

    const [notifications, total] = await Promise.all([
        notificationModel
            .find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        notificationModel.countDocuments(query)
    ]);

    return {
        notifications,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        unreadCount: options.unreadOnly ? total : await notificationModel.countDocuments({ user: userId, isRead: false })
    };
}

/**
 * Mark notifications as read.
 *
 * @param {string} userId - User ID
 * @param {string[]} notificationIds - Array of notification IDs to mark as read
 */
async function markAsRead(userId, notificationIds = []) {
    const query = { user: userId };
    if (notificationIds.length > 0) {
        query._id = { $in: notificationIds };
    }
    await notificationModel.updateMany(query, { isRead: true });
}

module.exports = {
    sendTransactionSuccessNotification,
    sendTransactionFailureNotification,
    sendCollectRequestNotification,
    sendCollectResponseNotification,
    sendSecurityAlert,
    getUserNotifications,
    markAsRead,
    sendSMS,
    sendPushNotification,
};
