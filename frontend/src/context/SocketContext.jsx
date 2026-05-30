import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { Client as StompClient } from "@stomp/stompjs";
import SockJS from "sockjs-client";
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

  // Helper to create a socket.io‑like wrapper around a Stomp client
  const createStompWrapper = (stomp) => {
    const subscriptions = {};
    const pendingSubscriptions = [];

    // When connected, process any pending subscriptions
    stomp.onConnect = (frame) => {
      console.log("Connected to socket server");
      pendingSubscriptions.forEach(({ event, callback }) => {
        const sub = stomp.subscribe(event, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            callback(data);
          } catch {
            callback(msg.body);
          }
        });
        subscriptions[event] = sub;
      });
      pendingSubscriptions.length = 0; // clear queue
    };

    return {
      on(event, callback) {
        if (stomp.connected) {
          const sub = stomp.subscribe(event, (msg) => {
            try {
              const data = JSON.parse(msg.body);
              callback(data);
            } catch {
              callback(msg.body);
            }
          });
          subscriptions[event] = sub;
        } else {
          pendingSubscriptions.push({ event, callback });
        }
      },
      off(event) {
        // Remove from pending if not connected yet
        const pendingIndex = pendingSubscriptions.findIndex(s => s.event === event);
        if (pendingIndex !== -1) {
          pendingSubscriptions.splice(pendingIndex, 1);
        }
        const sub = subscriptions[event];
        if (sub) {
          sub.unsubscribe();
          delete subscriptions[event];
        }
      },
      emit(event, data) {
        if (stomp.connected) {
          stomp.publish({ destination: event, body: JSON.stringify(data) });
        } else {
          console.warn("STOMP not connected, cannot emit", event);
        }
      },
      disconnect() {
        stomp.deactivate();
      },
    };
  };

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
        socketRef.current.disconnect();
      }

      const apiUrl = 'https://chamasmart-khrb.onrender.com/api/v1';
      const baseUrl = apiUrl.replace(/\/api\/?$/, "");

              // Create a SockJS endpoint for STOMP over WebSocket
        const stomp = new StompClient({
          webSocketFactory: () => new SockJS(`${baseUrl}/socket.io?token=${token}`),
          reconnectDelay: 5000,
          debug: (str) => console.debug('[STOMP]', str),
          // Pass JWT token for authentication if available
          connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
          onConnect: () => console.log('Connected to socket server'),
          onStompError: (frame) => console.error('STOMP error:', frame),
          onWebSocketError: (event) => console.error('WebSocket error:', event),
        });
      stomp.activate();
      const newSocket = createStompWrapper(stomp);

      // Set up event listeners
      // Connection callbacks for STOMP client
      const onConnectError = (error) => {
        console.error("Socket connection error:", error);
      };

      stomp.onStompError = onConnectError;
      stomp.onWebSocketError = onConnectError;

      // Store the socket in the ref and state
      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connect after setting up listeners
      console.log("STOMP client activated and wrapper ready");
      // No explicit connect call needed; wrapper is ready

      // Cleanup function
      return () => {
        console.log("Cleaning up STOMP wrapper and client");
        if (socketRef.current) {
          // Stomp client wrapper only needs deactivate
          socketRef.current.disconnect();
          socketRef.current = null;
        }
        setSocket(null);
      };
    } else {
      // If user logs out, clean up the socket wrapper
      if (socketRef.current) {
        console.log("User logged out, cleaning up STOMP client");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
    }

    // We only want to run this effect when the user changes
     
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>
  );
};
