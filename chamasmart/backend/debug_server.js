const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const fs = require("fs");
require("dotenv").config();

console.log("DEBUG: Modules loaded");

const logger = require("./utils/logger");
const { requestLogger } = require("./middleware/requestLogger");
const { corsOptions } = require("./config/cors");
const { metricsMiddleware, healthCheckEndpoint, metricsEndpoint, readinessCheckEndpoint } = require("./middleware/metrics");
// const { securityMiddleware } = require("./middleware/security");

console.log("DEBUG: Config/Middleware loaded");

require("./config/db");
console.log("DEBUG: DB required");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

console.log("DEBUG: App/Server created");

// securityMiddleware(app);

app.use(express.json());
app.use(metricsMiddleware);

console.log("DEBUG: Basic middleware applied");

app.use("/api/auth", require("./routes/auth"));
console.log("DEBUG: Auth route loaded");

app.get("/health", (req, res) => res.json({ status: "OK" }));

console.log(`DEBUG: Attempting to listen on port ${PORT}...`);
server.listen(PORT, () => {
    console.log(`DEBUG: Server IS LISTENING on port ${PORT}`);
});

process.on("uncaughtException", (err) => {
    console.error("DEBUG: UNCAUGHT EXCEPTION", err);
});

process.on("unhandledRejection", (reason) => {
    console.error("DEBUG: UNHANDLED REJECTION", reason);
});
