import { jest } from "@jest/globals";
import {
  mockRequest,
  mockResponse,
  mockNext,
  createTestUser,
} from "../utils/test-utils.js";

// Mock the auth service
jest.mock("../../services/auth.service.js", () => ({
  login: jest.fn(),
  register: jest.fn(),
  refreshToken: jest.fn(),
  logout: jest.fn(),
}));

// Import the controller after mocking dependencies
import * as authController from "../../controllers/auth.controller.js";
import * as authService from "../../services/auth.service.js";

describe("Auth Controller", () => {
  describe("register", () => {
    it("should register a new user successfully", async () => {
      const req = mockRequest({
        email: "test@example.com",
        password: "password123",
        first_name: "Test",
        last_name: "User",
        phone: "+254700000000",
      });

      const res = mockResponse();
      const testUser = createTestUser();

      // Mock the service response
      authService.register.mockResolvedValue({
        user: testUser,
        token: "test-token",
        refreshToken: "refresh-token",
      });

      await authController.register(req, res, mockNext);

      expect(authService.register).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
        first_name: "Test",
        last_name: "User",
        phone: "+254700000000",
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.any(Object),
          token: "test-token",
          refreshToken: "refresh-token",
        },
      });
    });

    it("should handle validation errors", async () => {
      const req = mockRequest({
        // Missing required fields
        email: "invalid-email",
        password: "123",
      });

      const res = mockResponse();

      await authController.register(req, res, mockNext);

      // Should call next with an error
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });
  });

  describe("login", () => {
    it("should login a user successfully", async () => {
      const req = mockRequest({
        email: "test@example.com",
        password: "password123",
      });

      const res = mockResponse();
      const testUser = createTestUser();

      // Mock the service response
      authService.login.mockResolvedValue({
        user: testUser,
        token: "test-token",
        refreshToken: "refresh-token",
      });

      await authController.login(req, res, mockNext);

      expect(authService.login).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.any(Object),
          token: "test-token",
          refreshToken: "refresh-token",
        },
      });
    });
  });

  // Add more test cases for other auth controller methods
});
