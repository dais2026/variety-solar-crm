import { useState, useEffect, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';

interface UnreadMessage {
  id: number;
  phone: string;
  message: string;
  contactName: string | null;
  createdAt: number;
}

export function useUnreadSms() {
  const [hasUnread, setHasUnread] = useState(false);
  const [newMessages, setNewMessages] = useState<UnreadMessage[]>([]);
  const lastSeenTimestamp = useRef<number>(Date.now());
  const dismissedIds = useRef<Set<number>>(new Set());

  // Poll inbox every 15 seconds regardless of which tab is active
  const inboxQuery = trpc.sms.getInbox.useQuery(
    { limit: 5, offset: 0 },
    { refetchInterval: 15000 }
  );

  useEffect(() => {
    if (!inboxQuery.data?.logs) return;

    const logs = inboxQuery.data.logs;
    // Find messages that arrived after our last seen timestamp and haven't been dismissed
    const unread = logs.filter(
      (log) => log.createdAt > lastSeenTimestamp.current && !dismissedIds.current.has(log.id)
    );

    if (unread.length > 0) {
      setHasUnread(true);
      setNewMessages(unread.map(log => ({
        id: log.id,
        phone: log.phone,
        message: log.message,
        contactName: log.contactName,
        createdAt: log.createdAt,
      })));
    }
  }, [inboxQuery.data]);

  // Called when user opens the Received/Inbox sub-tab — clears unread state
  const markAsRead = useCallback(() => {
    setHasUnread(false);
    setNewMessages([]);
    lastSeenTimestamp.current = Date.now();
    dismissedIds.current.clear();
  }, []);

  const dismissNotification = useCallback((id: number) => {
    dismissedIds.current.add(id);
    setNewMessages(prev => {
      const updated = prev.filter(m => m.id !== id);
      if (updated.length === 0) {
        // Don't clear hasUnread here — dot stays until inbox is opened
      }
      return updated;
    });
  }, []);

  const dismissAll = useCallback(() => {
    newMessages.forEach(m => dismissedIds.current.add(m.id));
    setNewMessages([]);
    // Keep hasUnread true so the dot stays until they open the inbox
  }, [newMessages]);

  return {
    hasUnread,
    newMessages,
    dismissNotification,
    dismissAll,
    markAsRead,
  };
}
