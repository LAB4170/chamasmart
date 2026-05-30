import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Your web app's Firebase configuration
// These should be added to your .env file
const firebaseConfig = {
    apiKey: "AIzaSyAKZb39OLyjc3JsJW_7J7Xk3J3sa6BUXqA",
    authDomain: "chamasmart-1c600.firebaseapp.com",
    projectId: "chamasmart-1c600",
    storageBucket: "chamasmart-1c600.firebasestorage.app",
    messagingSenderId: "475835064239",
    appId: "1:475835064239:web:f75f507997a83be468195a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider };
export default app;
