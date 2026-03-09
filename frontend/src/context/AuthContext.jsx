import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import { auth } from "../config/firebase";
import {
  signInWithPopup,
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

  // Check if user is logged in on mount
  useEffect(() => {
    // 1. Check for Redirect Results first (to catch Google/OAuth returns)
    const checkRedirect = async () => {
      try {
        console.log("AuthProvider: Checking for redirect result...");
        const redirectResult = await getRedirectResult(auth);
        console.log("AuthProvider: Redirect result:", redirectResult ? "Found" : "None");
        
        if (redirectResult) {
          console.log("AuthProvider: User from redirect:", redirectResult.user.email);
          const idToken = await redirectResult.user.getIdToken();
          console.log("AuthProvider: Syncing with backend...");
          const response = await authAPI.firebaseSync(idToken);
          console.log("AuthProvider: Backend sync response:", response.data);
          
          const { user: syncedUser, tokens } = response.data.data;

          localStorage.setItem("token", tokens.accessToken);
          localStorage.setItem("user", JSON.stringify(syncedUser));
          setUser(syncedUser);
          console.log("AuthProvider: User state updated from redirect");
        }
      } catch (err) {
        console.error("Redirect result error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // 2. Firebase Observer for persistent state sync
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log("AuthProvider: onAuthStateChanged", firebaseUser ? "User present" : "No user");
      
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      if (firebaseUser) {
        // If we have a Firebase user but no local record, we might need to sync
        if (!token || !savedUser) {
          console.log("AuthProvider: Firebase user detected but local state missing, syncing...");
          try {
            const idToken = await firebaseUser.getIdToken();
            const response = await authAPI.firebaseSync(idToken);
            const { user: syncedUser, tokens } = response.data.data;
            localStorage.setItem("token", tokens.accessToken);
            localStorage.setItem("user", JSON.stringify(syncedUser));
            setUser(syncedUser);
          } catch (err) {
            console.error("Auth sync error:", err);
          }
        } else if (!user) {
          // Restore from localStorage if React state is empty
          setUser(JSON.parse(savedUser));
        }
      } else {
        // Clear local state if Firebase says we are logged out
        if (token || savedUser) {
          console.log("AuthProvider: Firebase user lost, clearing local state");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        }
      }
      setLoading(false);
    });

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

  // Improved Login with Redirect support
  const loginWithGoogle = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      // Use redirect to avoid popup-blocked errors
      await signInWithRedirect(auth, provider);
      // Execution stops here as page redirects
      return { success: true }; 
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
