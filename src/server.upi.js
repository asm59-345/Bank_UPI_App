/**
 * ============================================================
 *  UPI BANKING SYSTEM — Server Entry Point
 * ============================================================
 *  Start the full UPI Banking System server.
 *  This loads the extended app (app.upi.js) which includes
 *  ALL original routes + all new UPI routes.
 *
 *  Usage:
 *    node src/server.upi.js
 *    OR
 *    npm run dev:upi
 *
 *  The original server.js remains untouched and can still
 *  be used to run only the original ledger system.
 * ============================================================
 */

require("dotenv").config();

const app = require("./app.upi");       // Extended app with full UPI system
const connectToDB = require("./config/db");

// ─── Connect to MongoDB ───
connectToDB();

// ─── Start the server ───
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("═══════════════════════════════════════════════════");
    console.log("  🏦 UPI BANKING SYSTEM — Server Started");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  🌐 Server:       http://localhost:${PORT}`);
    console.log(`  💚 Health:       http://localhost:${PORT}/api/health`);
    console.log("───────────────────────────────────────────────────");
    console.log("  📡 API Endpoints:");
    console.log(`     Auth:         /api/auth`);
    console.log(`     Accounts:     /api/accounts`);
    console.log(`     Transactions: /api/transactions`);
    console.log(`     UPI Pay:      /api/upi`);
    console.log(`     UPI ID:       /api/upi-id`);
    console.log(`     Bank Accts:   /api/bank-accounts`);
    console.log(`     Notifications:/api/notifications`);
    console.log(`     Admin:        /api/admin`);
    console.log("═══════════════════════════════════════════════════");
});
