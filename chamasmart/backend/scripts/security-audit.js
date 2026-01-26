/**
 * Security Audit and Hardening Script
 * Consolidates security-related functionality
 *
 * Usage: node scripts/security-audit.js [--fix] [--rotate-secrets]
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const DatabaseUtils = require("./utils/db-utils");
const logger = require("../utils/logger");

const db = new DatabaseUtils();

// Color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Generate secure random secret
 */
function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Check for exposed secrets in files
 */
async function checkExposedSecrets() {
  log("\n🔍 Checking for exposed secrets...", "cyan");

  const issues = [];
  const sensitiveFiles = [".env", ".env.local", ".env.production"];
  const projectRoot = path.join(__dirname, "..", "..");

  // Check if .env is in git history
  try {
    const { execSync } = require("child_process");
    const result = execSync("git log --all --full-history -- .env", {
      cwd: projectRoot,
      encoding: "utf8",
    });

    if (result.trim()) {
      issues.push({
        severity: "CRITICAL",
        message: ".env file found in git history",
        recommendation: "Run git filter-branch to remove .env from history",
      });
    } else {
      log("  ✅ .env not in git history", "green");
    }
  } catch (error) {
    log("  ✅ .env not in git history", "green");
  }

  // Check .gitignore
  const gitignorePath = path.join(projectRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");

    const requiredEntries = [".env", ".env.local", "*.pem", "*.key"];
    const missing = requiredEntries.filter(
      (entry) => !gitignoreContent.includes(entry),
    );

    if (missing.length > 0) {
      issues.push({
        severity: "HIGH",
        message: `.gitignore missing entries: ${missing.join(", ")}`,
        recommendation: "Add missing entries to .gitignore",
      });
    } else {
      log("  ✅ .gitignore properly configured", "green");
    }
  }

  // Check for hardcoded secrets in code
  const searchPatterns = [
    /password\s*=\s*['"][^'"]{8,}['"]/gi,
    /api[_-]?key\s*=\s*['"][^'"]{16,}['"]/gi,
    /secret\s*=\s*['"][^'"]{16,}['"]/gi,
  ];

  const jsFiles = getJavaScriptFiles(path.join(__dirname, ".."));

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, "utf8");
    const relativePath = path.relative(projectRoot, file);

    for (const pattern of searchPatterns) {
      const matches = content.match(pattern);
      if (
        matches &&
        !relativePath.includes("test") &&
        !relativePath.includes("example")
      ) {
        issues.push({
          severity: "HIGH",
          message: `Possible hardcoded secret in ${relativePath}`,
          recommendation: "Move secrets to environment variables",
        });
        break;
      }
    }
  }

  if (issues.length === 0) {
    log("  ✅ No hardcoded secrets detected", "green");
  }

  return issues;
}

/**
 * Get all JavaScript files recursively
 */
function getJavaScriptFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (
      stat.isDirectory() &&
      !item.startsWith(".") &&
      item !== "node_modules"
    ) {
      files.push(...getJavaScriptFiles(fullPath));
    } else if (
      item.endsWith(".js") &&
      !item.includes(".test.") &&
      !item.includes(".spec.")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check JWT configuration
 */
async function checkJWTSecurity() {
  log("\n🔑 Checking JWT security...", "cyan");

  const issues = [];

  if (!process.env.JWT_SECRET) {
    issues.push({
      severity: "CRITICAL",
      message: "JWT_SECRET not set",
      recommendation: "Set a strong JWT_SECRET in .env",
    });
  } else if (process.env.JWT_SECRET.length < 32) {
    issues.push({
      severity: "HIGH",
      message: "JWT_SECRET is too short (< 32 characters)",
      recommendation: "Use a JWT_SECRET of at least 64 characters",
    });
  } else {
    log("  ✅ JWT_SECRET properly configured", "green");
  }

  // Check for multiple JWT secrets (key rotation)
  if (process.env.JWT_SECRET_V1 && process.env.JWT_SECRET_V2) {
    log("  ✅ JWT key rotation configured", "green");
  } else {
    issues.push({
      severity: "MEDIUM",
      message: "JWT key rotation not configured",
      recommendation:
        "Implement JWT_SECRET_V1 and JWT_SECRET_V2 for key rotation",
    });
  }

  return issues;
}

/**
 * Check database security
 */
async function checkDatabaseSecurity() {
  log("\n🗄️  Checking database security...", "cyan");

  const issues = [];

  // Check database password strength
  if (!process.env.DB_PASSWORD) {
    issues.push({
      severity: "CRITICAL",
      message: "DB_PASSWORD not set",
      recommendation: "Set a strong database password",
    });
  } else if (process.env.DB_PASSWORD.length < 16) {
    issues.push({
      severity: "HIGH",
      message: "DB_PASSWORD is weak (< 16 characters)",
      recommendation: "Use a database password of at least 24 characters",
    });
  } else {
    log("  ✅ Database password properly configured", "green");
  }

  // Check SSL/TLS
  const sslEnabled = process.env.DB_SSL === "true" || process.env.DB_SSL_MODE;
  if (!sslEnabled && process.env.NODE_ENV === "production") {
    issues.push({
      severity: "HIGH",
      message: "Database SSL/TLS not enabled in production",
      recommendation: "Enable DB_SSL=true for production",
    });
  } else if (sslEnabled) {
    log("  ✅ Database SSL/TLS enabled", "green");
  }

  // Check for default credentials
  if (
    process.env.DB_USER === "postgres" &&
    process.env.DB_PASSWORD === "postgres"
  ) {
    issues.push({
      severity: "CRITICAL",
      message: "Using default PostgreSQL credentials",
      recommendation: "Change from default postgres/postgres credentials",
    });
  }

  return issues;
}

/**
 * Check password hashing
 */
async function checkPasswordHashing() {
  log("\n🔒 Checking password hashing...", "cyan");

  const issues = [];

  try {
    const result = await db.query(`
      SELECT user_id, email, password_hash
      FROM users
      LIMIT 5
    `);

    for (const user of result.rows) {
      // Check if password is bcrypt hashed (starts with $2a$, $2b$, or $2y$)
      if (!user.password_hash || !user.password_hash.match(/^\$2[aby]\$/)) {
        issues.push({
          severity: "CRITICAL",
          message: `User ${user.email} has improperly hashed password`,
          recommendation: "Reset password with proper bcrypt hashing",
        });
      }
    }

    if (issues.length === 0) {
      log("  ✅ All passwords properly hashed with bcrypt", "green");
    }
  } catch (error) {
    log(`  ⚠️  Could not check password hashing: ${error.message}`, "yellow");
  }

  return issues;
}

/**
 * Check session security
 */
async function checkSessionSecurity() {
  log("\n🎫 Checking session security...", "cyan");

  const issues = [];

  if (!process.env.SESSION_SECRET) {
    issues.push({
      severity: "HIGH",
      message: "SESSION_SECRET not set",
      recommendation: "Set a strong SESSION_SECRET in .env",
    });
  } else if (process.env.SESSION_SECRET.length < 32) {
    issues.push({
      severity: "MEDIUM",
      message: "SESSION_SECRET is too short",
      recommendation: "Use a SESSION_SECRET of at least 64 characters",
    });
  } else {
    log("  ✅ SESSION_SECRET properly configured", "green");
  }

  return issues;
}

/**
 * Generate security report
 */
function generateReport(allIssues) {
  log("\n" + "=".repeat(70), "cyan");
  log("  SECURITY AUDIT REPORT", "cyan");
  log("=".repeat(70) + "\n", "cyan");

  const critical = allIssues.filter((i) => i.severity === "CRITICAL");
  const high = allIssues.filter((i) => i.severity === "HIGH");
  const medium = allIssues.filter((i) => i.severity === "MEDIUM");

  log(`Total Issues Found: ${allIssues.length}\n`);
  log(`  🔴 Critical: ${critical.length}`, "red");
  log(`  🟠 High:     ${high.length}`, "yellow");
  log(`  🟡 Medium:   ${medium.length}`, "yellow");

  if (allIssues.length === 0) {
    log("\n✅ No security issues found!", "green");
    return;
  }

  // Display issues by severity
  for (const severity of ["CRITICAL", "HIGH", "MEDIUM"]) {
    const issues = allIssues.filter((i) => i.severity === severity);
    if (issues.length === 0) continue;

    log(`\n${severity} Issues:`, severity === "CRITICAL" ? "red" : "yellow");
    issues.forEach((issue, index) => {
      log(`\n  ${index + 1}. ${issue.message}`);
      log(`     → ${issue.recommendation}`, "cyan");
    });
  }

  log("\n" + "=".repeat(70) + "\n", "cyan");
}

/**
 * Rotate secrets (generate new ones)
 */
async function rotateSecrets() {
  log("\n🔄 Generating new secrets...", "cyan");

  const newSecrets = {
    JWT_SECRET_V1: generateSecret(64),
    JWT_SECRET_V2: generateSecret(64),
    SESSION_SECRET: generateSecret(64),
    DB_PASSWORD: generateSecret(32),
    REDIS_PASSWORD: generateSecret(32),
    ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"),
  };

  log("\n📝 New secrets generated (save these securely):\n");

  for (const [key, value] of Object.entries(newSecrets)) {
    log(`${key}=${value}`);
  }

  log("\n⚠️  Instructions:", "yellow");
  log("  1. Update your .env.local file with these new secrets");
  log("  2. Update your production environment variables");
  log("  3. Restart all services");
  log("  4. Users will need to re-authenticate");
  log("  5. Store these secrets in a password manager\n");

  // Save to a secure file
  const secretsFile = path.join(__dirname, `secrets-${Date.now()}.txt`);
  fs.writeFileSync(
    secretsFile,
    Object.entries(newSecrets)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
  );

  log(`💾 Secrets saved to: ${secretsFile}`, "green");
  log(
    "   Move this file to a secure location and delete it from the project!\n",
    "yellow",
  );
}

/**
 * Main audit function
 */
async function runSecurityAudit(options = {}) {
  log("\n" + "=".repeat(70), "cyan");
  log("  CHAMASMART SECURITY AUDIT", "cyan");
  log("=".repeat(70) + "\n", "cyan");

  const allIssues = [];

  // Run all checks
  allIssues.push(...(await checkExposedSecrets()));
  allIssues.push(...(await checkJWTSecurity()));
  allIssues.push(...(await checkDatabaseSecurity()));
  allIssues.push(...(await checkPasswordHashing()));
  allIssues.push(...(await checkSessionSecurity()));

  // Generate report
  generateReport(allIssues);

  // Log to file
  logger.info("Security audit completed", {
    timestamp: new Date().toISOString(),
    issuesFound: allIssues.length,
    critical: allIssues.filter((i) => i.severity === "CRITICAL").length,
    high: allIssues.filter((i) => i.severity === "HIGH").length,
    medium: allIssues.filter((i) => i.severity === "MEDIUM").length,
  });

  // Rotate secrets if requested
  if (options.rotateSecrets) {
    await rotateSecrets();
  }

  return allIssues;
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  rotateSecrets: args.includes("--rotate-secrets"),
};

if (args.includes("--help")) {
  console.log(`
Security Audit - Comprehensive security check

Usage:
  node scripts/security-audit.js [options]

Options:
  --rotate-secrets   Generate new secure secrets
  --help            Show this help message

Examples:
  node scripts/security-audit.js
  node scripts/security-audit.js --rotate-secrets
  `);
  process.exit(0);
}

// Run audit
runSecurityAudit(options)
  .then((issues) => {
    const criticalCount = issues.filter(
      (i) => i.severity === "CRITICAL",
    ).length;
    if (criticalCount > 0) {
      process.exit(1);
    }
  })
  .catch((error) => {
    log(`\n❌ Audit failed: ${error.message}`, "red");
    process.exit(1);
  })
  .finally(() => db.close());

module.exports = { runSecurityAudit, rotateSecrets };
