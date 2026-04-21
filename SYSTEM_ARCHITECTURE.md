# AI-Powered UPI & Fintech Platform Architecture

This document covers the comprehensive project structure, schemas, and API documentation for the fully scaled AI-integrated banking application. All files mentioned have been successfully integrated into your `Bank_UPI_App` directory.

## 1. Full Folder Structure

```text
Bank_UPI_App/
│
├── frontend/                     # Next.js 14 Frontend Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/       # Main banking dashboard
│   │   │   │   ├── fraud-dashboard/ # Specialized security metrics
│   │   │   │   ├── ai-insights/     # [NEW] FinAI advisor, chat & graphs
│   │   │   │   └── transactions/
│   │   │   └── globals.css          # Tailwind and global styles
│   │   └── components/
│   │       └── ui/                  # Reusable UI components
│   └── next.config.js
│
├── fraud_service/                # Python ML Microservice
│   ├── main.py                   # FastAPI prediction server
│   ├── train_model.py            # [NEW] Dataset generation & Isolation/RandomForest mapping
│   ├── fraud_model.pkl           # Saved model state
│   ├── transactions_dataset.csv  # 10,000+ synthetic generated transactions
│   └── requirements.txt
│
├── src/                          # Node.js/Express Backend System
│   ├── controllers/
│   │   ├── ai.controller.js      # [NEW] AI routing, chatbot, finance advice
│   │   ├── gateway.controller.js # [NEW] Student Payment Gateway & API Sandbox
│   │   ├── transaction.controller.js
│   │   └── upi.controller.js
│   ├── services/
│   │   └── ai.service.js         # [NEW] Code for the 4 Agents (Payment, Fraud, Advisor, Routing)
│   ├── routes/
│   │   ├── ai.routes.js          # /api/ai
│   │   ├── gateway.routes.js     # /v1 (API Gateway logic)
│   │   └── auth.routes.js
│   ├── models/
│   │   ├── transaction.model.js
│   │   └── user.model.js
│   ├── app.upi.js                # Core API entry point (Express)
│   └── server.js                 # Application runner
│
├── .env                          # Environment variables & secrets
├── package.json                  # Node dependencies (axios, mongoose, express, etc)
├── start.bat                     # Quick-start script for all 4 microservices
└── DEPLOYMENT_AND_TESTING_PLAN.md # Render & Vercel deploy steps
```


## 2. API Documentation

### AI Features Endpoints (/api/ai)
- `GET /api/ai/advice`: Returns predicted end-of-month expenses and smart contextual advice using the Financial Advisor Agent.
- `POST /api/ai/chat`: Interactive Chatbot NLP endpoint. Accepts `{"message": "..."}` and returns financial insights.
- `POST /api/ai/route-payment`: Given a transaction `amount`, evaluates latency and network load across multiple gateways to recommend the most optimal path.

### Payment Gateway API (/v1) *(For Student Developer Integrations)*
- `POST /v1/keys/generate`: Issues `api_key` and `api_secret` for test tier.
- `POST /v1/payments/create`: (Requires Header `Bearer <api_secret>`) Generates a unique transaction identifier and payment QR code/UPI link string.
- `GET /v1/payments/:id`: Fetch transaction validity or fail states.
- `POST /v1/payment-links`: Generate a shareable, active payment URL structure pointing to the frontend.
- `POST /v1/webhook/trigger`: Simulates a bank clearing a transaction internally without real money.

### ML Fraud Prediction Endpoint (Python)
- `POST /predict (port 8000)`: Evaluates unsupervised anomalies via Isolation Forest and Random Forest categorization. Passes `amount`, `gap`, `velocity`, etc., to generate a risk float between `0.0` and `1.0`.


## 3. Database Schema Mapping (MongoDB)

Our system extensively leverages NoSQL flexibility combined with Mongoose schemas:

**Users (`user.model.js`)**
- `_id`, `name`, `email`, `password`, `pin_hash` (secured credentials).
- `role`: Standard user or API developer.

**Accounts & Bank Linking (`bankAccount.model.js`)**
- `userId`, `accountNo`, `ifsc`, `bankName`.
- `balance`: Real-time mutable balance mapped to a decentralized ledger check.

**Transactions (`transaction.model.js`)**
- `transactionId` (Unique NPCI trace logic)
- `senderId`, `receiverId`, `amount`, `status`: (PENDING, COMPLETED, FAILED)
- `riskScore`: (Populated seamlessly by the Fraud Agent hook).

**Gateways & Limits (Virtual)**
- Simulated `Gateway Map` in the gateway controller holding tracking objects for Developer API uses. In production, this shifts to a schema featuring `apiKey`, `requestsMade`, `rateLimit`.

## 4. Where is my code?
Since I operate directly inside your IDE environment, I have natively modified your actual project repository! The entire backend, frontend code, machine learning python scripts, and agent logic are locally saved into your actual `.py`, `.js`, and `.tsx` files right now. You do **not** need to manually copy code from this chat!
