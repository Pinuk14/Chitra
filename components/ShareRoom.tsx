'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './ui/Button';

export const ShareRoom: React.FC<{ roomId: string }> = ({ roomId }) => {
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');

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

  return (
    <div className="bg-neo-bg rounded-neo shadow-neo-sm p-6 w-full">
      <h3 className="text-sm font-bold text-neo-accent mb-4">Invite Collaborators</h3>
      <div className="flex flex-col gap-3">
        <Button onClick={copyToClipboard} className="w-full font-bold">
          {copied ? '✓ Link Copied!' : 'Copy Invite Link'}
        </Button>
      </div>
    </div>
  );
};
