const axios = require('axios');
const transactionModel = require('../models/transaction.model');
const userModel = require('../models/user.model');
const fraudAlertModel = require('../models/fraudAlert.model');

/**
 * ============================================================
 *  AI Agent Services
 * ============================================================
 */

// 1. Payment Agent: Handles transactions, retry failed, suggest method
async function executePaymentWithRetry(paymentDetails, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            // Simulated transaction execution logic
            const isSuccess = Math.random() > 0.1; // 90% success rate
            if (!isSuccess) throw new Error('Bank network timeout');
            
            return { success: true, message: 'Payment successful on attempt ' + (i + 1) };
        } catch (error) {
            if (i === retries - 1) {
                return { success: false, message: 'Payment failed after retries', suggest: 'Try IMPS instead of UPI' };
            }
            // exponential backoff
            await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
        }
    }
}

// 2. Fraud Detection Agent: Calls Python ML Microservice
async function assessFraudRisk(transactionData) {
    try {
        const response = await axios.post('http://127.0.0.1:8000/predict', {
            amount: transactionData.amount,
            transaction_time: new Date().getHours(),
            location: transactionData.location || 0,
            device_change: transactionData.device_change ? 1 : 0,
            transaction_frequency: transactionData.freq || 1,
            avg_user_spending: transactionData.avg_spending || 1000,
            last_transaction_gap: transactionData.gap || 24
        });
        
        return response.data;
    } catch (error) {
        console.error('Fraud Service down, assuming safe fallback.', error.message);
        return { fraud: 0, risk_score: 0.1, reason: 'Service unavailable' };
    }
}

// 3. Financial Advisor Agent: Analyze spending & predict expenses
async function getFinancialAdvice(userId) {
    // Generate AI-powered insights
    const insights = [
        "You've spent 40% of your budget on food this week! Consider cooking at home to save.",
        "Your average monthly spending is ₹15,000. At this rate, you'll reach your ₹20,000 limit by the 20th.",
        "Based on your habits, you are expected to spend ₹4000 on travel next month.",
        "You saved ₹200 this week by using cashback offers. Great job!"
    ];
    
    return {
        userId,
        current_spending: Math.random() * 20000,
        predicted_expenses: Math.random() * 5000 + 15000,
        advice: insights[Math.floor(Math.random() * insights.length)]
    };
}

// 4. Smart Routing Agent: Select best gateway
function routePayment(amount, gatewayOptions) {
    // Selects the best gateway based on mock latency, load, success rate
    const scoredGateways = gatewayOptions.map(g => {
        // lower score is better
        const score = (g.latency * 0.4) + ((100 - g.success_rate) * 0.6) + (g.load * 0.2);
        return { ...g, score };
    });
    
    scoredGateways.sort((a, b) => a.score - b.score);
    return scoredGateways[0]; 
}

// 5. AI Chatbot
async function handleChatbotQuery(query) {
    const q = query.toLowerCase();
    if (q.includes('spend') || q.includes('spent')) {
        return "You have spent ₹3,450 so far this week.";
    } else if (q.includes('balance')) {
        return "Your current balance is ₹12,500.";
    } else if (q.includes('limit') || q.includes('budget')) {
        return "You are 80% close to your monthly budget limit. Watch out!";
    }
    return "I can help you with spending analysis, recent transactions, and checking your balance. Ask me anything!";
}

module.exports = {
    executePaymentWithRetry,
    assessFraudRisk,
    getFinancialAdvice,
    routePayment,
    handleChatbotQuery
};
