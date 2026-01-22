import { createContext, useState, useContext, useEffect } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Register
  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);

      const { user: newUser, token } = response.data.data;

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      // Surface verification flags so the UI can route to a verify screen
      return {
        success: true,
        user: newUser,
        token,
      };
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const verifyEmail = async (token) => {
    try {
      setError(null);
      const response = await authAPI.verifyEmail({ token });
      return { success: true, message: response.data.message };
    } catch (err) {
      const message =
        err.response?.data?.message || "Email verification failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const verifyPhone = async (code) => {
    try {
      setError(null);
      const response = await authAPI.verifyPhone({ code });
      // Optionally update local user state to mark phone as verified
      if (user) {
        const updated = { ...user, phoneVerified: true };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
      }
      return { success: true, message: response.data.message };
    } catch (err) {
      const message =
        err.response?.data?.message || "Phone verification failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const resendEmailVerification = async () => {
    try {
      setError(null);
      const response = await authAPI.resendEmailVerification();
      return { success: true, message: response.data.message };
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to resend verification email";
      setError(message);
      return { success: false, error: message };
    }
  };

  const resendPhoneVerification = async () => {
    try {
      setError(null);
      const response = await authAPI.resendPhoneVerification();
      return { success: true, message: response.data.message };
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to resend phone code";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Login
  const login = async (credentials) => {
    try {
      setError(null);
      const response = await authAPI.login(credentials);

      // The backend should return user data in response.data.data
      const { user: loggedInUser, token } = response.data.data;

      if (!token || !loggedInUser) {
        throw new Error("Invalid login response from server");
      }

      // Store the token and user data
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return { success: true };
    } catch (err) {
      console.error("Login error:", err);
      const status = err.response?.status;
      const apiMessage = err.response?.data?.message;
      const code = err.response?.data?.code;
      const message =
        apiMessage ||
        "Login failed. Please check your credentials and try again.";
      const unverified = status === 403 && code === "EMAIL_NOT_VERIFIED";

      // Clear any existing auth data on error
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setError(message);

      return {
        success: false,
        error: message,
        unverified,
      };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    verifyEmail,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
