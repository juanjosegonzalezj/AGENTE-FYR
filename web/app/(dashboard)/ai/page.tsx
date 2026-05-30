'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: '¡Hola! Soy el asistente IA de Find Your Rival. Puedo ayudarte a reservar pistas, encontrar rivales y gestionar el centro deportivo. ¿En qué puedo ayudarte?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': TENANT_ID,
        },
        body: JSON.stringify({ message: userMsg, conversation_id: conversationId }),
      });

      const json = await res.json();
      if (json.success) {
        setConversationId(json.data.conversation_id);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: json.data.reply,
          tools: json.data.tools_used,
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${json.error}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión. Por favor intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asistente IA</h1>
        <p className="text-gray-500 text-sm mt-1">
          Prueba el agente en modo web. El mismo agente funciona en WhatsApp.
        </p>
      </div>

      <div className="card flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={clsx('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={14} className="text-white" />
                </div>
              )}
              <div className={clsx(
                'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm'
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.tools && msg.tools.length > 0 && (
                  <p className="text-xs mt-2 opacity-60">
                    Herramientas: {msg.tools.join(', ')}
                  </p>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={14} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <Loader2 size={16} className="animate-spin text-brand-500" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Escribe un mensaje... (ej. ¿Qué pistas hay disponibles mañana?)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="btn-primary px-3 disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {['¿Qué pistas hay disponibles mañana?', '¿Cuánto cuesta una pista de pádel?', 'Necesito un rival para tenis'].map(q => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-xs text-brand-600 bg-brand-50 px-2 py-1 rounded-full hover:bg-brand-100 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
