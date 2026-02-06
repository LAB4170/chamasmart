import axios from "axios";

// Use environment variable or default to localhost:5005 for development
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005/api";

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add token to requests if it exists
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Handle response errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Only handle 401 Unauthorized errors (not 404, etc.)
        if (error.response?.status === 401) {
            // Only clear and redirect if we're not already on the login/register page
            if (
                window.location.pathname !== "/login" &&
                window.location.pathname !== "/register"
            ) {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.replace("/login");
            }
        }
        // For 404 errors, just return the error without redirecting
        return Promise.reject(error);
    },
);

export default api;
