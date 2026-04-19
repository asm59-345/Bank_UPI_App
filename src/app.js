const express = require("express")  // Import the Express framework to create the application
const cookieParser = require("cookie-parser")   // Middleware to parse cookies
const app = express()       // Create an instance of the Express application

app.use(express.json())     // Middleware to parse JSON request bodies
app.use(cookieParser())    // Middleware to parse cookies   
/**
 * - Routes required
 */
const authRouter = require("./routes/auth.routes")    
const accountRouter = require("./routes/account.routes")
const transactionRoutes = require("./routes/transaction.routes")
/**
 * - Use Routes
 */
app.get("/", (req, res) => {
    res.send("Ledger Service is up and running")
})

app.use("/api/auth", authRouter)     // FIXED: Corrected path to auth routes
app.use("/api/accounts", accountRouter)   // FIXED: Corrected path to transaction routes
app.use("/api/transactions", transactionRoutes)         // FIXED: Added transaction routes to the application

module.exports = app

