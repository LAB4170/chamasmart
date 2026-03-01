const deps = [
  "./utils/logger",
  "./middleware/enhancedRequestLogger",
  "./config/cors",
  "./middleware/metrics",
  "./middleware/security",
  "./utils/responseFormatter",
  "./middleware/queryValidation",
  "./config/db",
  "./security/enhancedRateLimiting",
  "./routes/auth",
  "./routes/authV2",
  "./routes/chamas",
  "./routes/members",
  "./routes/contributions",
  "./routes/meetings",
  "./routes/invites",
  "./routes/loans",
  "./routes/payouts",
  "./routes/roscaRoutes",
  "./routes/users",
  "./routes/asca",
  "./routes/joinRequests",
  "./routes/notifications",
  "./routes/welfareRoutes",
  "./routes/dividendRoutes",
  "./routes/reportRoutes",
  "./socket",
  "./utils/healthCheck",
  "./utils/scheduler"
];

for (const dep of deps) {
  try {
    require(dep);
    console.log(`✅ Loaded ${dep}`);
  } catch (err) {
    console.log(`❌ Failed to load ${dep}: ${err.message}`);
    if (err.stack && err.stack.includes('internal/modules/cjs/loader.js')) {
      // It's a module not found error
    } else {
       console.log(err.stack);
    }
  }
}
