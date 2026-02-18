import React from "react";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";

jest.mock("../services/api", () => ({
  authAPI: {
    register: jest.fn(),
    login: jest.fn(),
    getMe: jest.fn(),
    verifyEmail: jest.fn(),
    verifyPhone: jest.fn(),
  },
}));

describe("AuthContext verification helpers", () => {
  const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test("register returns user and token", async () => {
    authAPI.register.mockResolvedValueOnce({
      data: {
        data: {
          user: { id: 1, email: "test@example.com" },
          token: "jwt-token",
        },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.register({
        email: "test@example.com",
        password: "Password1",
        firstName: "Test",
        lastName: "User",
        phoneNumber: "0712345678",
      });
    });

    expect(response.success).toBe(true);
    expect(response.user).toEqual({ id: 1, email: "test@example.com" });
    expect(response.token).toBe("jwt-token");
    expect(localStorage.getItem("token")).toBe("jwt-token");
  });

  test("verifyEmail delegates to authAPI and returns message", async () => {
    authAPI.verifyEmail.mockResolvedValueOnce({
      data: { message: "Email verified" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.verifyEmail("abc123");
    });

    expect(authAPI.verifyEmail).toHaveBeenCalledWith({ token: "abc123" });
    expect(response).toEqual({ success: true, message: "Email verified" });
  });

  test("verifyPhone updates user state on success", async () => {
    authAPI.verifyPhone.mockResolvedValueOnce({
      data: { message: "Phone verified" },
    });

    // Seed user in localStorage so AuthProvider picks it up
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, phoneVerified: false })
    );
    localStorage.setItem("token", "jwt-token");

    const { result } = renderHook(() => useAuth(), { wrapper });

    let response;
    await act(async () => {
      response = await result.current.verifyPhone("123456");
    });

    expect(authAPI.verifyPhone).toHaveBeenCalledWith({ code: "123456" });
    expect(response).toEqual({ success: true, message: "Phone verified" });

    const updatedUser = JSON.parse(localStorage.getItem("user"));
    expect(updatedUser.phoneVerified).toBe(true);
  });
});
