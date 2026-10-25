import api from "./axios";

export const authAPI = {
    // Start the signup process (step 1)
    register: (userData) =>
        api.post("/auth/register", {
            email: userData.email,
            phoneNumber: userData.phoneNumber,
            firstName: userData.firstName,
            lastName: userData.lastName,
            password: userData.password,
        }),

    // Login
    login: (credentials) =>
        api.post("/auth/login", {
            email: credentials.email,
            password: credentials.password,
        }),

    // Two-factor sign-in
    mfaLogin: (mfaToken, code) => api.post("/auth/mfa/login", { mfa_token: mfaToken, code }),
    mfaStatus: () => api.get("/auth/mfa/status"),
    mfaSetup: () => api.post("/auth/mfa/setup", {}),
    mfaEnable: (code) => api.post("/auth/mfa/enable", { code }),
    mfaDisable: (code) => api.post("/auth/mfa/disable", { code }),
    mfaRecoveryCodes: (code) => api.post("/auth/mfa/recovery-codes", { code }),

    // Sign out of every device
    logoutAll: () => api.post("/auth/logout-all"),

    // Firebase Sync with backend
    firebaseSync: (idToken, userData = {}) =>
        api.post("/auth/firebase-sync", {
            idToken,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            phoneNumber: userData.phoneNumber
        }),

    // Verify email with token
    verifyEmail: (token) =>
        api.post("/auth/verify-email", { token }),

    // Verify phone with OTP
    verifyPhone: (otp) =>
        api.post("/auth/verify-phone", { otp }),

    // Resend email verification
    resendEmailVerification: () =>
        api.post("/auth/resend-email-verification"),

    // Resend phone verification
    resendPhoneVerification: () =>
        api.post("/auth/resend-phone-verification"),

    forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
    resetPassword: (token, newPassword) => api.post("/auth/reset-password", { token, newPassword }),

    // Logout
    logout: (body = {}) => api.post("/auth/logout", body)
};

