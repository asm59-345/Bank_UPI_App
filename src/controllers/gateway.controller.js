/**
 * ============================================================
 *  STUDENT PAYMENT GATEWAY CONTROLLER
 * ============================================================
 *  Implements a simulated third-party Payment Gateway API
 *  for student developers to integrate into their projects.
 * ============================================================
 */

const crypto = require('crypto');
const transactionModel = require('../models/transaction.model');

// Temporary in-memory store for payment links & API keys for demo
const paymentLinks = new Map();

/**
 * Expose an endpoint to generate API Keys
 */
async function generateApiKeys(req, res) {
    const apiKey = `test_${crypto.randomBytes(8).toString('hex')}`;
    const apiSecret = `secret_${crypto.randomBytes(16).toString('hex')}`;

    return res.status(200).json({
        success: true,
        data: {
            api_key: apiKey,
            api_secret: apiSecret,
            usage_limit: 1000,
            plan: 'STUDENT_DEVELOPER'
        }
    });
}

/**
 * Create a new Payment order (used by external apps)
 */
async function createPayment(req, res) {
    const { amount, currency, upi_id, description } = req.body;

    if (!amount || !upi_id) {
        return res.status(400).json({ status: 'error', message: 'Amount and upi_id are required' });
    }

    const paymentId = `pay_${crypto.randomBytes(8).toString('hex')}`;
    
    // In a real app we'd save this to a `payment_orders` collection
    paymentLinks.set(paymentId, {
        amount,
        currency: currency || 'INR',
        upi_id,
        description,
        status: 'pending',
        createdAt: new Date()
    });

    return res.status(201).json({
        payment_id: paymentId,
        status: 'pending',
        amount,
        webhook_supported: true,
        qr_code: `upi://pay?pa=${upi_id}&pn=StudentGateway&am=${amount}&tr=${paymentId}&cu=INR`
    });
}

/**
 * Verify Payment Status
 */
async function verifyPayment(req, res) {
    const { id } = req.params;
    const payment = paymentLinks.get(id);

    if (!payment) {
        // Fallback: Check if it's a real transaction ID in MongoDB
        try {
            const txn = await transactionModel.findById(id);
            if (txn) {
                return res.status(200).json({ payment_id: txn._id, status: txn.status.toLowerCase() });
            }
        } catch (e) { /* ignore */ }

        return res.status(404).json({ status: 'error', message: 'Payment not found' });
    }

    return res.status(200).json({
        payment_id: id,
        status: payment.status,
        amount: payment.amount
    });
}

/**
 * Create a Shareable UPI Payment Link
 */
async function createPaymentLink(req, res) {
    const { amount, description, customer_email } = req.body;

    if (!amount) {
        return res.status(400).json({ status: 'error', message: 'Amount is required' });
    }

    const linkId = `plink_${crypto.randomBytes(8).toString('hex')}`;
    const shortUrl = `https://pay.yourupiapp.com/${linkId}`;

    return res.status(201).json({
        link_id: linkId,
        short_url: shortUrl,
        amount,
        description,
        status: 'active'
    });
}

/**
 * Webhook Simulation
 */
async function triggerWebhook(req, res) {
    const { payment_id, status } = req.body;
    
    const payment = paymentLinks.get(payment_id);
    if (payment) {
        payment.status = status;
        paymentLinks.set(payment_id, payment);
    }

    // Attempt to fire webhook to external URL would go here using Axios
    return res.status(200).json({
        success: true,
        message: `Webhook processing triggered for ${payment_id}`
    });
}

module.exports = {
    generateApiKeys,
    createPayment,
    verifyPayment,
    createPaymentLink,
    triggerWebhook
};
