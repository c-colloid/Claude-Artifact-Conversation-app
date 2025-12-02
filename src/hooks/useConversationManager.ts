/**
 * Conversation Management Hook
 * Handles conversation CRUD operations, forking, and message management
 */

import { useState, useCallback, useMemo } from 'react';
import type { Conversation } from '../types';
import { generateId, createTimestamps, getTimestamp } from '../lib/utils';

export const useConversationManager = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  /**
   * Get default conversation template
   */
  const getDefaultConversation = useCallback((): Conversation => {
    return {
      id: generateId(),
      title: '新しい会話',
      participantIds: [],
      backgroundInfo: '',
      narrationEnabled: true,
      autoGenerateNarration: false,
      relationships: [],
      parentConversationId: null,
      forkPoint: null,
      messages: [],
      ...createTimestamps(),
    };
  }, []);

  /**
   * Get current conversation (memoized)
   */
  const getCurrentConversation = useMemo(() => {
    return conversations.find((c) => c.id === currentConversationId);
  }, [conversations, currentConversationId]);

  /**
   * Get conversation by ID
   */
  const getConversationById = useCallback(
    (id: string): Conversation | undefined => {
      return conversations.find((c) => c.id === id);
    },
    [conversations]
  );

  /**
   * Create new conversation
   */
  const createNewConversation = useCallback(() => {
    const newConv = getDefaultConversation();
    setConversations((prev) => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    return newConv.id;
  }, [getDefaultConversation]);

  /**
   * Update conversation
   */
  const updateConversation = useCallback((conversationId: string, updates: Partial<Conversation>) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, ...updates, updated: getTimestamp() } : conv
      )
    );
  }, []);

  /**
   * Fork conversation at a specific message
   */
  const forkConversation = useCallback(
    (conversationId: string, messageIndex: number): string | null => {
      const originalConv = conversations.find((c) => c.id === conversationId);
      if (!originalConv) return null;

      // Verify message array exists and messageIndex is valid
      const originalMessages = originalConv.messages || [];
      if (messageIndex < 0 || messageIndex >= originalMessages.length) {
        console.error(
          `Invalid messageIndex: ${messageIndex}, messages length: ${originalMessages.length}`
        );
        return null;
      }

      // Deep copy messages up to fork point
      const forkedMessages = originalMessages.slice(0, messageIndex + 1).map((msg) => ({ ...msg }));

      const forkedConv: Conversation = {
        ...getDefaultConversation(),
        title: `${originalConv.title}（分岐${messageIndex + 1}）`,
        participantIds: [...originalConv.participantIds],
        backgroundInfo: originalConv.backgroundInfo,
        narrationEnabled: originalConv.narrationEnabled,
        autoGenerateNarration: originalConv.autoGenerateNarration,
        relationships: originalConv.relationships ? [...originalConv.relationships] : [],
        parentConversationId: conversationId,
        forkPoint: messageIndex,
        messages: forkedMessages,
      };

      setConversations((prev) => [...prev, forkedConv]);
      setCurrentConversationId(forkedConv.id);
      return forkedConv.id;
    },
    [conversations, getDefaultConversation]
  );

  /**
   * Delete conversation
   */
  const deleteConversation = useCallback(
    (conversationId: string, onConfirm?: () => void) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));

      // If deleted conversation was current, switch to another or create new
      if (currentConversationId === conversationId) {
        const remaining = conversations.filter((c) => c.id !== conversationId);
        if (remaining.length > 0) {
          setCurrentConversationId(remaining[0].id);
        } else {
          createNewConversation();
        }
      }

      if (onConfirm) onConfirm();
    },
    [conversations, currentConversationId, createNewConversation]
  );

  /**
   * Duplicate conversation
   */
  const duplicateConversation = useCallback(
    (conversationId: string): string | null => {
      const original = getConversationById(conversationId);
      if (!original) return null;

      const duplicate: Conversation = {
        ...original,
        id: generateId(),
        title: `${original.title} (コピー)`,
        parentConversationId: null,
        forkPoint: null,
        messages: original.messages.map((msg) => ({ ...msg, id: generateId() })),
        ...createTimestamps(),
      };

      setConversations((prev) => [...prev, duplicate]);
      setCurrentConversationId(duplicate.id);
      return duplicate.id;
    },
    [getConversationById]
  );

  /**
   * Set current conversation
   */
  const switchConversation = useCallback((conversationId: string | null) => {
    setCurrentConversationId(conversationId);
  }, []);

  /**
   * Set all conversations (for loading from storage)
   */
  const setAllConversations = useCallback((newConversations: Conversation[]) => {
    setConversations(newConversations);
  }, []);

  /**
   * Get sorted conversations (by updated date, newest first)
   */
  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
  }, [conversations]);

  return {
    conversations,
    currentConversationId,
    getCurrentConversation,
    sortedConversations,
    getConversationById,
    createNewConversation,
    updateConversation,
    forkConversation,
    deleteConversation,
    duplicateConversation,
    switchConversation,
    setCurrentConversationId,
    setAllConversations,
  };
};
