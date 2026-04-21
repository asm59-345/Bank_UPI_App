const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');

// AI Routes
router.get('/advice', aiController.getFinancialAdvice);
router.post('/chat', aiController.chat);
router.post('/route-payment', aiController.routeTransaction);

module.exports = router;
