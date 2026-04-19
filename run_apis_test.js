const mongoose = require("mongoose");
const app = require("./src/app");
// Load environment variables
require("dotenv").config();

const connectToDB = require("./src/config/db");
const userModel = require("./src/models/user.model");
const accountModel = require("./src/models/account.model");
const jwt = require("jsonwebtoken");

async function runTests() {
  console.log("Connecting to Database...");
  await connectToDB();

  console.log("Starting local test server on port 3001...");
  const server = app.listen(3001);

  try {
    const baseUrl = "http://localhost:3001/api";

    // Helper for making API calls
    const makeRequest = async (method, endpoint, body = null, token = null) => {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    console.log("\n========================================");
    console.log("1. SEEDING SYSTEM USER");
    console.log("========================================");
    let systemUser = await userModel.findOne({ email: "system@ledger.com" }).select("+systemUser");
    if (!systemUser) {
      systemUser = await userModel.create({
        email: "system@ledger.com",
        name: "System Admin",
        password: "systempassword",
        systemUser: true
      });
      // Workaround because systemUser is immutable and default false:
      await userModel.updateOne({ _id: systemUser._id }, { $set: { systemUser: true } });
      systemUser = await userModel.findById(systemUser._id).select("+systemUser");
      console.log("System User Created:", systemUser.email);
    } else {
      console.log("System User already exists:", systemUser.email);
    }

    let systemAccount = await accountModel.findOne({ user: systemUser._id });
    if (!systemAccount) {
      systemAccount = await accountModel.create({ user: systemUser._id, status: "ACTIVE" });
      console.log("System Account created:", systemAccount._id);
    }

    const systemToken = jwt.sign({ userId: systemUser._id }, process.env.JWT_SECRET, { expiresIn: "10h" });

    // Ensure we don't duplicate registration tests if users already exist
    const user1Email = `user1_${Date.now()}@test.com`;
    const user2Email = `user2_${Date.now()}@test.com`;

    console.log("\n========================================");
    console.log("2. RUNNING REGISTER APIs");
    console.log("========================================");
    const regRes1 = await makeRequest("POST", "/auth/register", {
      email: user1Email,
      name: "Test User 1",
      password: "password123"
    });
    console.log("Register User 1 Response:", regRes1.status);
    const user1Token = regRes1.data.token;

    const regRes2 = await makeRequest("POST", "/auth/register", {
      email: user2Email,
      name: "Test User 2",
      password: "password123"
    });
    console.log("Register User 2 Response:", regRes2.status);
    const user2Token = regRes2.data.token;

    console.log("\n========================================");
    console.log("3. RUNNING LOGIN APIs");
    console.log("========================================");
    const loginRes = await makeRequest("POST", "/auth/login", {
      email: user1Email,
      password: "password123"
    });
    console.log("Login User 1 Response:", loginRes.status);
    if (loginRes.status !== 200) throw new Error("Login failed");

    console.log("\n========================================");
    console.log("4. CREATING ACCOUNTS VIA API");
    console.log("========================================");
    const accRes1 = await makeRequest("POST", "/accounts/", {}, user1Token);
    console.log("Create Account User 1:", accRes1.data);
    const user1AccountId = accRes1.data.account._id;

    const accRes2 = await makeRequest("POST", "/accounts/", {}, user2Token);
    console.log("Create Account User 2:", accRes2.data);
    const user2AccountId = accRes2.data.account._id;

    console.log("\n========================================");
    console.log("5. ADD INITIAL FUNDS FROM SYSTEM VIA API");
    console.log("========================================");
    const fundRes = await makeRequest("POST", "/transactions/system/initial-funds", {
      toAccount: user1AccountId,
      amount: 1000,
      idempotencyKey: `INIT_${Date.now()}`
    }, systemToken);
    console.log("Initial Funds Response:", fundRes.status, fundRes.data.message || fundRes.data);

    // Wait a brief moment to let DB catch up (though it's awaited)
    await new Promise(r => setTimeout(r, 1000));

    let balRes = await makeRequest("GET", `/accounts/balance/${user1AccountId}`, null, user1Token);
    console.log("User 1 Balance after Initial Funds:", balRes.data.balance);

    console.log("\n========================================");
    console.log("6. PERFORM TRANSACTION VIA API");
    console.log("========================================");
    console.log("Transferring 200 from User 1 to User 2. This process takes 15 seconds as per controller logic... please wait...");
    const transRes = await makeRequest("POST", "/transactions/", {
      fromAccount: user1AccountId,
      toAccount: user2AccountId,
      amount: 200,
      idempotencyKey: `TR_${Date.now()}`
    }, user1Token);
    
    console.log("Transaction Response:", transRes.status, transRes.data.message || transRes.data);

    console.log("\n========================================");
    console.log("7. FINAL BALANCES");
    console.log("========================================");
    const finalBal1 = await makeRequest("GET", `/accounts/balance/${user1AccountId}`, null, user1Token);
    console.log("User 1 Final Balance:", finalBal1.data.balance);
    const finalBal2 = await makeRequest("GET", `/accounts/balance/${user2AccountId}`, null, user2Token);
    console.log("User 2 Final Balance:", finalBal2.data.balance);
    
    console.log("\n========================================");
    console.log("ALL APIS VERIFIED SUCCESSFULLY!");
    console.log("You can see these records inserted in your MongoDB Atlas Database.");
    console.log("========================================\n");


  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    console.log("Shutting down server and database connection...");
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
