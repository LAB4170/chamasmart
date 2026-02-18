#!/usr/bin/env node

/**
 * 🔒 Security Monitoring Script for ChamaSmart
 *
 * This script monitors for potential security issues and sends alerts
 * Run it as a cron job or background process
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SecurityMonitor {
  constructor() {
    this.alerts = [];
    this.logFile = path.join(__dirname, '../logs/security-monitor.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }

  async checkEnvironmentSecurity() {
    this.log('🔍 Checking environment security...');

    // Check if .env is properly secured
    const envPath = path.join(__dirname, '../.env');
    const gitignorePath = path.join(__dirname, '../.gitignore');

    if (fs.existsSync(envPath)) {
      const envStats = fs.statSync(envPath);
      const envPerms = (envStats.mode & 0o777).toString(8);

      if (envPerms !== '600') {
        this.alerts.push({
          type: 'CRITICAL',
          message: `.env file has insecure permissions: ${envPerms} (should be 600)`,
          fix: 'Run: chmod 600 .env',
        });
      }
    }

    // Check .gitignore
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignore.includes('.env')) {
        this.alerts.push({
          type: 'HIGH',
          message: '.env is not in .gitignore',
          fix: 'Add .env to .gitignore immediately',
        });
      }
    }

    // Check for hardcoded secrets in code
    await this.checkForHardcodedSecrets();
  }

  async checkForHardcodedSecrets() {
    const searchDirs = ['controllers', 'routes', 'middleware', 'utils', 'config'];
    const suspiciousPatterns = [
      /password\s*=\s*['"][^'"]{1,20}['"]/, // Short passwords
      /secret\s*=\s*['"][^'"]{1,20}['"]/, // Short secrets
      /api_key\s*=\s*['"][^'"]{1,20}['"]/, // Short API keys
      /token\s*=\s*['"][^'"]{1,20}['"]/, // Short tokens
    ];

    for (const dir of searchDirs) {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = this.getAllFiles(dirPath);

      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(file, 'utf8');

          for (const pattern of suspiciousPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              this.alerts.push({
                type: 'MEDIUM',
                message: `Potential hardcoded secret in ${path.relative(process.cwd(), file)}: ${matches[0]}`,
                fix: 'Move secret to environment variables',
              });
            }
          }
        }
      }
    }
  }

  getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });

    return arrayOfFiles;
  }

  checkDatabaseSecurity() {
    this.log('🔍 Checking database security...');

    // Check if using secure database configuration
    const secureDbPath = path.join(__dirname, '../config/secure-db.js');
    if (!fs.existsSync(secureDbPath)) {
      this.alerts.push({
        type: 'HIGH',
        message: 'Secure database configuration not found',
        fix: 'Implement secure-db.js with connection monitoring',
      });
    }

    // Check for database connection monitoring
    const dbPath = path.join(__dirname, '../config/db.js');
    if (fs.existsSync(dbPath)) {
      const dbContent = fs.readFileSync(dbPath, 'utf8');
      if (!dbContent.includes('on(\'connect\'') && !dbContent.includes('on(\'error\'')) {
        this.alerts.push({
          type: 'MEDIUM',
          message: 'Database connection monitoring not implemented',
          fix: 'Add connection monitoring to database configuration',
        });
      }
    }
  }

  checkJWTSecurity() {
    this.log('🔍 Checking JWT security...');

    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      if (jwtSecret.length < 32) {
        this.alerts.push({
          type: 'CRITICAL',
          message: `JWT_SECRET is too short: ${jwtSecret.length} characters (minimum 32 required)`,
          fix: 'Generate a longer JWT secret using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
        });
      }

      if (jwtSecret.includes('your_') || jwtSecret.includes('change_this')) {
        this.alerts.push({
          type: 'CRITICAL',
          message: 'JWT_SECRET appears to be a default placeholder',
          fix: 'Generate a new secure JWT secret immediately',
        });
      }
    } else {
      this.alerts.push({
        type: 'CRITICAL',
        message: 'JWT_SECRET is not set',
        fix: 'Set JWT_SECRET in environment variables',
      });
    }
  }

  checkFilePermissions() {
    this.log('🔍 Checking file permissions...');

    const sensitiveFiles = [
      '../.env',
      '../config/secure-db.js',
      '../config/env-config.js',
    ];

    for (const file of sensitiveFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const perms = (stats.mode & 0o777).toString(8);

        if (perms !== '600' && perms !== '644') {
          this.alerts.push({
            type: 'MEDIUM',
            message: `${file} has potentially insecure permissions: ${perms}`,
            fix: `Run: chmod 600 ${file}`,
          });
        }
      }
    }
  }

  async sendAlerts() {
    if (this.alerts.length === 0) {
      this.log('✅ No security issues found');
      return;
    }

    this.log(`🚨 Found ${this.alerts.length} security issues:`);

    // Group alerts by severity
    const grouped = this.alerts.reduce((acc, alert) => {
      if (!acc[alert.type]) acc[alert.type] = [];
      acc[alert.type].push(alert);
      return acc;
    }, {});

    // Display alerts
    for (const [severity, alerts] of Object.entries(grouped)) {
      this.log(`\n${severity} Priority:`, severity);
      alerts.forEach(alert => {
        this.log(`  • ${alert.message}`, 'ALERT');
        this.log(`    Fix: ${alert.fix}`, 'INFO');
      });
    }

    // Send webhook if configured
    if (process.env.SECURITY_WEBHOOK) {
      try {
        await fetch(process.env.SECURITY_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'ChamaSmart Security Monitor',
            timestamp: new Date().toISOString(),
            alerts: this.alerts,
            summary: {
              total: this.alerts.length,
              critical: grouped.CRITICAL?.length || 0,
              high: grouped.HIGH?.length || 0,
              medium: grouped.MEDIUM?.length || 0,
            },
          }),
        });
        this.log('📡 Security alerts sent to webhook');
      } catch (error) {
        this.log(`Failed to send webhook: ${error.message}`, 'ERROR');
      }
    }
  }

  async run() {
    this.log('🚀 Starting ChamaSmart Security Monitor...');

    try {
      await this.checkEnvironmentSecurity();
      this.checkDatabaseSecurity();
      this.checkJWTSecurity();
      this.checkFilePermissions();

      await this.sendAlerts();

      this.log('✅ Security monitoring complete');

      // Exit with error code if critical issues found
      const criticalIssues = this.alerts.filter(a => a.type === 'CRITICAL');
      if (criticalIssues.length > 0) {
        process.exit(1);
      }
    } catch (error) {
      this.log(`Security monitor error: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }
}

// Run the monitor if called directly
if (require.main === module) {
  const monitor = new SecurityMonitor();
  monitor.run();
}

module.exports = SecurityMonitor;
