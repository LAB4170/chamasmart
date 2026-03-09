import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { auth } from "../config/firebase";
import {
  signInWithRedirect,
  getRedirectResult,
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

  // Check if user is logged in on mount — also handles Google redirect result
  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error("Failed to parse saved user data:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        setUser(null);
      }
    }

    // Handle Google redirect result (fires after Google Sign-In redirect)
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) { setLoading(false); return; } // No redirect in progress
        const idToken = await result.user.getIdToken();
        const response = await authAPI.firebaseSync(idToken, {});
        const { user: loggedInUser, tokens } = response.data.data;
        localStorage.setItem("token", tokens.accessToken);
        localStorage.setItem("user", JSON.stringify(loggedInUser));
        setUser(loggedInUser);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Google redirect result error:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Consolidated Firebase-based Register
  const register = async (userData) => {
    try {
      setError(null);

      // 1. Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password
      );

      // 2. Get ID Token
      const idToken = await userCredential.user.getIdToken();

      // 3. Sync with our backend (passing names and phone separately)
      const response = await authAPI.firebaseSync(idToken, {
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber
      });

      const { user: syncedUser, tokens } = response.data.data;

      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("user", JSON.stringify(syncedUser));
      setUser(syncedUser);

      return { success: true, user: syncedUser };
    } catch (err) {
      console.error("Registration error:", err);
      const message = err.response?.data?.message || err.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Google Sign-In via redirect (avoids COOP/popup issues entirely)
  const loginWithGoogle = async (userData = {}) => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      // signInWithRedirect navigates away and returns via getRedirectResult in useEffect
      await signInWithRedirect(auth, provider);
      // No code runs after this line — page will navigate to Google
    } catch (err) {
      console.error("Google Login error:", err);
      const message = err.response?.data?.message || err.message || "Google login failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  // Combined Firebase Login
  const loginWithFirebase = async (email, password) => {
    try {
      setError(null);
      const result = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await result.user.getIdToken();

      // Sync with our backend (simple login, no extra data needed usually)
      const response = await authAPI.firebaseSync(idToken);
      const { user: loggedInUser, tokens } = response.data.data;

      localStorage.setItem("token", tokens.accessToken);
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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setError(null);
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

  // Verify Phone
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
    register,
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
