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

    // Firebase Sync
    firebaseSync: (idToken) =>
        api.post("/auth/firebase-sync", { idToken }),
};
