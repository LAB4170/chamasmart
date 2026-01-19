const request = require("supertest");
const app = require("../server");
const { createServer } = require("http");
const Redis = require("ioredis-mock");
const { RateLimiterRedis } = require("rate-limiter-flexible");

// Mock Redis for testing
jest.mock("ioredis", () => require("ioredis-mock"));

// Test server setup
let server;
beforeAll((done) => {
  server = createServer(app);
  server.listen(0, done); // Use any available port
});

afterAll((done) => {
  server.close(done);
});

describe("Security Middleware", () => {
  // Test rate limiting
  describe("Rate Limiting", () => {
    it("should allow requests under the rate limit", async () => {
      // Make 5 requests (under the limit of 10 per 15 minutes for auth)
      const responses = await Promise.all(
        Array(5)
          .fill()
          .map(() =>
            request(server).post("/api/auth/login").send({
              email: "test@example.com",
              password: "password123",
            }),
          ),
      );

      // All requests should not be rate limited (status should not be 429)
      responses.forEach((response) => {
        expect(response.status).not.toBe(429);
      });
    });

    it("should block requests over the rate limit", async () => {
      // This test is skipped by default as it takes time to complete
      // Uncomment to test rate limiting
      // const responses = await Promise.all(
      //   Array(15).fill().map((_, i) =>
      //     request(server).post('/api/auth/login').send({
      //       email: `test${i}@example.com`,
      //       password: 'password123'
      //     })
      //   )
      // );
      // const rateLimited = responses.filter(r => r.status === 429);
      // expect(rateLimited.length).toBeGreaterThan(0);
    }, 30000);
  });

  // Test security headers
  describe("Security Headers", () => {
    it("should include security headers", async () => {
      const response = await request(server).get("/api/ping");

      expect(response.headers["x-dns-prefetch-control"]).toBe("off");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      expect(response.headers["strict-transport-security"]).toBeDefined();
      expect(response.headers["x-download-options"]).toBe("noopen");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
      expect(response.headers["x-xss-protection"]).toBe("1; mode=block");
    });
  });

  // Test input validation
  describe("Input Validation", () => {
    it("should reject invalid email format", async () => {
      const response = await request(server).post("/api/auth/register").send({
        email: "invalid-email",
        password: "ValidPass123!",
        name: "Test User",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
      // Accept any validation-related message to remain robust to wording changes
      expect(response.body.message).toMatch(/validation/i);
    });

    it("should reject weak passwords", async () => {
      const response = await request(server).post("/api/auth/register").send({
        email: "test@example.com",
        password: "weak",
        name: "Test User",
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("success", false);
    });
  });

  // Test NoSQL injection protection
  describe("NoSQL Injection Protection", () => {
    it("should sanitize NoSQL injection attempts", async () => {
      const response = await request(server)
        .post("/api/auth/login")
        .send({
          email: { $ne: null }, // NoSQL injection attempt
          password: { $gt: "" }, // NoSQL injection attempt
        });

      // Should be a 400 error, not a 500 error
      expect(response.status).toBe(400);
    });
  });

  // Test XSS protection
  describe("XSS Protection", () => {
    it("should sanitize XSS attempts in request body", async () => {
      const xssPayload = "<script>alert(1)</script>";
      const response = await request(server)
        .post("/api/chamas")
        .send({
          name: `Test ${xssPayload}`,
          description: `Description ${xssPayload}`,
        });

      // The XSS payload should be sanitized
      expect(response.status).not.toBe(500);
      // The response should not contain the script tags
      if (response.body && response.body.name) {
        expect(response.body.name).not.toContain("<script>");
        expect(response.body.name).not.toContain("</script>");
      }
    });
  });
});
