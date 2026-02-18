import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  // undefined means we are outside the provider.
  // null means we are inside but the socket isn't connected yet.
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect if user is authenticated
    if (user) {
      const token = localStorage.getItem("token");
      if (!token) {
        console.warn("No token found, skipping socket connection");
        return;
      }

      // Clean up any existing socket
      if (socketRef.current) {
        console.log("Cleaning up existing socket connection");
        socketRef.current.off("connect");
        socketRef.current.off("connect_error");
        socketRef.current.close();
      }

      // Align with axios.js logic: Use env var or default to localhost:5005
      // We must strip '/api' because socket.io connects to the root
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5005/api";
      const baseUrl = apiUrl.replace(/\/api\/?$/, "");

      console.log("Creating new socket connection to:", baseUrl);
      const newSocket = io(baseUrl, {
        path: "/socket.io",
        auth: { token },
        autoConnect: false, // We'll connect manually
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      // Set up event listeners
      const onConnect = () => {
        console.log("Connected to socket server");
      };

      const onConnectError = (error) => {
        console.error("Socket connection error:", error);
      };

      newSocket.on("connect", onConnect);
      newSocket.on("connect_error", onConnectError);

      // Store the socket in the ref and state
      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connect after setting up listeners
      console.log("Connecting socket...");
      newSocket.connect();

      // Cleanup function
      return () => {
        console.log("Cleaning up socket connection");
        if (socketRef.current) {
          // Remove specific listeners first
          socketRef.current.off("connect", onConnect);
          socketRef.current.off("connect_error", onConnectError);

          // Remove any other listeners that might have been added
          socketRef.current.removeAllListeners();

          // Disconnect if connected
          if (socketRef.current.connected) {
            socketRef.current.disconnect();
          }

          // Close the socket
          socketRef.current.close();
          socketRef.current = null;
        }
        setSocket(null);
      };
    } else {
      // If user logs out, clean up the socket
      if (socketRef.current) {
        console.log("User logged out, cleaning up socket");
        socketRef.current.close();
        socketRef.current = null;
        setSocket(null);
      }
    }

    // We only want to run this effect when the user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};
