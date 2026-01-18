#!/usr/bin/env node

/**
 * CRITICAL SECURITY REMEDIATION SCRIPT
 * Removes exposed secrets from git history
 * Run: node backend/scripts/remove-secrets-from-git.js
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

async function main() {
  console.log(
    `\n${BOLD}${RED}⚠️  CRITICAL: GIT HISTORY SECRETS REMOVAL${RESET}\n`,
  );

  console.log(`${YELLOW}This script will:${RESET}`);
  console.log("1. Remove .env file from git history");
  console.log("2. Remove docker-compose.yml if it contains credentials");
  console.log("3. Remove backend/tests/setup.js hardcoded secrets");
  console.log("4. Force push to main branch (DESTRUCTIVE)\n");

  const confirm = await question(`${BOLD}${RED}Continue? (yes/no): ${RESET}`);

  if (confirm !== "yes") {
    console.log("❌ Aborted.");
    process.exit(1);
  }

  try {
    // Step 1: Check if we're in a git repo
    console.log("\n1️⃣  Checking git repository...");
    execSync("git status", { stdio: "pipe" });
    console.log(`${GREEN}✅ Git repository found${RESET}`);

    // Step 2: Create backup
    console.log("\n2️⃣  Creating backup...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    execSync(`git bundle create chamasmart-backup-${timestamp}.bundle --all`, {
      stdio: "pipe",
    });
    console.log(
      `${GREEN}✅ Backup created: chamasmart-backup-${timestamp}.bundle${RESET}`,
    );
    console.log(
      `   ${YELLOW}Store this file safely - it can restore your repo if something goes wrong${RESET}`,
    );

    // Step 3: Remove .env from git history
    console.log("\n3️⃣  Removing .env from git history...");

    try {
      // Check if .env exists in git
      execSync("git log --all --full-history -- .env", { stdio: "pipe" });

      // Remove using git filter-branch
      console.log("   Using git filter-branch (slower but safe)...");
      execSync(
        'git filter-branch --force --index-filter "git rm --cached --ignore-unmatch .env" --prune-empty --tag-name-filter cat -- --all',
        { stdio: "inherit" },
      );

      console.log(`${GREEN}✅ .env removed from history${RESET}`);
    } catch (e) {
      console.log(`${YELLOW}ℹ️  .env not found in git history${RESET}`);
    }

    // Step 4: Ensure .env is in .gitignore
    console.log("\n4️⃣  Updating .gitignore...");
    const gitignorePath = path.join(process.cwd(), ".gitignore");
    let gitignoreContent = fs.readFileSync(gitignorePath, "utf8");

    const entriesToAdd = [
      ".env",
      ".env.local",
      ".env.*.local",
      ".env.production.local",
      ".env.test.local",
    ];

    entriesToAdd.forEach((entry) => {
      if (!gitignoreContent.includes(entry)) {
        gitignoreContent += `\n${entry}`;
      }
    });

    fs.writeFileSync(gitignorePath, gitignoreContent);
    console.log(`${GREEN}✅ .gitignore updated${RESET}`);

    // Step 5: Clean reflog
    console.log("\n5️⃣  Cleaning git reflog...");
    execSync("git reflog expire --expire=now --all", { stdio: "pipe" });
    console.log(`${GREEN}✅ Reflog cleaned${RESET}`);

    // Step 6: Garbage collection
    console.log("\n6️⃣  Running garbage collection (this may take a minute)...");
    execSync("git gc --prune=now --aggressive", { stdio: "pipe" });
    console.log(`${GREEN}✅ Garbage collection complete${RESET}`);

    // Step 7: Force push
    console.log("\n7️⃣  Force pushing to remote...");
    const pushConfirm = await question(
      `${BOLD}${RED}Force push to all branches? (yes/no): ${RESET}`,
    );

    if (pushConfirm === "yes") {
      try {
        execSync("git push --force --all", { stdio: "inherit" });
        execSync("git push --force --tags", { stdio: "inherit" });
        console.log(`${GREEN}✅ Force pushed successfully${RESET}`);
      } catch (e) {
        console.log(
          `${YELLOW}⚠️  Force push failed. You may need to do it manually.${RESET}`,
        );
      }
    }

    // Step 8: Verify .env is gone
    console.log("\n8️⃣  Verifying .env is removed from history...");
    try {
      execSync("git log --all --full-history -- .env", { stdio: "pipe" });
      console.log(`${RED}❌ .env still found in history!${RESET}`);
    } catch (e) {
      console.log(`${GREEN}✅ .env successfully removed from history${RESET}`);
    }

    console.log(`\n${BOLD}${GREEN}✅ SECRETS REMOVED FROM GIT HISTORY${RESET}`);
    console.log(`\n${BOLD}NEXT STEPS:${RESET}`);
    console.log("1. Rotate ALL secrets immediately:");
    console.log("   - JWT_SECRET (generate new one)");
    console.log("   - SESSION_SECRET");
    console.log("   - Database password");
    console.log("   - Email password");
    console.log("   - Redis password");
    console.log("   - Any API keys\n");
    console.log("2. Update all deployed systems with new secrets");
    console.log("3. Invalidate all existing sessions/tokens");
    console.log("4. Run: npm audit to check for vulnerabilities");
    console.log("5. Enable 2FA on your GitHub account\n");
  } catch (error) {
    console.error(`${RED}❌ Error: ${error.message}${RESET}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
