/**
 * Message Management Hook
 * Handles message editing, deletion, regeneration, and version switching
 */

import { useState, useCallback } from 'react';
import type { Message } from '../types';

interface UseMessageManagerOptions {
  updateConversation: (conversationId: string, updates: any) => void;
  forkConversation: (conversationId: string, messageIndex: number) => string | null;
}

export const useMessageManager = (options: UseMessageManagerOptions) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [editingEmotion, setEditingEmotion] = useState<string | null>(null);
  const [editingAffection, setEditingAffection] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState<Record<number, boolean>>({});

  /**
   * Start editing a message
   */
  const handleEdit = useCallback(
    (index: number, messages: Message[]) => {
      const message = messages[index];
      if (!message) return;

      setEditingIndex(index);
      setEditingContent(message.content);
      setEditingEmotion(message.emotion || null);
      setEditingAffection(
        message.affection !== undefined && message.affection !== null ? message.affection : null
      );
    },
    []
  );

  /**
   * Save edited message
   */
  const handleSaveEdit = useCallback(
    (index: number, conversationId: string | null, messages: Message[]) => {
      if (!conversationId) return;

      const updated = [...messages];
      if (!updated[index]) return;

      updated[index].content = editingContent;
      updated[index].emotion = editingEmotion || undefined;
      updated[index].affection = editingAffection !== null ? editingAffection : undefined;

      options.updateConversation(conversationId, {
        messages: updated,
      });

      setEditingIndex(null);
      setEditingEmotion(null);
      setEditingAffection(null);
    },
    [editingContent, editingEmotion, editingAffection, options]
  );

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingEmotion(null);
    setEditingAffection(null);
  }, []);

  /**
   * Delete a message
   */
  const handleDelete = useCallback(
    (index: number, conversationId: string | null, messages: Message[]) => {
      if (!conversationId) return;

      const updated = messages.filter((_, i) => i !== index);

      options.updateConversation(conversationId, {
        messages: updated,
      });
    },
    [options]
  );

  /**
   * Fork conversation at a specific message
   */
  const handleFork = useCallback(
    (index: number, conversationId: string | null) => {
      if (!conversationId) return;
      options.forkConversation(conversationId, index);
    },
    [options]
  );

  /**
   * Switch message version (alternative)
   */
  const handleSwitchVersion = useCallback(
    (
      index: number,
      alternativeId: string,
      conversationId: string | null,
      messages: Message[]
    ) => {
      if (!conversationId) return;

      const updated = [...messages];
      const message = updated[index];
      if (!message || !message.alternatives) return;

      // Find the alternative
      const alternative = message.alternatives.find((alt) => alt.id === alternativeId);
      if (!alternative) return;

      // Create new alternative from current message
      const newAlternative = {
        id: message.id,
        content: message.content,
        emotion: message.emotion,
        affection: message.affection,
        thinking: message.thinking,
        isActive: false,
      };

      // Update alternatives array
      const updatedAlternatives = message.alternatives.map((alt) =>
        alt.id === alternativeId
          ? { ...alt, isActive: true }
          : { ...alt, isActive: false }
      );

      // Add current message as alternative if it's not already there
      const currentExists = updatedAlternatives.some((alt) => alt.id === message.id);
      if (!currentExists) {
        updatedAlternatives.push(newAlternative);
      }

      // Update message with selected alternative
      updated[index] = {
        ...message,
        id: alternativeId,
        content: alternative.content,
        emotion: alternative.emotion,
        affection: alternative.affection,
        thinking: alternative.thinking,
        alternatives: updatedAlternatives,
      };

      options.updateConversation(conversationId, {
        messages: updated,
      });
    },
    [options]
  );

  /**
   * Toggle version display for a message
   */
  const toggleVersionDisplay = useCallback((index: number) => {
    setShowVersions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(
    (currentCount: number, increment: number): number => {
      return currentCount + increment;
    },
    []
  );

  return {
    // Editing state
    editingIndex,
    editingContent,
    editingEmotion,
    editingAffection,
    setEditingContent,
    setEditingEmotion,
    setEditingAffection,

    // Version display state
    showVersions,

    // Actions
    handleEdit,
    handleSaveEdit,
    handleCancelEdit,
    handleDelete,
    handleFork,
    handleSwitchVersion,
    toggleVersionDisplay,
    loadMoreMessages,
  };
};
