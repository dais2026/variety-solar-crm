import { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';

interface SmsNotification {
  id: string;
  phone: string;
  message: string;
  contactName?: string;
  timestamp: number;
}

interface SmsNotificationToastProps {
  notifications: SmsNotification[];
  onDismiss: (id: string) => void;
  onViewInbox: () => void;
}

export default function SmsNotificationToast({ notifications, onDismiss, onViewInbox }: SmsNotificationToastProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className="bg-[#1A1A1A] border border-[#F5A623]/30 rounded-xl p-4 shadow-lg shadow-[#F5A623]/5 animate-slide-in"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F5A623]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <MessageSquare size={14} className="text-[#F5A623]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[#F5A623] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                  New SMS Received
                </p>
                <button
                  onClick={() => onDismiss(notif.id)}
                  className="text-[#7A7B80] hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-white text-sm font-semibold truncate" style={{ fontFamily: 'General Sans' }}>
                {notif.contactName || notif.phone}
              </p>
              <p className="text-[#B0B1B5] text-xs mt-1 line-clamp-2 leading-relaxed" style={{ fontFamily: 'General Sans' }}>
                {notif.message}
              </p>
              <button
                onClick={onViewInbox}
                className="text-[#F5A623] text-xs mt-2 hover:underline font-medium"
                style={{ fontFamily: 'General Sans' }}
              >
                View in Inbox →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export type { SmsNotification };
