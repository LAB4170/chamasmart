const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' ? '/api' : 'http://127.0.0.1:5005/api');
// Derive backend base URL by stripping any "/api" segment (including version)
let BACKEND_URL = API_URL.split('/api')[0];
// Fallback to window origin if resolution fails (e.g., during SSR)
if (!BACKEND_URL) {
  BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : '';
}

// Firebase Storage / GCS domains that need to be proxied
const FIREBASE_DOMAINS = [
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
];

/**
 * Formats an image URL, proxying Firebase Storage URLs through the backend
 * to avoid CORS errors, and prepending the backend URL for relative paths.
 * @param {string} url - The image URL or relative path.
 * @returns {string|null} - The formatted URL or null.
 */
export const getImageUrl = (url) => {
    if (!url) return '/default-avatar.png';

    // Route Firebase/GCS URLs through backend proxy to avoid CORS
    const isFirebaseUrl = FIREBASE_DOMAINS.some(domain => url.includes(domain));
    if (isFirebaseUrl) {
        return `${API_URL}/users/image-proxy?url=${encodeURIComponent(url)}`;
    }

    if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:") ||
        url.startsWith("blob:")
    ) {
        return url;
    }

    // Prepend backend URL for relative paths (e.g., /uploads/...)
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return `${BACKEND_URL}${cleanUrl}`;
};
