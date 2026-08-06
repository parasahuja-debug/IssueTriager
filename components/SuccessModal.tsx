"use client";

import { useEffect } from "react";

type SuccessModalProps = {
  message: string;
  isOpen: boolean;
  onClose: () => void;
};

// SuccessModal displays a centered modal dialog with a success message.
// Auto-closes after 3 seconds or when user clicks close button.
export function SuccessModal({ message, isOpen, onClose }: SuccessModalProps) {
  // Auto-close after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card border border-glow rounded-lg px-6 py-4 max-w-sm w-full shadow-lg">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-inkDim hover:text-ink-text text-xl leading-none"
        >
          ×
        </button>

        {/* Success message with checkmark icon */}
        <div className="flex items-center gap-3">
          <span className="text-2xl text-glow">✓</span>
          <div className="text-sm text-ink-text">{message}</div>
        </div>
      </div>
    </div>
  );
}
