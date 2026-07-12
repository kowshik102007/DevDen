import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [typingStatus, setTypingStatus] = useState({});

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to Flask backend SocketIO server
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.IO connection established');
      // Join personal room for personal notifications
      newSocket.emit('join', { room: `user_${user.id}` });
    });

    // Real-time message listener
    newSocket.on('message_received', (msg) => {
      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Typing status listener
    newSocket.on('typing_status', (data) => {
      // data format: { user_id, is_typing }
      setTypingStatus((prev) => ({
        ...prev,
        [data.user_id]: data.is_typing
      }));
    });

    // General notification listener
    newSocket.on('notification_received', (data) => {
      // data format: { type, content, message }
      setNotifications((prev) => [data, ...prev]);
      
      if (data.type === 'message' && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO connection disconnected');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Join a specific chat channel room
  const joinChatRoom = (otherUserId) => {
    if (!socket || !user) return;
    const room = [user.id, otherUserId].sort().join('_');
    socket.emit('join', { room });
  };

  // Leave a specific chat channel room
  const leaveChatRoom = (otherUserId) => {
    if (!socket || !user) return;
    const room = [user.id, otherUserId].sort().join('_');
    socket.emit('leave', { room });
  };

  // Send a chat message
  const sendChatMessage = (receiverId, content, fileUrl = '', fileType = '') => {
    if (!socket || !user) return;
    const room = [user.id, receiverId].sort().join('_');
    socket.emit('message', {
      sender_id: user.id,
      receiver_id: receiverId,
      content,
      file_url: fileUrl,
      file_type: fileType,
      room
    });
  };

  // Send typing indicator
  const sendTypingIndicator = (receiverId, isTyping) => {
    if (!socket || !user) return;
    const room = [user.id, receiverId].sort().join('_');
    socket.emit('typing', {
      room,
      user_id: user.id,
      is_typing: isTyping
    });
  };

  return (
    <SocketContext.Provider value={{
      socket,
      messages,
      setMessages,
      notifications,
      setNotifications,
      typingStatus,
      joinChatRoom,
      leaveChatRoom,
      sendChatMessage,
      sendTypingIndicator
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
