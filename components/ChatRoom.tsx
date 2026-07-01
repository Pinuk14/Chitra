'use client';

import React, { useEffect, useState, useRef } from 'react';
import { pb } from '@/lib/api';
import { MY_USER_ID, MY_USER_COLOR } from '@/hooks/useRealtimeSync';

export const ChatRoom: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial messages
  useEffect(() => {
    pb.collection('messages')
      .getFullList({ filter: `room_id="${roomId}"`, sort: 'created' })
      .then(setMessages)
      .catch(() => {});

    // Subscribe to new messages
    let unsubscribe: (() => void) | undefined;
    pb.collection('messages').subscribe('*', (e) => {
      if (e.action === 'create' && e.record.room_id === roomId) {
        setMessages((prev) => {
          if (prev.some(m => m.id === e.record.id)) return prev;
          return [...prev, e.record];
        });
      }
    }).then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId) return;

    try {
      const record = await pb.collection('messages').create({
        room_id: roomId,
        user_id: MY_USER_ID,
        user_name: 'Anonymous',
        text: input.trim(),
        color: MY_USER_COLOR,
      }, { requestKey: null });
      
      // Optimistic UI update
      setMessages((prev) => prev.some(m => m.id === record.id) ? prev : [...prev, record]);
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-4 w-full h-full flex flex-col">
      <h3 className="text-sm font-bold text-neo-accent mb-2 pb-2 border-b-2 border-neo-shadow">Chat</h3>
      
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <span className="text-[10px] font-bold" style={{ color: msg.color }}>
              {msg.user_name} {msg.user_id === MY_USER_ID ? '(You)' : ''}
            </span>
            <div 
              className={`p-2 rounded-neo text-sm mt-1 max-w-[90%] break-words ${
                msg.user_id === MY_USER_ID ? 'bg-neo-bg shadow-neo-inset self-end' : 'bg-neo-bg shadow-neo-sm self-start'
              }`}
            >
              <span className="text-neo-text">{msg.text}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 bg-neo-bg rounded-neo shadow-neo-inset border-0 outline-none text-neo-text text-sm"
        />
        <button 
          type="submit" 
          disabled={!input.trim()}
          className="px-3 py-2 bg-neo-bg rounded-neo shadow-neo-sm hover:shadow-neo-md transition-shadow disabled:opacity-50 text-neo-accent font-bold text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
};
