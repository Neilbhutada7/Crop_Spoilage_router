import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CropAssistant({ isHindi }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: isHindi ? 'नमस्ते! मैं आपका फसल एआई सहायक हूँ। मैं आपकी कैसे मदद कर सकता हूँ?' : 'Hello! I am your Crop AI Assistant. How can I help you today?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'assistant') {
      setMessages([{ role: 'assistant', text: isHindi ? 'नमस्ते! मैं आपका फसल एआई सहायक हूँ। मैं आपकी कैसे मदद कर सकता हूँ?' : 'Hello! I am your Crop AI Assistant. How can I help you today?' }]);
    }
  }, [isHindi]);

  const handleSend = async (e, textOverride) => {
    if (e) e.preventDefault();
    const userText = textOverride || inputValue;
    if (!userText.trim()) return;

    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    if (!textOverride) setInputValue('');
    setIsTyping(true);

    try {
      const res = await axios.post(`${API_URL}/api/chat`, { message: userText, isHindi });
      setMessages(prev => [...prev, { role: 'assistant', text: res.data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', text: isHindi ? 'क्षमा करें, मुझे सर्वर से जुड़ने में समस्या हो रही है।' : 'Sorry, I am having trouble connecting to the server.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <div 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary)',
          color: 'white',
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
          zIndex: 1000,
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <MessageSquare size={28} />
      </div>

      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: '350px',
          height: '500px',
          backgroundColor: 'var(--surface)',
          borderRadius: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--surface-hover)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Bot size={20} color="var(--primary)" />
              {isHindi ? 'फसल एआई सहायक' : 'Crop AI Assistant'}
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--surface-hover)',
                color: msg.role === 'user' ? 'white' : 'var(--text)',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '12px',
                fontSize: '0.875rem',
                lineHeight: '1.4'
              }}>
                {msg.text}
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <span className="typing-dot">.</span><span className="typing-dot">.</span><span className="typing-dot">.</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '0 1rem 0.5rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
            {isHindi ? (
              <>
                <button onClick={() => handleSend(null, 'टमाटर')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>टमाटर</button>
                <button onClick={() => handleSend(null, 'प्याज')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>प्याज</button>
                <button onClick={() => handleSend(null, 'केला')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>केला</button>
                <button onClick={() => handleSend(null, 'तापमान')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>तापमान का प्रभाव</button>
                <button onClick={() => handleSend(null, 'खराब होने से बचाएं')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>खराब होने से कैसे बचाएं?</button>
              </>
            ) : (
              <>
                <button onClick={() => handleSend(null, 'Tomato')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>Tomato</button>
                <button onClick={() => handleSend(null, 'Onion')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>Onion</button>
                <button onClick={() => handleSend(null, 'Banana')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>Banana</button>
                <button onClick={() => handleSend(null, 'Temperature effect')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>Temp Impact</button>
                <button onClick={() => handleSend(null, 'Reduce spoilage')} style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-hover)', cursor: 'pointer' }}>Reduce Spoilage?</button>
              </>
            )}
          </div>

          <form onSubmit={handleSend} style={{
            padding: '0.5rem 1rem 1rem 1rem',
            display: 'flex',
            gap: '0.5rem'
          }}>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={isHindi ? 'अपना प्रश्न टाइप करें...' : 'Type your question...'}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--surface-hover)',
                color: 'var(--text)',
                outline: 'none'
              }}
            />
            <button type="submit" style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
