/**
 * Claude API Communication Hook
 * Handles API requests, response parsing, and state management
 */

import { useState, useCallback } from 'react';
import type { Message, Conversation, Character, UsageStats, APIRequestBody, APIResponse } from '../types';
import { generateId, getTimestamp } from '../lib/utils';
import { ANTHROPIC_API_URL, DEFAULT_MAX_TOKENS } from '../constants';

interface UseClaudeAPIOptions {
  selectedModel: string;
  thinkingEnabled: boolean;
  thinkingBudget: number;
  getCharacterById: (id: string) => Character | undefined;
  getEffectiveCharacter: (character: Character | null | undefined) => Character | null;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  buildSystemPrompt: (conversation: Conversation, forcedNextSpeaker?: string | null, messages?: Message[]) => string;
  parseMultiCharacterResponse: (
    responseText: string,
    conversation: Conversation,
    thinkingContent?: string,
    responseGroupId?: string | null
  ) => { messages: Message[]; characterUpdates: Record<string, any> };
  generateConversationTitle: (messages: Message[]) => string;
}

export const useClaudeAPI = (options: UseClaudeAPIOptions) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    inputTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    totalCost: 0,
  });

  /**
   * Generate response from Claude API
   */
  const generateResponse = useCallback(
    async (
      messages: Message[],
      conversation: Conversation,
      currentConversationId: string | null,
      usePrefill: boolean = false,
      customPrefill: string | null = null,
      forcedNextSpeaker: string | null = null,
      prefillText: string = ''
    ): Promise<boolean> => {
      setIsLoading(true);
      setError('');

      try {
        if (!conversation) {
          throw new Error('会話が選択されていません');
        }

        if (conversation.participantIds.length === 0) {
          throw new Error('キャラクターが登録されていません');
        }

        const systemPrompt = options.buildSystemPrompt(conversation, forcedNextSpeaker, messages);

        // Check which features are enabled
        const participants = conversation.participantIds
          .map((id) => options.getCharacterById(id))
          .map((c) => options.getEffectiveCharacter(c))
          .filter((c) => c) as Character[];

        const hasAutoEmotion = participants.some(
          (c) => c.features.emotionEnabled && c.features.autoManageEmotion
        );
        const hasAutoAffection = participants.some(
          (c) => c.features.affectionEnabled && c.features.autoManageAffection
        );

        // Sanitize and format messages for API
        const sanitizedMessages = messages
          .filter((msg) => {
            // Exclude narration if disabled
            if (!conversation.narrationEnabled && msg.type === 'narration') {
              return false;
            }
            return true;
          })
          .map((msg) => {
            let messageContent = msg.content;

            // Format character messages with tags
            if (msg.type === 'character' && msg.role === 'assistant') {
              // Remove existing tags
              messageContent = messageContent.replace(/\[EMOTION:\w+\]\s*/g, '');
              messageContent = messageContent.replace(/\[AFFECTION:\d+\]\s*/g, '');
              messageContent = messageContent.trim();

              // Add tags if features are enabled
              const tagsToAdd: string[] = [];

              if (hasAutoEmotion && msg.emotion) {
                tagsToAdd.push(`[EMOTION:${msg.emotion}]`);
              }

              if (hasAutoAffection && msg.affection !== null && msg.affection !== undefined) {
                tagsToAdd.push(`[AFFECTION:${msg.affection}]`);
              }

              if (tagsToAdd.length > 0) {
                messageContent = messageContent + '\n' + tagsToAdd.join('\n');
              }
            } else {
              // Remove tags from user and narration messages
              messageContent = messageContent.replace(/\[EMOTION:\w+\]\s*/g, '');
              messageContent = messageContent.replace(/\[AFFECTION:\d+\]\s*/g, '');
            }

            messageContent = messageContent.trim();

            let content = '';
            if (msg.type === 'narration') {
              content = `[NARRATION]\n${messageContent}`;
            } else if (msg.type === 'user') {
              content = `[USER]\n${messageContent}`;
            } else {
              const char = options.getCharacterById(msg.characterId || '');
              const charName = char?.name || 'Unknown';
              content = `[CHARACTER:${charName}]\n${messageContent}`;
            }

            return {
              role: msg.role || (msg.type === 'user' || msg.type === 'narration' ? 'user' : 'assistant'),
              content: content,
            };
          });

        // Merge consecutive messages with same role
        const mergedMessages: Array<{ role: string; content: string }> = [];
        for (let i = 0; i < sanitizedMessages.length; i++) {
          const current = sanitizedMessages[i];

          if (
            mergedMessages.length > 0 &&
            mergedMessages[mergedMessages.length - 1].role === current.role
          ) {
            mergedMessages[mergedMessages.length - 1].content += '\n\n' + current.content;
          } else {
            mergedMessages.push({ ...current });
          }
        }

        const finalMessages = [...mergedMessages];

        // Add prefill if specified
        let prefillToUse = customPrefill !== null ? customPrefill : usePrefill ? prefillText : '';
        prefillToUse = prefillToUse.trim() === '' ? '' : prefillToUse.trimEnd();

        if (prefillToUse) {
          finalMessages.push({
            role: 'assistant',
            content: prefillToUse,
          });
        }

        const requestBody: APIRequestBody = {
          model: options.selectedModel,
          max_tokens: DEFAULT_MAX_TOKENS,
          messages: finalMessages as any,
          system: systemPrompt,
        };

        if (options.thinkingEnabled) {
          requestBody.thinking = {
            type: 'enabled',
            budget_tokens: options.thinkingBudget,
          };
        }

        const response = await fetch(`${ANTHROPIC_API_URL}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          if (response.status === 429) {
            throw new Error('レート制限に達しました。しばらく待ってから再試行してください。');
          }
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data: APIResponse = await response.json();

        // Update usage stats
        if (data.usage) {
          setUsageStats((prev) => ({
            inputTokens: prev.inputTokens + (data.usage.input_tokens ?? 0),
            outputTokens: prev.outputTokens + (data.usage.output_tokens ?? 0),
            thinkingTokens: prev.thinkingTokens,
            totalCost: prev.totalCost,
          }));
        }

        // Extract content
        let textContent = '';
        let thinkingContent = '';

        data.content.forEach((block) => {
          if (block.type === 'thinking' && block.thinking) {
            thinkingContent = block.thinking;
          } else if (block.type === 'text' && block.text) {
            textContent = block.text;
          }
        });

        const fullContent = prefillToUse ? prefillToUse + textContent : textContent;

        // Generate unique group ID for this response
        const responseGroupId = generateId();

        // Parse response into messages
        const { messages: parsedMessages, characterUpdates } =
          options.parseMultiCharacterResponse(fullContent, conversation, thinkingContent, responseGroupId);

        // Apply character updates
        if (Object.keys(characterUpdates).length > 0) {
          Object.entries(characterUpdates).forEach(([charId, updates]) => {
            const char = options.getCharacterById(charId);
            if (char) {
              const featureUpdates = { ...char.features };

              if ((updates as any).emotion && char.features.autoManageEmotion) {
                featureUpdates.currentEmotion = (updates as any).emotion;
              }

              if ((updates as any).affection !== undefined && char.features.autoManageAffection) {
                featureUpdates.affectionLevel = (updates as any).affection;
              }

              options.updateCharacter(charId, { features: featureUpdates });
            }
          });
        }

        const updatedMessages = [...messages, ...parsedMessages];

        // Auto-generate title if still default
        const newTitle =
          conversation.title === '新しい会話' && updatedMessages.length >= 2
            ? options.generateConversationTitle(updatedMessages)
            : conversation.title;

        if (currentConversationId) {
          options.updateConversation(currentConversationId, {
            messages: updatedMessages,
            title: newTitle,
          });
        }

        return true;
      } catch (err: any) {
        setError(err.message || 'エラーが発生しました');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [options]
  );

  /**
   * Fetch available models from Anthropic API
   */
  const fetchModels = useCallback(async () => {
    try {
      const response = await fetch(`${ANTHROPIC_API_URL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (err: any) {
      console.error('Failed to fetch models:', err);
      return [];
    }
  }, []);

  return {
    isLoading,
    error,
    usageStats,
    generateResponse,
    fetchModels,
    setError,
    setUsageStats,
  };
};
