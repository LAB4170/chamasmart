import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";

vi.mock("../services/api", () => ({
  authAPI: {
    login: vi.fn(),
    logout: vi.fn(() => Promise.resolve()),
    register: vi.fn(),
    firebaseSync: vi.fn(),
    verifyEmail: vi.fn(),
    verifyPhone: vi.fn(),
    getMe: vi.fn(),
  },
}));
vi.mock("../config/firebase", () => ({ auth: {}, googleProvider: {} }));
vi.mock("firebase/auth", () => ({
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(() => Promise.resolve(null)),
}));

import { AuthProvider, useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("login stores the tokens and user", async () => {
    authAPI.login.mockResolvedValueOnce({
      data: { data: { user: { userId: 3, email: "a@b.co" }, tokens: { accessToken: "t", refreshToken: "r" } } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome;
    await act(async () => {
      outcome = await result.current.login("a@b.co", "pw");
    });

    expect(outcome).toEqual({ success: true });
    expect(localStorage.getItem("token")).toBe("t");
    expect(localStorage.getItem("refreshToken")).toBe("r");
    expect(result.current.user.userId).toBe(3);
    expect(result.current.isAuthenticated).toBe(true);
  });

  test("login failure returns the server message and keeps the user signed out", async () => {
    authAPI.login.mockRejectedValueOnce({ response: { data: { message: "Invalid credentials" } } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome;
    await act(async () => {
      outcome = await result.current.login("a@b.co", "bad");
    });

    expect(outcome).toEqual({ success: false, error: "Invalid credentials" });
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("login asks for the authenticator code and only signs in after it", async () => {
    authAPI.login.mockResolvedValueOnce({ data: { data: { mfa_required: true, mfa_token: "challenge" } } });
    authAPI.mfaLogin = vi.fn().mockResolvedValueOnce({
      data: { data: { user: { userId: 3 }, tokens: { accessToken: "t", refreshToken: "r" } } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let step1;
    await act(async () => { step1 = await result.current.login("a@b.co", "pw"); });
    expect(step1).toEqual({ success: false, mfaRequired: true, mfaToken: "challenge" });
    expect(localStorage.getItem("token")).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);

    let step2;
    await act(async () => { step2 = await result.current.completeMfaLogin("challenge", "123456"); });
    expect(step2).toEqual({ success: true });
    expect(authAPI.mfaLogin).toHaveBeenCalledWith("challenge", "123456");
    expect(localStorage.getItem("token")).toBe("t");
    expect(result.current.isAuthenticated).toBe(true);
  });

  test("logout clears everything", async () => {
    authAPI.login.mockResolvedValueOnce({
      data: { data: { user: { userId: 3 }, tokens: { accessToken: "t" } } },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("a@b.co", "pw"); });
    await act(async () => { await result.current.logout(); });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});
