import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { auth, googleProvider } from "../config/firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";

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
    const initAuth = async () => {
      try {
        setLoading(true);
        // 1. Check for Redirect Result (Google Login Fallback)
        const redirectResult = await getRedirectResult(auth).catch(err => {
          console.warn("Redirect result check failed (normal if not returning from redirect):", err);
          return null;
        });

        if (redirectResult) {
          const idToken = await redirectResult.user.getIdToken();
          const userData = {
            firstName: redirectResult.user.displayName?.split(" ")[0] || "",
            lastName: redirectResult.user.displayName?.split(" ").slice(1).join(" ") || "",
            email: redirectResult.user.email,
            phoneNumber: redirectResult.user.phoneNumber || ""
          };

          const response = await authAPI.firebaseSync(idToken, userData);
          const { user: newUser, tokens } = response.data.data;

          localStorage.setItem("token", tokens.accessToken);
          localStorage.setItem("user", JSON.stringify(newUser));
          setUser(newUser);
          setLoading(false);
          return;
        }

        // 2. Standard Session Check
        const token = localStorage.getItem("token");
        const savedUser = localStorage.getItem("user");

        if (token && savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Standard Login (Email/Password)
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.login({ email, password });
      
      const { user: userData, tokens } = response.data.data;

      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);

      return { success: true };
    } catch (err) {
      console.error("Login error:", err);
      const message = err.response?.data?.message || err.message || "Login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Standard Register (Name/Email/Phone/Password)
  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.register(userData);
      const { user: newUser, tokens } = response.data.data;

      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      return { success: true, user: newUser };
    } catch (err) {
      console.error("Registration error:", err);
      const message = err.response?.data?.message || err.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Google Login
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let result;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupErr) {
        // If popup is blocked, fallback to redirect
        if (popupErr.code === 'auth/popup-blocked') {
          console.info("Popup blocked, falling back to redirect...");
          await signInWithRedirect(auth, googleProvider);
          return { success: 'redirecting' };
        }
        throw popupErr;
      }

      const idToken = await result.user.getIdToken();
      
      const userData = {
        firstName: result.user.displayName?.split(" ")[0] || "",
        lastName: result.user.displayName?.split(" ").slice(1).join(" ") || "",
        email: result.user.email,
        phoneNumber: result.user.phoneNumber || ""
      };

      const response = await authAPI.firebaseSync(idToken, userData);
      const { user: newUser, tokens } = response.data.data;

      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      return { success: true, user: newUser };
    } catch (err) {
      console.error("Google login error:", err);
      const message = err.response?.data?.message || err.message || "Google login failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      await authAPI.logout({ refreshToken }).catch(() => {});
    } catch (err) {
      console.warn("Logout error:", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  // Sync profile updates with state and localStorage
  const updateUser = (updatedUserData) => {
    const freshUser = { ...user, ...updatedUserData };
    localStorage.setItem("user", JSON.stringify(freshUser));
    setUser(freshUser);
  };

  // Verify Email
  const verifyEmail = async (token) => {
    try {
      setError(null);
      const response = await authAPI.verifyEmail(token);
      return { success: true, message: response.data.message };
    } catch (err) {
      console.error("Email verification error:", err);
      const message = err.response?.data?.message || err.message || "Email verification failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Verify Phone (kept for manual verification link, but not SMS auth)
  const verifyPhone = async (otp) => {
    try {
      setError(null);
      const response = await authAPI.verifyPhone(otp);
      return { success: true, message: response.data.message };
    } catch (err) {
      console.error("Phone verification error:", err);
      const message = err.response?.data?.message || err.message || "Phone verification failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Resend Email Verification
  const resendEmailVerification = async () => {
    try {
      setError(null);
      const response = await authAPI.resendEmailVerification();
      return { success: true, message: response.data.message };
    } catch (err) {
      console.error("Resend email verification error:", err);
      const message = err.response?.data?.message || err.message || "Failed to resend email verification";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Resend Phone Verification
  const resendPhoneVerification = async () => {
    try {
      setError(null);
      const response = await authAPI.resendPhoneVerification();
      return { success: true, message: response.data.message };
    } catch (err) {
      console.error("Resend phone verification error:", err);
      const message = err.response?.data?.message || err.message || "Failed to resend phone verification";
      setError(message);
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    loginWithGoogle,
    logout,
    verifyEmail,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
