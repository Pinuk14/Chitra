'use client';

import React, { useState } from 'react';
import { ACTION_LABELS, type Action } from '@/lib/security/permissions';

interface PermissionDeniedDialogProps {
  action: Action;
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission: (action: Action) => Promise<void>;
}

export const PermissionDeniedDialog: React.FC<PermissionDeniedDialogProps> = ({
  action,
  isOpen,
  onClose,
  onRequestPermission,
}) => {
  const [requested, setRequested] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isOpen) return null;

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      await onRequestPermission(action);
      setRequested(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleClose = () => {
    setRequested(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative neo-card w-full max-w-sm text-center animate-in">
        <div className="flex justify-center mb-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neo-text">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h3 className="text-lg font-bold text-neo-text mb-2">Permission Required</h3>
        <p className="text-sm text-neo-text/60 mb-6">
          This action requires <span className="font-bold text-neo-accent">{ACTION_LABELS[action]}</span> permission.
        </p>

        {requested ? (
          <div className="bg-neo-accent/10 rounded-neo p-3 mb-4">
            <p className="text-sm text-neo-accent font-medium">
              ✓ Permission request sent! An admin will review it.
            </p>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleRequest}
              disabled={isRequesting}
              className="neo-button flex-1 font-bold text-sm disabled:opacity-50"
            >
              {isRequesting ? 'Sending...' : 'Request Permission'}
            </button>
            <button
              onClick={handleClose}
              className="neo-button opacity-75 flex-1 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {requested && (
          <button onClick={handleClose} className="neo-button mt-3 w-full text-sm opacity-75">
            Close
          </button>
        )}

        <style jsx>{`
          .animate-in {
            animation: dialogIn 0.3s ease-out;
          }
          @keyframes dialogIn {
            from { opacity: 0; transform: scale(0.9) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
};
