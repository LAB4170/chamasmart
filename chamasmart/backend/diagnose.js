require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function diagnose() {
    console.log("--- Starting Diagnostics ---");

    // Check Env Vars
    console.log("Checking Environment Variables:");
    const requiredVars = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PASSWORD", "DB_PORT", "JWT_SECRET"];
    let envOk = true;
    requiredVars.forEach((v) => {
        if (process.env[v]) {
            console.log(`✅ ${v} is set`);
        } else {
            console.error(`❌ ${v} is MISSING`);
            envOk = false;
        }
    });

    if (!envOk) {
        console.error("Critical environment variables missing. Aborting DB check.");
        process.exit(1);
    }

    // Check BCrypt
    try {
        console.log("Testing BCrypt...");
        await bcrypt.hash("test", 10);
        console.log("✅ BCrypt working");
    } catch (e) {
        console.error("❌ BCrypt failed:", e.message);
    }

    // Check JWT
    try {
        console.log("Testing JWT...");
        jwt.sign({ id: 1 }, process.env.JWT_SECRET);
        console.log("✅ JWT working");
    } catch (e) {
        console.error("❌ JWT failed:", e.message);
    }

    // Check DB
    try {
        console.log("Connecting to Database...");
        await pool.query("SELECT NOW()");
        console.log("✅ Database Connected");

        console.log("Checking 'users' table...");
        const tableRes = await pool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
        );
        if (tableRes.rows.length > 0) {
            console.log("✅ 'users' table exists");

            const colRes = await pool.query(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
            );
            const columns = colRes.rows.map(r => r.column_name);
            console.log("Columns:", columns.join(", "));

            const requiredCols = ["email", "password_hash", "first_name", "last_name", "phone_number"];
            const missingCols = requiredCols.filter(c => !columns.includes(c));

            if (missingCols.length === 0) {
                console.log("✅ All required columns present");
            } else {
                console.error("❌ Missing columns:", missingCols.join(", "));
            }

        } else {
            console.error("❌ 'users' table DOES NOT exist");
        }

    } catch (e) {
        console.error("❌ Database Error:", e.message);
    } finally {
        pool.end();
    }
}

diagnose();
