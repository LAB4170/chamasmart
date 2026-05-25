import axios from "axios";
import { Capacitor } from "@capacitor/core";

let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api/v1';

// Adjust API_URL for mobile devices in development
if (Capacitor.isNativePlatform() && !import.meta.env.VITE_API_URL) {
    // If on Android Emulator, localhost is 10.0.2.2
    // If on a real device, you need to use your machine's local IP (e.g., 192.168.x.x)
    // We'll default to the emulator IP for now, but allow easy override
    API_URL = "http://10.0.2.2:5006/api/v1";
    console.log("Axios: Native platform detected, using mobile API URL:", API_URL);
}

// Track pending requests for cancellation
const pendingRequests = new Map();

// Create axios instance
/* Helper to decode JWT and check expiration */
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds since epoch
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    console.warn('Failed to parse JWT', e);
    return true;
  }
}

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
        // If token exists but is expired, clear storage and redirect to login
        if (token && isTokenExpired(token)) {
            console.warn('[Axios] Token expired – clearing session');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.replace('/login');
            }
            // Reject the request to avoid sending an expired token
            return Promise.reject(new Error('Session expired'));
        }
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
        const requestKey = `${response.config.method}_${response.config.url}`;
        pendingRequests.delete(requestKey);
        return response;
    },
    (error) => {
        if (error.config) {
            const requestKey = `${error.config.method}_${error.config.url}`;
            pendingRequests.delete(requestKey);
        }

        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        if (!error.response) {
            console.error("[Axios] Network error or server down");
            if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
                window.location.replace("/login");
            }
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
                window.location.replace("/login");
            }
        }

        // Handle 403 Forbidden errors (user is logged in, but just doesn't have access to this resource)
        if (error.response?.status === 403) {
            console.warn(`[Axios] 403 Forbidden at ${error.config.url} — User is authenticated, access denied to this resource.`);
        }
        
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
