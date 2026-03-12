import { createContext, useContext, useState, useEffect, useRef } from "react";
import { authAPI } from "../services/api";
import { auth } from "../config/firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber
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
  // Stores the Firebase confirmationResult after sendOTP — needed to confirm OTP
  const confirmationResultRef = useRef(null);

  // Check if user is logged in on mount
  useEffect(() => {
    // Unified Firebase Observer for persistent state sync
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log("AuthProvider: onAuthStateChanged", firebaseUser ? "User: " + firebaseUser.email : "No user");
      
      try {
        if (firebaseUser) {
          const token = localStorage.getItem("token");
          const savedUser = localStorage.getItem("user");

          // If we have a Firebase user but no local record, we must sync
          if (!token || !savedUser) {
            console.log("AuthProvider: Syncing Firebase user with backend...");
            const idToken = await firebaseUser.getIdToken();
            const response = await authAPI.firebaseSync(idToken);
            const { user: syncedUser, tokens } = response.data.data;
            
            localStorage.setItem("token", tokens.accessToken);
            localStorage.setItem("user", JSON.stringify(syncedUser));
            setUser(syncedUser);
            console.log("AuthProvider: Sync complete");
          } else if (!user) {
            // Restore from localStorage if React state is empty
            setUser(JSON.parse(savedUser));
            console.log("AuthProvider: Restored from localStorage");
          }
        } else {
          // User is signed out, clear local state
          if (localStorage.getItem("token") || localStorage.getItem("user")) {
            console.log("AuthProvider: Clearing local state");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
          }
        }
      } catch (err) {
        console.error("AuthProvider Sync Error:", err);
        const errorMessage = err.response?.data?.message || err.message || "Authentication sync failed";
        setError(errorMessage);
        // Do NOT call handleLogout here — it triggers onAuthStateChanged(null) 
        // which resets the loop. Let the user see the error on the login page.
      } finally {
        setLoading(false);
      }
    });

    // Check for redirect result (Google sign-in) without competing with onAuthStateChanged
    const checkRedirect = async () => {
      try {
        console.log("AuthProvider: Checking for redirect result...");
        const redirectResult = await getRedirectResult(auth);
        console.log("AuthProvider: Redirect result:", redirectResult ? "Found" : "None");
        // No need to sync here — onAuthStateChanged will fire and cover it
      } catch (err) {
        console.error("AuthProvider Redirect Error:", err);
        setError(err.message);
      }
    };

    checkRedirect();

    return () => unsubscribe();
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

  // Improved Login with Popup support
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      // Use popup for immediate feedback and better local development persistence
      const result = await signInWithPopup(auth, provider);
      
      if (result.user) {
        console.log("LoginWithGoogle: Popup successful, syncing...");
        const idToken = await result.user.getIdToken();
        const response = await authAPI.firebaseSync(idToken);
        const { user: syncedUser, tokens } = response.data.data;

        localStorage.setItem("token", tokens.accessToken);
        localStorage.setItem("user", JSON.stringify(syncedUser));
        setUser(syncedUser);
        return { success: true, user: syncedUser };
      }
      
      return { success: false, error: "No user returned from Google" };
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

  // ============================================================================
  // FIREBASE PHONE AUTH
  // ============================================================================

  /**
   * Step 1: Send OTP via Firebase Phone Auth
   * @param {string} phone - Phone number in international format (+254...)
   * @param {string} buttonElementId - ID of the DOM button to attach reCAPTCHA to
   */
  const loginWithPhone = async (phone, buttonElementId = "phone-submit-btn") => {
    try {
      setError(null);

      // Reset any existing reCAPTCHA to prevent "reCAPTCHA has already been rendered" errors
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) { /* ignore */ }
        window.recaptchaVerifier = null;
      }

      // Invisible reCAPTCHA attached to the phone submit button
      window.recaptchaVerifier = new RecaptchaVerifier(auth, buttonElementId, {
        size: "invisible",
        callback: () => {
          console.log("reCAPTCHA solved");
        },
        "expired-callback": () => {
          console.warn("reCAPTCHA expired");
          window.recaptchaVerifier = null;
        },
      });

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier
      );

      // Store so verifyPhoneOTP can use it
      confirmationResultRef.current = confirmationResult;

      return { success: true };
    } catch (err) {
      console.error("Firebase Phone Auth error:", err);
      // Clean up reCAPTCHA on error
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) { /* ignore */ }
        window.recaptchaVerifier = null;
      }
      const message = err.message || "Failed to send OTP. Please try again.";
      setError(message);
      return { success: false, error: message };
    }
  };

  /**
   * Step 2: Verify OTP entered by user, then sync with our backend
   * @param {string} otp - The 6-digit OTP from Firebase SMS
   */
  const verifyPhoneOTP = async (otp) => {
    try {
      setError(null);

      if (!confirmationResultRef.current) {
        throw new Error("No OTP session found. Please request a new code.");
      }

      // Confirm OTP with Firebase
      const result = await confirmationResultRef.current.confirm(otp);
      const firebaseUser = result.user;

      // Get idToken and sync with our backend — same as Google sign-in
      const idToken = await firebaseUser.getIdToken();
      const response = await authAPI.firebaseSync(idToken);
      const { user: syncedUser, tokens } = response.data.data;

      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("user", JSON.stringify(syncedUser));
      setUser(syncedUser);

      // Clean up reCAPTCHA
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) { /* ignore */ }
        window.recaptchaVerifier = null;
      }
      confirmationResultRef.current = null;

      return { success: true, isNewUser: result._tokenResponse?.isNewUser ?? false };
    } catch (err) {
      console.error("Verify OTP error:", err);
      const message = err.response?.data?.message || err.message || "Invalid OTP. Please try again.";
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
    loginWithPhone,
    verifyPhoneOTP,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
