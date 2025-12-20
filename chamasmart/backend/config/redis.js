const Redis = require("ioredis");
require("dotenv").config();

let redis;

if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);

    redis.on("connect", () => {
        console.log("✅ Redis connected successfully");
    });

    redis.on("error", (err) => {
        console.error("❌ Redis connection error:", err);
    });
} else {
    console.warn("⚠️ REDIS_URL not found, falling back to in-memory cache (NodeCache)");
    // Fallback logic could go here, or we just export null/dummy
    const NodeCache = require("node-cache");
    const nodeCache = new NodeCache({ stdTTL: 300 });

    // Minimal wrapper to match some Redis behavior if needed
    redis = {
        get: async (key) => nodeCache.get(key),
        set: async (key, val, mode, ttl) => nodeCache.set(key, val, ttl),
        del: async (key) => nodeCache.del(key),
        quit: async () => true,
        isFallback: true
    };
}

module.exports = redis;
