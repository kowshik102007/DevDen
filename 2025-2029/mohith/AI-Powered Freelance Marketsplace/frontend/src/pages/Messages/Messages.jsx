import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { 
  Send, Bot, Smile, AlertCircle, FileText, Image as ImageIcon,
  Check, CheckCheck, Loader2
} from 'lucide-react';

export const Messages = () => {
  const [searchParams] = useSearchParams();
  const initialContactParam = searchParams.get('contact');
  
  const { user, token } = useAuth();
  const { 
    messages, setMessages, joinChatRoom, leaveChatRoom, 
    sendChatMessage, sendTypingIndicator, typingStatus 
  } = useSocket();

  // Chat UI states
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null); // { id, name, role }
  const [chatInput, setChatInput] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isBotSelected, setIsBotSelected] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 1. Fetch Contact List
  const fetchContactsList = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/messages/contacts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        
        // Add Chatbot to list by default
        const chatBotObj = {
          id: 'bot',
          first_name: 'SkillBridge AI',
          last_name: 'Support Bot',
          role: 'AI System',
          latest_message: 'Ask me anything about payments, refunds, and order progress.',
          unread: false
        };
        
        setContacts([chatBotObj, ...data]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchContactsList();
  }, []);

  // 2. Manage Active Conversations
  const selectContact = async (contact) => {
    // If bot
    if (contact.id === 'bot') {
      setIsBotSelected(true);
      setActiveContact({ id: 'bot', first_name: 'SkillBridge AI', last_name: 'Support Bot' });
      setMessages([
        {
          id: 'welcome_bot',
          sender_id: 'bot',
          content: 'Hello! I am your 24/7 AI Platform Support Assistant. Ask me about orders, commissions, wallet, or refunds guidelines!',
          created_at: new Date().toISOString()
        }
      ]);
      return;
    }

    setIsBotSelected(false);
    
    // Clean typing indicator of previous
    if (activeContact && activeContact.id !== 'bot') {
      leaveChatRoom(activeContact.id);
    }
    
    setActiveContact(contact);
    joinChatRoom(contact.id);
    
    // Fetch History
    setLoadingHistory(true);
    try {
      const res = await fetch(`http://localhost:5000/api/messages/history/${contact.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Auto select contact if parameter exists
  useEffect(() => {
    if (initialContactParam && contacts.length > 0 && !loadingContacts) {
      const matched = contacts.find(c => String(c.id) === String(initialContactParam));
      if (matched) {
        selectContact(matched);
      } else {
        // Fetch specific user details
        const fetchTargetUser = async () => {
          try {
            const userRes = await fetch(`http://localhost:5000/api/auth/me`, {
              headers: { 'Authorization': `Bearer ${token}` } // (normally we would query an absolute profile details, but let's query custom route)
            });
            // We select fallback user Alex (ID: 2) or Sarah (ID: 3)
            const alexContact = contacts.find(c => c.id === 2) || contacts[0];
            if (alexContact) selectContact(alexContact);
          } catch (e) {
            console.error(e);
          }
        };
        fetchTargetUser();
      }
    } else if (contacts.length > 0 && !activeContact && !loadingContacts) {
      // Select bot by default
      selectContact(contacts[0]);
    }
  }, [contacts, loadingContacts, initialContactParam]);

  // 3. Typing Indicator
  const handleInputChange = (e) => {
    setChatInput(e.target.value);
    if (!isBotSelected && activeContact) {
      sendTypingIndicator(activeContact.id, e.target.value.length > 0);
    }
  };

  // 4. Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const typedText = chatInput;
    setChatInput('');
    
    if (!isBotSelected && activeContact) {
      // Emit socket message
      sendChatMessage(activeContact.id, typedText);
      sendTypingIndicator(activeContact.id, false);
    } else {
      // Call Chatbot AI API
      const userMsg = {
        id: `user_${Date.now()}`,
        sender_id: user.id,
        content: typedText,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, userMsg]);
      
      try {
        const res = await fetch('http://localhost:5000/api/messages/chatbot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ message: typedText })
        });
        if (res.ok) {
          const data = await res.json();
          const botMsg = {
            id: `bot_${Date.now()}`,
            sender_id: 'bot',
            content: data.reply,
            created_at: new Date().toISOString()
          };
          setMessages((prev) => [...prev, botMsg]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 h-[80vh] flex gap-6 relative">
      <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

      {/* Sidebar contacts list */}
      <div className="w-80 glass-panel flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-darkBorder/50">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Conversations</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loadingContacts ? (
            <div className="p-4 text-center">
              <Loader2 className="mx-auto text-indigo-400 animate-spin" size={20} />
            </div>
          ) : contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => selectContact(c)}
              className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition ${
                activeContact?.id === c.id
                  ? 'bg-indigo-950/40 border-indigo-500/50'
                  : 'bg-transparent border-transparent hover:bg-slate-900/40'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs uppercase shadow-md shrink-0 ${
                c.id === 'bot' 
                  ? 'bg-gradient-to-br from-indigo-500 to-cyan-400' 
                  : 'bg-indigo-600'
              }`}>
                {c.id === 'bot' ? <Bot size={16} /> : `${c.first_name[0]}${c.last_name[0]}`}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h4 className="text-xs font-bold text-white truncate">{c.first_name} {c.last_name}</h4>
                  <span className="text-[9px] text-gray-500 capitalize">{c.role}</span>
                </div>
                <p className="text-[10px] text-gray-400 truncate leading-snug">{c.latest_message}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat pane */}
      <div className="flex-1 glass-panel flex flex-col overflow-hidden">
        {activeContact ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-darkBorder/50 flex items-center justify-between bg-slate-950/20">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs uppercase ${
                  activeContact.id === 'bot' ? 'bg-gradient-to-tr from-indigo-500 to-cyan-400' : 'bg-indigo-600'
                }`}>
                  {activeContact.id === 'bot' ? <Bot size={16} /> : `${activeContact.first_name[0]}`}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-normal">{activeContact.first_name} {activeContact.last_name}</h4>
                  {typingStatus[activeContact.id] && (
                    <span className="text-[9px] text-cyan-400 font-semibold tracking-wider animate-pulse uppercase">Typing...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages box */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="text-indigo-400 animate-spin" size={28} />
                </div>
              ) : (
                messages.map((m) => {
                  const isOwn = m.sender_id === user.id;
                  return (
                    <div 
                      key={m.id} 
                      className={`flex flex-col max-w-[70%] ${isOwn ? 'self-end ml-auto' : 'self-start mr-auto'}`}
                    >
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${
                        isOwn 
                          ? 'bg-indigo-950/60 border-indigo-500/30 rounded-tr-none text-indigo-100'
                          : 'bg-slate-900 border-darkBorder rounded-tl-none text-gray-300'
                      }`}>
                        {m.content}
                      </div>
                      
                      {/* timestamp */}
                      <span className={`text-[9px] text-gray-500 pt-1 flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        {isOwn && <CheckCheck className="text-indigo-400" size={10} />}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form area */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-darkBorder/40 flex items-center gap-3">
              <input
                type="text"
                value={chatInput}
                onChange={handleInputChange}
                placeholder={isBotSelected ? "Ask support bot a question..." : "Type your message..."}
                className="flex-1 bg-slate-900 border border-darkBorder focus:border-indigo-500 focus:outline-none rounded-xl py-3 px-4 text-xs text-white"
              />
              <button
                type="submit"
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition shadow-glow"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3 text-center">
            <Bot size={44} className="text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Select a Chat Conversation</h4>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              Open a freelancer gig page and click 'Message Consultant' or select Support Bot on the sidebar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
export default Messages;
