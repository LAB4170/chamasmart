const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🚀 Starting security setup for ChamaSmart...");

// Create backup of existing server.js
const serverPath = path.join(__dirname, "../backend/server.js");
const backupPath = path.join(__dirname, "../backend/server.backup.js");

if (fs.existsSync(serverPath)) {
  console.log("🔒 Creating backup of existing server.js...");
  fs.copyFileSync(serverPath, backupPath);
  console.log("✅ Backup created at:", backupPath);
}

// Replace server.js with the new secure version
const newServerPath = path.join(__dirname, "../backend/server.new.js");
if (fs.existsSync(newServerPath)) {
  console.log("🔄 Updating server.js with secure configuration...");
  fs.renameSync(newServerPath, serverPath);
  console.log("✅ server.js updated successfully");
}

// Install required security dependencies
console.log("📦 Installing required security dependencies...");
try {
  const dependencies = [
    "helmet",
    "express-rate-limit",
    "rate-limiter-flexible",
    "ioredis",
    "express-mongo-sanitize",
    "xss-clean",
    "hpp",
    "joi",
  ];

  execSync(`cd backend && npm install --save ${dependencies.join(" ")}`, {
    stdio: "inherit",
  });
  console.log("✅ Security dependencies installed successfully");
} catch (error) {
  console.error("❌ Failed to install security dependencies:", error.message);
  process.exit(1);
}

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, "../.env");
if (!fs.existsSync(envPath)) {
  console.log("📝 Creating .env file with security configurations...");
  const envConfig = `# Security Configuration
NODE_ENV=development
PORT=5000

# JWT Configuration
JWT_SECRET=${require("crypto").randomBytes(64).toString("hex")}
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=1000
AUTH_RATE_LIMIT_MAX=10

# Redis Configuration (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password  # Uncomment in production

# Database Configuration
DATABASE_URL=postgres://username:password@localhost:5432/chamasmart

# Email Configuration (for password resets, etc.)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info

# Session Configuration
SESSION_SECRET=${require("crypto").randomBytes(64).toString("hex")}

# Security Headers
CONTENT_SECURITY_POLICY=default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';
X_FRAME_OPTIONS=DENY
X_CONTENT_TYPE_OPTIONS=nosniff
X_XSS_PROTECTION=1; mode=block
STRICT_TRANSPORT_SECURITY=max-age=31536000; includeSubDomains; preload

# Other Security Settings
REQUEST_SIZE_LIMIT=10kb
`;

  fs.writeFileSync(envPath, envConfig);
  console.log("✅ .env file created with default security configurations");
  console.log(
    "⚠️  Please review and update the .env file with your actual configuration"
  );
}

console.log("\n🎉 Security setup completed successfully!");
console.log("Next steps:");
console.log(
  "1. Review the .env file and update with your actual configuration"
);
console.log("2. Restart your server to apply the new security settings");
console.log(
  "3. Run security tests to verify everything is working as expected"
);
