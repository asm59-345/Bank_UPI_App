/**
 * ============================================================
 *  RATE LIMITER MIDDLEWARE
 * ============================================================
 *  In-memory rate limiting middleware to protect API endpoints
 *  from abuse, brute-force attacks, and DDoS attempts.
 *
 *  Features:
 *    - Per-IP rate limiting
 *    - Per-user rate limiting (if authenticated)
 *    - Configurable window size and max requests
 *    - Automatic cleanup of expired entries (prevents memory leak)
 *    - Different limits for different endpoint categories
 *
 *  Note: In production with horizontal scaling, replace this
 *  with Redis-based rate limiting (e.g., ioredis + sliding window).
 *  This in-memory implementation works for single-node deployments.
 * ============================================================
 */

const UPI_CONFIG = require("../config/upi.config");

// ─── In-memory store for tracking request counts ───
// Structure: { identifier: { count: number, resetTime: timestamp } }
const requestStore = new Map();

// ─── Automatic cleanup interval (every 5 minutes) ───
// Prevents memory leak by removing expired entries
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requestStore.entries()) {
        if (now > value.resetTime) {
            requestStore.delete(key);
        }
    }
}, 5 * 60 * 1000);  // Run cleanup every 5 minutes

/**
 * Creates a rate limiter middleware with configurable options.
 *
 * @param {Object} options - Rate limiting configuration
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 min)
 * @param {number} options.maxRequests - Max requests per window (default: 100)
 * @param {string} options.keyPrefix - Prefix for identifying this limiter
 * @param {string} options.message - Custom error message
 * @returns {Function} Express middleware function
 */
function createRateLimiter(options = {}) {
    const {
        windowMs = UPI_CONFIG.RATE_LIMIT.WINDOW_MS,
        maxRequests = UPI_CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_WINDOW,
        keyPrefix = "general",
        message = "Too many requests. Please try again later."
    } = options;

    return function rateLimiterMiddleware(req, res, next) {
        // Build identifier: prefer user ID (if authenticated), fallback to IP
        const userIdentifier = req.user ? req.user._id.toString() : "anon";
        const ip = req.ip || req.connection.remoteAddress || "unknown";
        const key = `${keyPrefix}:${userIdentifier}:${ip}`;

        const now = Date.now();
        const record = requestStore.get(key);

        if (!record || now > record.resetTime) {
            // First request in this window or window expired — start new window
            requestStore.set(key, {
                count: 1,
                resetTime: now + windowMs
            });
            // Set rate limit headers (following standard convention)
            res.set("X-RateLimit-Limit", maxRequests.toString());
            res.set("X-RateLimit-Remaining", (maxRequests - 1).toString());
            res.set("X-RateLimit-Reset", new Date(now + windowMs).toISOString());
            return next();
        }

        // Within current window — increment count
        record.count += 1;

        // Set rate limit headers
        const remaining = Math.max(0, maxRequests - record.count);
        res.set("X-RateLimit-Limit", maxRequests.toString());
        res.set("X-RateLimit-Remaining", remaining.toString());
        res.set("X-RateLimit-Reset", new Date(record.resetTime).toISOString());

        if (record.count > maxRequests) {
            // Rate limit exceeded
            const retryAfterMs = record.resetTime - now;
            const retryAfterSec = Math.ceil(retryAfterMs / 1000);

            res.set("Retry-After", retryAfterSec.toString());

            return res.status(429).json({
                status: "error",
                message: message,
                retryAfterSeconds: retryAfterSec,
                limit: maxRequests,
                windowMs: windowMs
            });
        }

        return next();
    };
}

// ═══════════════════════════════════════════════════════
//  PRE-CONFIGURED RATE LIMITERS
// ═══════════════════════════════════════════════════════

/**
 * General API rate limiter — 100 requests per 15 minutes
 * Apply to all API routes as baseline protection.
 */
const generalLimiter = createRateLimiter({
    windowMs: UPI_CONFIG.RATE_LIMIT.WINDOW_MS,
    maxRequests: UPI_CONFIG.RATE_LIMIT.MAX_REQUESTS_PER_WINDOW,
    keyPrefix: "general",
    message: "Too many API requests. Please slow down."
});

/**
 * Payment rate limiter — 20 payment requests per 15 minutes
 * Stricter limit for payment endpoints.
 */
const paymentLimiter = createRateLimiter({
    windowMs: UPI_CONFIG.RATE_LIMIT.WINDOW_MS,
    maxRequests: UPI_CONFIG.RATE_LIMIT.MAX_PAYMENT_REQUESTS_PER_WINDOW,
    keyPrefix: "payment",
    message: "Too many payment requests. Please wait before making another payment."
});

/**
 * Auth rate limiter — 10 auth attempts per 15 minutes
 * Prevents brute-force login/registration attacks.
 */
const authLimiter = createRateLimiter({
    windowMs: UPI_CONFIG.RATE_LIMIT.WINDOW_MS,
    maxRequests: UPI_CONFIG.RATE_LIMIT.MAX_AUTH_REQUESTS_PER_WINDOW,
    keyPrefix: "auth",
    message: "Too many authentication attempts. Please try again later."
});

module.exports = {
    createRateLimiter,
    generalLimiter,
    paymentLimiter,
    authLimiter
};
