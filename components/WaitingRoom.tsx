'use client';

import React from 'react';

export const WaitingRoom: React.FC<{ message?: string; onCancel?: () => void }> = ({ message, onCancel }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="neo-card w-full max-w-md text-center">
        <h1 className="text-4xl text-neo-accent mb-4" style={{ fontFamily: 'var(--font-brushy)' }}>
          Chitra
        </h1>

        {/* Animated waiting indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-neo-accent"
                style={{
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
        </div>

        <h2 className="text-xl font-bold text-neo-text mb-2">Waiting for Approval</h2>
        <p className="text-sm text-neo-text/60 mb-8">
          {message || 'The room owner needs to approve your request before you can enter.'}
        </p>

        <div className="bg-neo-bg rounded-neo shadow-neo-inset p-4 mb-6">
          <p className="text-xs text-neo-text/40">
            You will be automatically redirected once approved. Please keep this page open.
          </p>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="neo-button opacity-75 text-sm"
          >
            Cancel & Leave
          </button>
        )}

        <style jsx>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1.0); }
          }
        `}</style>
      </div>
    </div>
  );
};
