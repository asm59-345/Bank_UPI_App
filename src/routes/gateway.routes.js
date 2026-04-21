/**
 * ============================================================
 *  GATEWAY ROUTES
 * ============================================================
 */

const express = require('express');
const router = express.Router();
const gatewayController = require('../controllers/gateway.controller');

// Mock Authentication Middleware for Gateway API
// In production, this validates the Bearer api_secret
const gatewayAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized API Key' });
    }
    next();
};

// Developer endpoints
router.post('/keys/generate', gatewayController.generateApiKeys);

// Transaction processing endpoints
router.post('/payments/create', gatewayAuth, gatewayController.createPayment);
router.get('/payments/:id', gatewayAuth, gatewayController.verifyPayment);
router.post('/payment-links', gatewayAuth, gatewayController.createPaymentLink);

// Webhook simulation
router.post('/webhook/trigger', gatewayAuth, gatewayController.triggerWebhook);

module.exports = router;
