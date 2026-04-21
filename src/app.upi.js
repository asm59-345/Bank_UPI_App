/**
 * ============================================================
 *  UPI BANKING SYSTEM — Extended Application Entry Point
 * ============================================================
 *  This file extends the original app.js WITHOUT modifying it.
 *  It imports the original Express app and mounts all new UPI
 *  routes on top of the existing ones.
 *
 *  Architecture:
 *    Original app.js (UNTOUCHED)
 *      └── /api/auth      → Auth routes (existing)
 *      └── /api/accounts   → Account routes (existing)
 *      └── /api/transactions → Transaction routes (existing)
 *
 *    This file (app.upi.js) extends with:
 *      └── /api/upi         → UPI payment routes (P2P, P2M, collect, refund)
 *      └── /api/upi-id      → VPA management routes
 *      └── /api/bank-accounts → Bank account linking routes
 *      └── /api/admin       → Admin panel routes
 *      └── /api/notifications → Notification routes
 *
 *  Usage:
 *    To run with UPI features, update server.js to import this
 *    file instead of app.js, OR use this file directly:
 *
 *      const app = require("./app.upi");  // Instead of ./app
 *
 *  Note: The original app.js remains fully functional and
 *  can still be used independently.
 *
 *  ⚠️  This project uses Express 5. Key differences handled:
 *    - Async middleware errors are automatically forwarded to error handler
 *    - Route registration order matters for path matching
 * ============================================================
 */

const app = require("./app");  // Import the original, unmodified Express app

// ─── CORS: Must be FIRST — allows Next.js frontend (localhost:3001) ───
app.use((req, res, next) => {
    const allowedOrigins = [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// ─── Import Security Middleware ───
const {
    noSqlInjectionGuard,
    xssGuard,
    securityHeaders,
    secureRequestLogger
} = require("./middleware/security.middleware");

// ─── Import Rate Limiter (applied globally to new routes) ───
const { generalLimiter } = require("./middleware/rateLimiter.middleware");

// ═══════════════════════════════════════════════════════
//  GLOBAL SECURITY MIDDLEWARE (applied before ALL routes)
// ═══════════════════════════════════════════════════════

// Security headers on every response (OWASP)
app.use(securityHeaders);

// Prevent NoSQL injection attacks ($gt, $ne in body/query)
app.use(noSqlInjectionGuard);

// Prevent XSS injection via user input
app.use(xssGuard);

// Secure request logging (masks passwords, PINs, tokens)
app.use(secureRequestLogger);

// ═══════════════════════════════════════════════════════
//  NEW ROUTE IMPORTS — UPI Banking System Extensions
// ═══════════════════════════════════════════════════════

const upiRoutes = require("./routes/upi.routes");
const upiIdRoutes = require("./routes/upiId.routes");
const bankAccountRoutes = require("./routes/bankAccount.routes");
const adminRoutes = require("./routes/admin.routes");

// ─── Notification controller (inline for simplicity) ───
const { authMiddleware } = require("./middleware/auth.middleware");
const notificationService = require("./services/notification.service");
const notificationModel = require("./models/notification.model");

// ═══════════════════════════════════════════════════════
//  MOUNT NEW ROUTES
// ═══════════════════════════════════════════════════════

/**
 * UPI Payment Routes
 * Handles: P2P pay, P2M pay, collect requests, transaction history, refunds
 * Base path: /api/upi
 */
app.use("/api/upi", generalLimiter, upiRoutes);

/**
 * UPI ID (VPA) Management Routes
 * Handles: Create, list, deactivate, set default, resolve VPA
 * Base path: /api/upi-id
 */
app.use("/api/upi-id", generalLimiter, upiIdRoutes);

/**
 * Bank Account Linking Routes
 * Handles: Link, list, verify, unlink, set primary, set PIN
 * Base path: /api/bank-accounts
 */
app.use("/api/bank-accounts", generalLimiter, bankAccountRoutes);

/**
 * Admin Panel Routes
 * Handles: System stats, transactions, fraud alerts, user management, audit logs
 * Base path: /api/admin
 * Access: System users only (uses authSystemUserMiddleware)
 */
app.use("/api/admin", generalLimiter, adminRoutes);

/**
 * Developer Payment Gateway API (Student Program)
 * Handles: Pay links, verify, API keys
 * Base path: /v1
 */
const gatewayRoutes = require("./routes/gateway.routes");
app.use("/v1", generalLimiter, gatewayRoutes);

// ═══════════════════════════════════════════════════════
//  NOTIFICATION ROUTES (inline — lightweight endpoints)
//  NOTE: More specific paths MUST be registered BEFORE
//  generic paths to ensure correct Express route matching.
// ═══════════════════════════════════════════════════════

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications (for badge display).
 * ⚠️ MUST be registered BEFORE the generic GET /api/notifications
 *    to prevent "unread-count" from being treated as a param.
 */
app.get("/api/notifications/unread-count", authMiddleware, async (req, res) => {
    try {
        const count = await notificationModel.countDocuments({
            user: req.user._id,
            isRead: false
        });

        return res.status(200).json({
            status: "success",
            data: { unreadCount: count }
        });
    } catch (error) {
        console.error("Unread count error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});

/**
 * PUT /api/notifications/read
 * Mark notifications as read.
 * Body: { notificationIds?: string[] }  (if empty, marks all as read)
 */
app.put("/api/notifications/read", authMiddleware, async (req, res) => {
    try {
        const { notificationIds } = req.body;
        await notificationService.markAsRead(req.user._id, notificationIds || []);

        return res.status(200).json({
            status: "success",
            message: "Notifications marked as read"
        });
    } catch (error) {
        console.error("Mark notifications read error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});

/**
 * GET /api/notifications
 * Get user's notifications with pagination.
 * Query: { page?, limit?, unreadOnly? }
 */
app.get("/api/notifications", authMiddleware, async (req, res) => {
    try {
        const result = await notificationService.getUserNotifications(
            req.user._id,
            {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 20,
                unreadOnly: req.query.unreadOnly === "true"
            }
        );

        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        console.error("Get notifications error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Internal server error"
        });
    }
});

// ═══════════════════════════════════════════════════════
//  HEALTH CHECK — Extended version with UPI status
// ═══════════════════════════════════════════════════════

/**
 * GET /api/health
 * Extended health check showing all available services.
 */
app.get("/api/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        service: "UPI Banking System",
        version: "2.0.0",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        modules: {
            auth: "✅ Active",
            accounts: "✅ Active",
            transactions: "✅ Active",
            ledger: "✅ Active",
            upi_payments: "✅ Active",
            upi_id: "✅ Active",
            bank_accounts: "✅ Active",
            fraud_detection: "✅ Active",
            notifications: "✅ Active",
            admin_panel: "✅ Active",
            npci_simulator: "✅ Active",
            audit_logs: "✅ Active"
        },
        endpoints: {
            auth: "/api/auth",
            accounts: "/api/accounts",
            transactions: "/api/transactions",
            upi: "/api/upi",
            upiId: "/api/upi-id",
            bankAccounts: "/api/bank-accounts",
            notifications: "/api/notifications",
            admin: "/api/admin",
            health: "/api/health"
        }
    });
});

// ═══════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════

/**
 * Global error handling middleware.
 * Catches unhandled errors and returns a consistent response.
 *
 * Express 5 automatically catches rejected Promises in async
 * route handlers and forwards them here.
 */
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.message);
    console.error(err.stack);

    // Mongoose validation errors
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            status: "error",
            message: "Validation failed",
            errors: messages
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "unknown";
        return res.status(409).json({
            status: "error",
            message: `Duplicate value for field: ${field}`
        });
    }

    // Mongoose CastError (invalid ObjectId)
    if (err.name === "CastError" && err.kind === "ObjectId") {
        return res.status(400).json({
            status: "error",
            message: `Invalid ID format: ${err.value}`
        });
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            status: "error",
            message: "Invalid authentication token"
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            status: "error",
            message: "Authentication token has expired"
        });
    }

    // Default error
    return res.status(err.status || 500).json({
        status: "error",
        message: process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message || "Internal server error"
    });
});

module.exports = app;
