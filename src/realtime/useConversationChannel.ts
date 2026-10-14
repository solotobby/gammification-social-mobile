import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api/client';
import { handleCallSignal } from '../calls/callEngine';
import { receiveRealtimeMessage, receiveRealtimeRead, threadKey } from '../hooks/useMessages';
import { useAuthStore } from '../stores/authStore';
import { useChannel, useRealtimeStore } from './socket';

/** Their "typing…" clears itself if no update arrives in this long. */
const TYPING_EXPIRY_MS = 6_000;
/** While we keep typing, `is_typing: true` is re-sent no more often than this. */
const TYPING_RESEND_MS = 3_000;
/** We count as stopped after this long without a keystroke. */
const TYPING_IDLE_MS = 4_000;

/**
 * An open thread's live channel — `private-conversation.{id}`.
 *
 * - `message.sent` drops the message straight into the thread cache.
 * - `messages.read` turns our ticks to read.
 * - `user.typing` drives "typing…". The payload (verified 2026-10-14) is
 *   `{conversation_id, user: {id, name, username}, is_typing}` — a nested
 *   `user`, not the guide's `user_id` / `user_name`.
 * - `call.signal` arrives here too for calls in this conversation; the call
 *   engine dedupes it against the copy on `private-user.{id}`.
 *
 * `subscribed` reports whether the channel is actually up, so the thread's
 * polling can drop to a slow safety net only when events are really flowing.
 * Each (re)subscribe re-reads the thread once, to catch anything said while
 * the socket was down.
 */
export function useConversationChannel(conversationId: string | undefined) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user?.id);
  const [subscribed, setSubscribed] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPeerTyping = useCallback(() => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    setPeerTyping(false);
  }, []);

  useChannel(conversationId ? `private-conversation.${conversationId}` : null, {
    'pusher:subscription_succeeded': () => {
      setSubscribed(true);
      if (conversationId) void queryClient.invalidateQueries({ queryKey: threadKey(conversationId) });
    },
    'pusher:subscription_error': () => setSubscribed(false),
    'message.sent': (data) => {
      receiveRealtimeMessage(queryClient, data);
      if (data?.message?.user_id && data.message.user_id !== me) clearPeerTyping();
    },
    'messages.read': (data) => receiveRealtimeRead(queryClient, data),
    'user.typing': (data) => {
      const who = data?.user?.id ?? data?.user_id;
      if (!who || who === me) return;
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (data.is_typing) {
        setPeerTyping(true);
        typingTimer.current = setTimeout(() => setPeerTyping(false), TYPING_EXPIRY_MS);
      } else {
        typingTimer.current = null;
        setPeerTyping(false);
      }
    },
    'call.signal': handleCallSignal,
  });

  // A dropped socket means the channel is gone until it resubscribes.
  useEffect(
    () =>
      useRealtimeStore.subscribe((state) => {
        if (state.state !== 'connected') setSubscribed(false);
      }),
    [],
  );
  useEffect(() => {
    setSubscribed(false);
    clearPeerTyping();
  }, [conversationId, clearPeerTyping]);
  useEffect(() => () => clearPeerTyping(), [clearPeerTyping]);

  // --- Our side of "typing…" -------------------------------------------------

  const lastSentAt = useRef(0);
  const sentTyping = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversationId) return;
      void api
        .post(`/conversations/${conversationId}/typing`, { is_typing: isTyping })
        .catch(() => {
          // Typing is decoration; never surface a failure.
        });
    },
    [conversationId],
  );

  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    if (sentTyping.current) {
      sentTyping.current = false;
      lastSentAt.current = 0;
      sendTyping(false);
    }
  }, [sendTyping]);

  /** Call on every keystroke with the draft's new text. */
  const onDraftChange = useCallback(
    (text: string) => {
      if (!text.trim()) {
        stopTyping();
        return;
      }
      // Only worth announcing while someone could be listening.
      if (!subscribed) return;
      const now = Date.now();
      if (!sentTyping.current || now - lastSentAt.current > TYPING_RESEND_MS) {
        sentTyping.current = true;
        lastSentAt.current = now;
        sendTyping(true);
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    },
    [sendTyping, stopTyping, subscribed],
  );

  // Leaving the thread mid-sentence shouldn't leave them watching "typing…".
  useEffect(() => stopTyping, [stopTyping]);

  return { subscribed, peerTyping, onDraftChange, stopTyping };
}
