'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';
import { supabase } from '@/lib/api';

export const ShareRoom: React.FC<{ roomId: string; canInvite?: boolean }> = ({ roomId, canInvite }) => {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    // Ensuring window is available (client-side)
    setShareLink(`${window.location.origin}/room/${roomId}`);
  }, [roomId]);

  const copyToClipboard = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;
    
    setInviteStatus('loading');
    try {
      // Find the user by username
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', inviteUsername.trim())
        .single();
        
      if (!profile) {
        setInviteStatus('error');
        setInviteMsg('User not found');
        return;
      }
      
      // Add them as a member
      const { error } = await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: profile.id,
          username: inviteUsername.trim(),
          role: 'editor',
          status: 'active',
          color: '#6C63FF' // Default color
        });
        
      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          setInviteStatus('error');
          setInviteMsg('User is already a member or pending');
        } else {
          throw error;
        }
      } else {
        setInviteStatus('success');
        setInviteMsg('Invited successfully!');
        setInviteUsername('');
        setTimeout(() => setInviteStatus('idle'), 3000);
      }
    } catch (err: any) {
      console.error('Invite Error:', err?.message || err);
      setInviteStatus('error');
      setInviteMsg('Failed to invite user');
    }
  };

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-6 w-full flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-bold text-neo-accent mb-2">Share Link</h3>
        <Button onClick={copyToClipboard} className="w-full font-bold">
          {copied ? '✓ Link Copied!' : 'Copy Link'}
        </Button>
      </div>

      {canInvite && (
        <div>
          <h3 className="text-sm font-bold text-neo-accent mb-2">Invite User</h3>
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="text"
              placeholder="Username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              className="neo-input flex-1 text-sm py-2 px-3"
            />
            <Button type="submit" disabled={inviteStatus === 'loading' || !inviteUsername.trim()} className="px-3">
              {inviteStatus === 'loading' ? '...' : 'Add'}
            </Button>
          </form>
          {inviteStatus !== 'idle' && (
            <p className={`text-xs mt-2 ${inviteStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {inviteMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
