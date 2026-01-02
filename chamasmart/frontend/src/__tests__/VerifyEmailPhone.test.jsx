import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VerifyEmailPhone from "../pages/Auth/VerifyEmailPhone";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Mock AuthContext to control verifyEmail/verifyPhone behavior
jest.mock("../context/AuthContext", () => {
  const React = require("react");
  const actual = jest.requireActual("../context/AuthContext");

  const mockContextValue = {
    user: { phoneNumber: "+254712345678" },
    verifyEmail: jest.fn(),
    verifyPhone: jest.fn(),
    error: null,
  };

  const AuthContext = React.createContext(mockContextValue);

  return {
    __esModule: true,
    ...actual,
    useAuth: () => React.useContext(AuthContext),
    AuthProvider: ({ children }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    ),
  };
});

const { useAuth: useAuthMock } = require("../context/AuthContext");

const renderWithRouter = (initialEntries = ["/verify-account"]) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/verify-account" element={<VerifyEmailPhone />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe("VerifyEmailPhone", () => {
  test("renders email and phone sections", () => {
    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /verify your account/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /email verification/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /phone verification/i })
    ).toBeInTheDocument();
  });

  test("submits email token and shows success message", async () => {
    const { verifyEmail } = useAuthMock();
    verifyEmail.mockResolvedValueOnce({ success: true, message: "Email OK" });

    renderWithRouter();

    const tokenInput = screen.getByPlaceholderText(/email verification token/i);
    const button = screen.getByRole("button", { name: /verify email/i });

    fireEvent.change(tokenInput, { target: { value: "abc123" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(verifyEmail).toHaveBeenCalledWith("abc123");
      expect(screen.getByText(/email ok/i)).toBeInTheDocument();
    });
  });

  test("submits phone code and shows success message", async () => {
    const { verifyPhone } = useAuthMock();
    verifyPhone.mockResolvedValueOnce({
      success: true,
      message: "Phone OK",
    });

    renderWithRouter();

    const codeInput = screen.getByPlaceholderText(/6-digit sms code/i);
    const button = screen.getByRole("button", { name: /verify phone/i });

    fireEvent.change(codeInput, { target: { value: "123456" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(verifyPhone).toHaveBeenCalledWith("123456");
      expect(screen.getByText(/phone ok/i)).toBeInTheDocument();
    });
  });
});
