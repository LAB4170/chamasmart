import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { auth } from "../config/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from "firebase/auth";

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
    const token = localStorage.getItem("accessToken");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Traditional Backend Register (Email/Password)
  const register = async (userData) => {
    try {
      setError(null);
      const response = await authAPI.register(userData);

      const { user: newUser, tokens } = response.data.data;

      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      setUser(newUser);

      return { success: true, user: newUser };
    } catch (err) {
      const message = err.response?.data?.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Firebase Email/Password Register
  const registerWithFirebase = async (email, password, additionalData = {}) => {
    try {
      setError(null);
      const result = await createUserWithEmailAndPassword(auth, email, password);

      // Update Firebase profile with name if provided
      if (additionalData.firstName || additionalData.lastName) {
        const { updateProfile } = await import("firebase/auth");
        await updateProfile(result.user, {
          displayName: `${additionalData.firstName} ${additionalData.lastName}`.trim()
        });
      }

      const idToken = await result.user.getIdToken();

      // Sync with our backend
      const response = await authAPI.firebaseSync(idToken, additionalData);
      const { user: syncedUser, tokens } = response.data.data;

      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      localStorage.setItem("user", JSON.stringify(syncedUser));
      setUser(syncedUser);

      return { success: true };
    } catch (err) {
      console.error("Firebase Registration error:", err);
      const message = err.response?.data?.message || err.message || "Registration failed";
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

  // Firebase OAuth Login (e.g., Google)
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      // Sync with our backend
      const response = await authAPI.firebaseSync(idToken);
      const { user: loggedInUser, tokens } = response.data.data;

      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return { success: true };
    } catch (err) {
      console.error("Google Login error:", err);
      const message = err.response?.data?.message || err.message || "Google login failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Firebase Email/Password Login
  const loginWithFirebase = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();

      // Sync with our backend
      const response = await authAPI.firebaseSync(idToken);
      const { user: loggedInUser, tokens } = response.data.data;

      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);

      return { success: true };
    } catch (err) {
      console.error("Firebase Login error:", err);
      const message = err.response?.data?.message || err.message || "Login failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.warn("Firebase sign out failed:", err);
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    register,
    registerWithFirebase,
    loginWithGoogle,
    loginWithFirebase,
    logout,
    verifyEmail,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
