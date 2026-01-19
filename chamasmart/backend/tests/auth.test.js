jest.mock("../config/db");
const request = require("supertest");
const app = require("../server");
const db = require("../config/db");

describe("Authentication API", () => {
  beforeEach(() => {
    db.__mockQuery.mockReset();
    db.__mockClientQuery.mockReset();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const email = `test${Date.now()}@example.com`;

      db.__mockQuery.mockImplementation(async (text, values) => {
        // Duplicate check - user doesn't exist
        if (
          text.includes(
            "SELECT * FROM users WHERE email = $1 OR phone_number = $2",
          )
        ) {
          return { rows: [], rowCount: 0 };
        }
        // Insert user
        if (text.includes("INSERT INTO users")) {
          return {
            rows: [
              {
                user_id: 1001,
                email: values[0],
                first_name: values[2],
                last_name: values[3],
                phone_number: values[4],
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        // Update email verification
        if (
          text.includes("UPDATE users") &&
          text.includes("email_verification_token")
        ) {
          return { rowCount: 1 };
        }
        // Update phone verification
        if (
          text.includes("UPDATE users") &&
          text.includes("phone_verification_code")
        ) {
          return { rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const res = await request(app).post("/api/auth/register").send({
        email,
        password: "Test123!@#",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "0712345678",
      });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data).toHaveProperty("token");
      expect(res.body.data).toHaveProperty("user");
    });

    it("should reject registration with missing fields", async () => {
      const res = await request(app).post("/api/auth/register").send({
        email: "test@example.com",
        // Missing password
      });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("success", false);
    });

    it("should reject duplicate email", async () => {
      const email = `duplicate${Date.now()}@example.com`;

      db.__mockQuery.mockImplementation(async (text, values) => {
        // User already exists
        if (
          text.includes(
            "SELECT * FROM users WHERE email = $1 OR phone_number = $2",
          )
        ) {
          return {
            rows: [{ user_id: 1, email }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      // First registration (will find duplicate)
      const res = await request(app).post("/api/auth/register").send({
        email,
        password: "Test123!@#",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "0712345678",
      });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("already exists");
    });
  });

  describe("POST /api/auth/login", () => {
    let testUser;

    beforeAll(async () => {
      // Create test user in mock
      db.__mockQuery.mockImplementation(async (text, values) => {
        // Check if user exists
        if (text.includes("SELECT * FROM users WHERE email = $1")) {
          return {
            rows: [
              {
                user_id: 1002,
                email: `logintest${Date.now()}@example.com`,
                password_hash:
                  "$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901", // bcrypt hash of 'Test123!@#'
                first_name: "Login",
                last_name: "Test",
                phone_number: "0712345678",
                created_at: new Date(),
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      testUser = {
        email: `logintest${Date.now()}@example.com`,
      };
    });

    it("should login with correct credentials", async () => {
      db.__mockQuery.mockImplementation(async (text, values) => {
        if (text.includes("SELECT * FROM users WHERE email = $1")) {
          return {
            rows: [
              {
                user_id: 1002,
                email: testUser.email,
                password_hash:
                  "$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901", // bcrypt hash of 'Test123!@#'
                first_name: "Login",
                last_name: "Test",
                phone_number: "0712345678",
                email_verified: true,
                phone_verified: true,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      // Mock bcrypt.compare to return true for password match
      const bcrypt = require("bcryptjs");
      jest.spyOn(bcrypt, "compare").mockResolvedValueOnce(true);

      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "Test123!@#",
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data).toHaveProperty("token");

      bcrypt.compare.mockRestore();
    });

    it("should reject login with wrong password", async () => {
      db.__mockQuery.mockImplementation(async (text, values) => {
        if (text.includes("SELECT * FROM users WHERE email = $1")) {
          return {
            rows: [
              {
                user_id: 1002,
                email: testUser.email,
                password_hash:
                  "$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901",
                first_name: "Login",
                last_name: "Test",
                phone_number: "0712345678",
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      });

      // Mock bcrypt.compare to return false for wrong password
      const bcrypt = require("bcryptjs");
      jest.spyOn(bcrypt, "compare").mockResolvedValueOnce(false);

      const res = await request(app).post("/api/auth/login").send({
        email: testUser.email,
        password: "WrongPassword",
      });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty("success", false);

      bcrypt.compare.mockRestore();
    });

    it("should reject login with non-existent email", async () => {
      db.__mockQuery.mockImplementation(async (text, values) => {
        // User doesn't exist
        return { rows: [], rowCount: 0 };
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "Test123!@#",
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

describe("Health Check API", () => {
  it("should return health status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("message", "OK");
  });
});
