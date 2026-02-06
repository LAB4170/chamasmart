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

    // Firebase Sync with backend
    firebaseSync: (idToken, userData = {}) =>
        api.post("/auth/firebase-sync", {
            idToken,
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
};

