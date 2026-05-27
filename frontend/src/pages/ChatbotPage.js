import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, FileText, Search, TriangleAlert, Building, Loader, X, Hash } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const QUICK_ACTIONS = [
  { label: 'Submit Complaint', prompt: 'How do I submit a new complaint?', icon: FileText },
  { label: 'Track Status', prompt: 'I want to track my complaint status', icon: Search },
  { label: 'Escalate Issue', prompt: 'My complaint is not resolved within SLA. How do I escalate?', icon: TriangleAlert },
  { label: 'Department Info', prompt: 'What are the different departments and their SLAs?', icon: Building },
];

const HOTSPOT_COLORS = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-green-400' };

const ChatbotPage = () => {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: `🌿 **Welcome to SiliconBot!**\n\nI'm your AI civic assistant for Bengaluru. I can help you:\n\n• **Submit** a new complaint\n• **Track** your complaint (just share your ID like SS-2026-123456)\n• **Escalate** unresolved issues\n• **Get info** about departments, SLAs, and hotspots\n\nHow can I help you today?`,
    timestamp: new Date()
  }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hotspots, setHotspots] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    api.get('/chatbot/hotspots').then(res => {
      setHotspots(res.data.hotspots || []);
    }).catch(() => {
      setHotspots([
        { ward: 'Whitefield', category: 'Garbage', complaint_count: 67, hotspot_level: 'critical' },
        { ward: 'Malleswaram', category: 'Sewage', complaint_count: 53, hotspot_level: 'critical' },
        { ward: 'Koramangala', category: 'Roads', complaint_count: 45, hotspot_level: 'high' },
        { ward: 'Indiranagar', category: 'Sewage', complaint_count: 41, hotspot_level: 'high' },
        { ward: 'Jayanagar', category: 'Garbage', complaint_count: 32, hotspot_level: 'medium' },
      ]);
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text = input) => {
    if (!text.trim() || sending) return;
    const userMessage = text.trim();
    setInput('');

    const history = messages.filter(m => m.role !== 'system').slice(-10);
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    setSending(true);

    try {
      const res = await api.post('/chatbot/message', {
        message: userMessage,
        history: history.map(m => ({ role: m.role, content: m.content }))
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        complaint_found: res.data.complaint_found,
        demo: res.data.demo,
        timestamp: new Date()
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm having trouble connecting to the server. Please try again or call our helpline: **1800-425-2225**",
        timestamp: new Date()
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Simple markdown-like rendering
  const renderContent = (content) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-saffron-400">$1</strong>');
      line = line.replace(/`(.*?)`/g, '<code class="bg-forest-900/50 px-1 rounded text-green-400 text-xs">$1</code>');
      if (line.startsWith('• ')) {
        return <li key={i} className="ml-4 text-sm" dangerouslySetInnerHTML={{ __html: line.slice(2) }} />;
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: line }} />;
    });
  };

  return (
    <div className="min-h-screen pt-16 flex flex-col">
      <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 pt-4 pb-4 gap-4">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col glass rounded-2xl border border-forest-700/30 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-forest-700/30 bg-forest-900/30">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-forest-700 to-saffron-500 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">SiliconBot</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Online · AI Powered
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-saffron-500' : 'bg-forest-700'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'chat-user' : 'chat-bot'}`}>
                  <div className="text-white/90 leading-relaxed space-y-1">
                    {renderContent(msg.content)}
                  </div>
                  {msg.complaint_found && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                      <Hash className="w-3 h-3" /> Complaint data retrieved from database
                    </div>
                  )}
                  {msg.demo && (
                    <div className="mt-1 text-xs text-white/30">AI Assistant — Not official government advice</div>
                  )}
                  <p className="text-xs text-white/30 mt-2">{msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-forest-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="chat-bot px-4 py-3 rounded-2xl">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-4 pb-2">
            <div className="flex gap-2 flex-wrap">
              {QUICK_ACTIONS.map(({ label, prompt, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => sendMessage(prompt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-forest-800/50 hover:bg-forest-700/70 border border-forest-700/50 hover:border-saffron-500/30 text-xs text-white/70 hover:text-white transition-all"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="px-4 pb-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  className="input-field resize-none pr-10"
                  rows={2}
                  placeholder="Ask anything... or paste your complaint ID (SS-YYYY-XXXXXX)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                {input && (
                  <button onClick={() => setInput('')} className="absolute right-3 top-3 text-white/30 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className={`btn-primary p-3 h-fit ${(!input.trim() || sending) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-white/20 mt-1 text-center">AI-powered civic assistant · Not official government advice</p>
          </div>
        </div>

        {/* Sidebar: Hotspots */}
        <div className="hidden lg:flex flex-col w-72 space-y-4">
          <div className="glass rounded-2xl border border-forest-700/30 p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">🔥</span> Live Hotspots
            </h3>
            <div className="space-y-3">
              {hotspots.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-forest-700/20 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-white">{h.ward}</p>
                    <p className="text-xs text-white/40">{h.category}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${HOTSPOT_COLORS[h.hotspot_level]}`}>{h.complaint_count}</p>
                    <p className={`text-xs capitalize ${HOTSPOT_COLORS[h.hotspot_level]}`}>{h.hotspot_level}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl border border-forest-700/30 p-5">
            <h3 className="font-semibold text-white mb-4">Department Contacts</h3>
            <div className="space-y-3 text-sm">
              {[
                { name: 'BBMP Roads', phone: '080-2297-2222', color: 'text-orange-400' },
                { name: 'SWM Garbage', phone: '080-2222-7766', color: 'text-green-400' },
                { name: 'BWSSB Water', phone: '080-2214-7111', color: 'text-blue-400' },
                { name: 'BESCOM Power', phone: '1912', color: 'text-yellow-400' },
                { name: 'Parks & Trees', phone: '080-2222-8888', color: 'text-emerald-400' },
              ].map(({ name, phone, color }) => (
                <div key={name} className="flex justify-between">
                  <span className="text-white/60">{name}</span>
                  <span className={`font-mono text-xs ${color}`}>{phone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
