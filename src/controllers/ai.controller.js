const aiService = require('../services/ai.service');

// Controller for AI functionality

async function getFinancialAdvice(req, res) {
    try {
        // Mock user ID
        const userId = req.user ? req.user._id : 'demo_user';
        const advice = await aiService.getFinancialAdvice(userId);
        res.status(200).json({ success: true, data: advice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function chat(req, res) {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }
        const response = await aiService.handleChatbotQuery(message);
        res.status(200).json({ success: true, answer: response });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

async function routeTransaction(req, res) {
    try {
        const { amount } = req.body;
        const gateways = [
            { id: 'gw1', name: 'Gateway A', latency: 120, success_rate: 99.5, load: 40 },
            { id: 'gw2', name: 'Gateway B', latency: 300, success_rate: 98.0, load: 20 },
            { id: 'gw3', name: 'Gateway C', latency: 80, success_rate: 95.0, load: 80 }
        ];
        const best = aiService.routePayment(amount, gateways);
        res.status(200).json({ success: true, best_gateway: best });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    getFinancialAdvice,
    chat,
    routeTransaction
};
