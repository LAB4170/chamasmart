import axios from "axios";
import { Capacitor } from "@capacitor/core";

// A value pasted into the host's settings page can carry stray quotes or spaces; strip them so every request still reaches the API.
const cleanUrl = (v) => (v || '').trim().replace(/^["'\s]+|["'\s]+$/g, '').replace(/\/+$/, '');
let API_URL = cleanUrl(import.meta.env.VITE_API_URL) || 'http://localhost:8080/api/v1';

// Adjust API_URL for mobile devices in development
if (Capacitor.isNativePlatform() && window.location.hostname === "localhost") {
    // If on Android Emulator, localhost is 10.0.2.2
    // If on a real device, you need to use your machine's local IP (e.g., 192.168.x.x)
    // We'll default to the emulator IP for now, but allow easy override
    API_URL = "http://10.0.2.2:8080/api/v1";
    console.log("Axios: Native platform detected, using mobile API URL:", API_URL);
}

// Track pending requests for cancellation
const pendingRequests = new Map();

// Create axios instance
/* Helper to decode JWT and check expiration */
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    const payload = JSON.parse(jsonPayload);
    // exp is in seconds since epoch
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    console.warn('Failed to parse JWT', e);
    return true;
  }
}

// One shared refresh at a time: several requests that find the access token expired all wait for the same renewal.
let refreshing = null;
function endSession() {
    ["token", "refreshToken", "user"].forEach((k) => localStorage.removeItem(k));
    cancelPendingRequests();
    const p = window.location.pathname;
    if (p !== '/login' && p !== '/register') window.location.replace('/login');
}
function renewSession() {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return Promise.reject(new Error("No refresh token"));
    if (!refreshing) {
        refreshing = axios.post(`${API_URL}/auth/refresh`, { refreshToken })
            .then((res) => {
                const t = res.data?.data?.tokens;
                if (!t?.accessToken) throw new Error("Bad refresh response");
                localStorage.setItem("token", t.accessToken);
                if (t.refreshToken) localStorage.setItem("refreshToken", t.refreshToken);
                return t.accessToken;
            })
            .finally(() => { refreshing = null; });
    }
    return refreshing;
}

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add token and AbortController to requests
api.interceptors.request.use(
    async (config) => {
        let token = localStorage.getItem("token");
        // An expired access token is renewed quietly with the refresh token; only a failed renewal ends the session.
        if (token && isTokenExpired(token) && !String(config.url).includes("/auth/")) {
            try {
                token = await renewSession();
            } catch {
                endSession();
                return Promise.reject(new Error('Session expired'));
            }
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
    async (error) => {
        if (error.config) {
            const requestKey = `${error.config.method}_${error.config.url}`;
            pendingRequests.delete(requestKey);
        }

        if (axios.isCancel(error)) {
            return Promise.reject(error);
        }

        if (!error.response) {
            console.error("[Axios] Network error or server down");
            // Do NOT redirect here — a transient network error should not force logout.
            // The UI components handle errors via the returned rejected promise.
            return Promise.reject(error);
        }

        if (error.response?.status === 401) {
            const original = error.config;
            const isAuthCall = String(original?.url || "").includes("/auth/");
            if (original && !original._retried && !isAuthCall && localStorage.getItem("refreshToken")) {
                original._retried = true;
                try {
                    const fresh = await renewSession();
                    original.headers.Authorization = `Bearer ${fresh}`;
                    delete original.signal;
                    return api(original);
                } catch { /* fall through to sign-out */ }
            }
            if (!isAuthCall) {
                // Short delay so in-flight renders finish before the redirect.
                const currentPath = window.location.pathname;
                ["token", "refreshToken", "user"].forEach((k) => localStorage.removeItem(k));
                if (currentPath !== '/login' && currentPath !== '/register') setTimeout(() => window.location.replace('/login'), 300);
                cancelPendingRequests();
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

/**
 * Wake a sleeping backend (free hosting spins down after idle). Fire-and-forget:
 * any response, even a 404, starts the server, so the first real request is quick.
 */
export const warmUpServer = () => {
    try {
        fetch(`${API_URL}/actuator/health`, { mode: "no-cors", cache: "no-store" }).catch(() => {});
    } catch { /* best effort */ }
};

export default api;
