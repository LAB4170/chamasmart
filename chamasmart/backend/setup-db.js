const pool = require("./config/db");
const fs = require("fs");

async function setupDatabase() {
  try {
    console.log("🔄 Setting up database tables...");

    // Read the SQL file
    const sql = fs.readFileSync("./database_schema.sql", "utf8");

    // Split into individual statements (basic approach)
    const statements = sql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement);
          console.log("✅ Executed:", statement.substring(0, 50) + "...");
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes("already exists")) {
            console.log("⚠️  Skipped:", statement.substring(0, 50) + "...");
          }
        }
      }
    }

    console.log("🎉 Database setup completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();
