'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/api';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { encryptData, decryptData } from '@/lib/security/crypto';
import type { Role } from '@/lib/security/permissions';

interface ChatRoomProps {
  roomId: string;
  role: Role | null;
  memberColor?: string;
  isMuted?: boolean;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId, role, memberColor, isMuted }) => {
  const { user } = useAuth();
  const { can } = usePermissions(roomId, role);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const { data: records } = await supabase
        .from('messages')
        .select('*, profiles(username)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
        
      if (!records) return;

      const decryptedRecords = [];
      for (const r of records) {
        try {
          const dec = await decryptData(r.text);
          decryptedRecords.push({ ...r, text: dec || r.text, user_name: r.profiles?.username || 'Anonymous' });
        } catch (e) {
          decryptedRecords.push({ ...r, user_name: r.profiles?.username || 'Anonymous' });
        }
      }
      setMessages(decryptedRecords);
    } catch (e) {
      console.error(e);
    }
  }, [roomId]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase.channel(`messages:${roomId}-${Math.random()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, async (payload) => {
        const record = payload.new as any;
        
        // Fetch the user's name since it's not in the payload
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', record.user_id).single();
        const userName = profile?.username || 'Anonymous';
        
        try {
          const dec = await decryptData(record.text);
          const decryptedRecord = { ...record, text: dec || record.text, user_name: userName };
          setMessages((prev) => {
            if (prev.some(m => m.id === record.id)) return prev;
            return [...prev, decryptedRecord];
          });
        } catch (err) {
          // Fallback
          setMessages((prev) => [...prev, { ...record, user_name: userName }]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !roomId || !user) return;

    // Rate limiting check
    const rateCheck = checkRateLimit('message');
    if (!rateCheck.allowed) {
      alert('You are sending messages too quickly. Please slow down.');
      return;
    }

    try {
      const encryptedText = await encryptData(input.trim());
      const { data: record, error } = await supabase.from('messages').insert({
        room_id: roomId,
        user_id: user.id,
        text: encryptedText,
        color: memberColor || '#565656',
      }).select().single();
      
      if (error) throw error;
      
      const localRecord = { ...record, text: input.trim(), user_name: user.username };
      setMessages((prev) => prev.some(m => m.id === record.id) ? prev : [...prev, localRecord]);
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-4 w-full h-full flex flex-col min-h-0">
      <h3 className="text-sm font-bold text-neo-accent mb-2 pb-2 border-b-2 border-neo-shadow">Chat</h3>
      
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <span className="text-[10px] font-bold" style={{ color: msg.color }}>
              {msg.user_name} {msg.user_id === user?.id ? '(You)' : ''}
            </span>
            <div 
              className={`p-2 rounded-neo text-sm mt-1 max-w-[90%] break-words ${
                msg.user_id === user?.id ? 'bg-neo-bg shadow-neo-inset self-end' : 'bg-neo-bg shadow-neo-sm self-start'
              }`}
            >
              <span className="text-neo-text">{msg.text}</span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isMuted && can('send_messages') ? (
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
      ) : (
        <div className="text-xs text-neo-text/40 text-center py-2">
          {isMuted ? 'You have been muted by an admin' : "You don't have permission to send messages"}
        </div>
      )}
    </div>
  );
};
