import axios from "axios";

// Use environment variable or default to localhost:5005 for development
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5005/api";

// Track pending requests for cancellation
const pendingRequests = new Map();

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add token and AbortController to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Add AbortController for request cancellation
        // Only if not already provided (allows manual override)
        if (!config.signal) {
            const controller = new AbortController();
            config.signal = controller.signal;

            // Store controller for potential cancellation
            const requestKey = `${config.method}_${config.url}`;
            pendingRequests.set(requestKey, controller);
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

// Handle response errors and cleanup
api.interceptors.response.use(
    (response) => {
        // Remove from pending requests on success
        const requestKey = `${response.config.method}_${response.config.url}`;
        pendingRequests.delete(requestKey);
        return response;
    },
    (error) => {
        // Remove from pending requests on error
        if (error.config) {
            const requestKey = `${error.config.method}_${error.config.url}`;
            pendingRequests.delete(requestKey);
        }

        // Don't show error for cancelled requests
        if (axios.isCancel(error)) {
            console.log('Request cancelled:', error.message);
            return Promise.reject(error);
        }

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

/**
 * Cancel all pending requests
 * Useful for cleanup on route changes or logout
 */
export const cancelPendingRequests = () => {
    pendingRequests.forEach((controller, key) => {
        controller.abort();
        console.log(`Cancelled request: ${key}`);
    });
    pendingRequests.clear();
};

/**
 * Cancel specific request by method and URL
 * @param {string} method - HTTP method (get, post, etc.)
 * @param {string} url - Request URL
 */
export const cancelRequest = (method, url) => {
    const requestKey = `${method}_${url}`;
    const controller = pendingRequests.get(requestKey);
    if (controller) {
        controller.abort();
        pendingRequests.delete(requestKey);
        console.log(`Cancelled request: ${requestKey}`);
    }
};

export default api;
