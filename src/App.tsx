/**
 * Main Application Component
 * Multi-character conversation app with Claude API integration
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { Character, Conversation, Message } from './types';
import { EMOTIONS } from './constants';
import { generateId, getTimestamp } from './lib/utils';
import { useCharacterManager } from './hooks/useCharacterManager';
import { useConversationManager } from './hooks/useConversationManager';
import { useStorage } from './hooks/useStorage';
import { useMessageManager } from './hooks/useMessageManager';
import { useClaudeAPI } from './hooks/useClaudeAPI';

// UI Components
import ConfirmDialog from './components/ConfirmDialog';
import ConversationCard from './components/ConversationCard';
import ConversationSettings from './components/ConversationSettings';
import MessageBubble from './components/MessageBubble';

const MultiCharacterChat: React.FC = () => {
  // ===== State管理 =====
  const [isInitialized, setIsInitialized] = useState(false);
  const [showConversationSettings, setShowConversationSettings] = useState(false);
  const [confirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Message input state
  const [userPrompt, setUserPrompt] = useState('');
  const [messageType, setMessageType] = useState<'user' | 'narration'>('user');
  const [nextSpeaker] = useState<string | null>(null);
  const [prefillText] = useState('');

  // Model settings
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(2000);

  // UI state
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({});
  const [showVersions, setShowVersions] = useState<Record<number, boolean>>({});
  const [showRegeneratePrefill, setShowRegeneratePrefill] = useState<number | null>(null);
  const [regeneratePrefill, setRegeneratePrefill] = useState('');
  const [editingConversationTitle, setEditingConversationTitle] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // ===== Custom Hooks =====
  const characterManager = useCharacterManager();
  const conversationManager = useConversationManager();
  const messageManager = useMessageManager({
    updateConversation: conversationManager.updateConversation,
    forkConversation: conversationManager.forkConversation,
  });

  // ===== Business Logic Functions =====

  /**
   * Parse multi-character response from Claude API
   */
  const parseMultiCharacterResponse = useCallback(
    (
      responseText: string,
      conversation: Conversation,
      thinkingContent?: string,
      responseGroupId?: string | null
    ): { messages: Message[]; characterUpdates: Record<string, any> } => {
      const messages: Message[] = [];
      const characterUpdates: Record<string, any> = {};
      const lines = responseText.split('\n');
      let currentType: string | null = null;
      let currentCharacterId: string | null = null;
      let currentContent: string[] = [];
      let thinkingAdded = false;

      const finishCurrentMessage = () => {
        if (currentContent.length > 0) {
          let content = currentContent.join('\n').trim();
          let emotion: string | undefined;
          let affection: number | undefined;

          if (content) {
            // Extract emotion tag
            const emotionMatch = content.match(/\[EMOTION:(\w+)\]/);
            if (emotionMatch && EMOTIONS[emotionMatch[1]]) {
              emotion = emotionMatch[1];
              content = content.replace(/\[EMOTION:\w+\]/, '').trim();
            }

            // Extract affection tag
            const affectionMatch = content.match(/\[AFFECTION:(\d+)\]/);
            if (affectionMatch) {
              const value = parseInt(affectionMatch[1]);
              affection = Math.max(0, Math.min(100, value));
              content = content.replace(/\[AFFECTION:\d+\]/, '').trim();
            }

            // Collect character state updates
            if (currentCharacterId && (emotion || affection !== undefined)) {
              if (!characterUpdates[currentCharacterId]) {
                characterUpdates[currentCharacterId] = {};
              }
              if (emotion) {
                characterUpdates[currentCharacterId].emotion = emotion;
              }
              if (affection !== undefined) {
                characterUpdates[currentCharacterId].affection = affection;
              }
            }

            const messageId = generateId();
            const timestamp = getTimestamp();

            messages.push({
              id: messageId,
              role: 'assistant',
              type: (currentType as any) || 'character',
              characterId: currentCharacterId || undefined,
              content: content,
              emotion: emotion,
              affection: affection,
              thinking: !thinkingAdded && thinkingContent ? thinkingContent : undefined,
              timestamp: timestamp,
              responseGroupId: responseGroupId || undefined,
              alternatives: [
                {
                  id: generateId(),
                  content: content,
                  emotion: emotion,
                  affection: affection,
                  thinking: !thinkingAdded && thinkingContent ? thinkingContent : undefined,
                  timestamp: timestamp,
                  isActive: true,
                },
              ],
            });
            thinkingAdded = true;
          }
        }
        currentContent = [];
      };

      for (const line of lines) {
        // Check for [CHARACTER:name] tag
        const charMatch = line.match(/^\[CHARACTER:([^\]]+)\]/);
        if (charMatch) {
          finishCurrentMessage();
          const charName = charMatch[1].trim();
          const char = conversation.participantIds
            .map((id) => characterManager.getCharacterById(id))
            .find((c) => c?.name === charName);

          currentType = 'character';
          currentCharacterId = char?.id ?? null;

          const restOfLine = line.replace(/^\[CHARACTER:[^\]]+\]\s*/, '');
          if (restOfLine) {
            currentContent.push(restOfLine);
          }
          continue;
        }

        // Check for [NARRATION] tag
        const narrationMatch = line.match(/^\[NARRATION\]/);
        if (narrationMatch) {
          finishCurrentMessage();
          currentType = 'narration';
          currentCharacterId = null;

          const restOfLine = line.replace(/^\[NARRATION\]\s*/, '');
          if (restOfLine) {
            currentContent.push(restOfLine);
          }
          continue;
        }

        // Regular line - add to current content
        currentContent.push(line);
      }

      // Finish the last message
      finishCurrentMessage();

      // If no messages were parsed (no tags found), treat entire response as one message
      if (messages.length === 0) {
        const anyCharMatch = responseText.match(/\[CHARACTER:([^\]]+)\]/);
        let characterId: string | undefined;
        const messageType = 'character';

        if (anyCharMatch) {
          const charName = anyCharMatch[1].trim();
          const char = conversation.participantIds
            .map((id) => characterManager.getCharacterById(id))
            .find((c) => c?.name === charName);
          characterId = char?.id;
        }

        const cleanContent = responseText
          .replace(/\[CHARACTER:[^\]]+\]|\[NARRATION\]|\[EMOTION:\w+\]|\[AFFECTION:\d+\]/g, '')
          .trim();

        const messageId = generateId();
        const timestamp = getTimestamp();

        messages.push({
          id: messageId,
          role: 'assistant',
          type: messageType,
          characterId: characterId,
          content: cleanContent,
          thinking: thinkingContent,
          timestamp: timestamp,
          responseGroupId: responseGroupId || undefined,
          alternatives: [
            {
              id: generateId(),
              content: cleanContent,
              emotion: undefined,
              affection: undefined,
              thinking: thinkingContent,
              timestamp: timestamp,
              isActive: true,
            },
          ],
        });
      }

      return { messages, characterUpdates };
    },
    [characterManager]
  );

  /**
   * Build system prompt for Claude API
   */
  const buildSystemPrompt = useCallback(
    (conversation: Conversation, forcedNextSpeaker?: string | null, messages?: Message[]): string => {
      if (!conversation) return '';

      const participants = conversation.participantIds
        .map((id) => characterManager.getCharacterById(id))
        .map((c) => characterManager.getEffectiveCharacter(c))
        .filter((c) => c) as Character[];

      if (participants.length === 0) return '';

      let prompt = `# マルチキャラクター会話システム\n\n`;
      prompt += `この会話には以下のキャラクターが参加しています:\n\n`;

      participants.forEach((char, idx) => {
        const def = char.definition;
        const feat = char.features;
        prompt += `## ${idx + 1}. ${char.name}\n`;
        prompt += `- 性格: ${def.personality}\n`;
        prompt += `- 話し方: ${def.speakingStyle}\n`;
        prompt += `- 一人称: ${def.firstPerson}\n`;
        prompt += `- 二人称: ${def.secondPerson}\n`;
        if (def.background) prompt += `- 背景: ${def.background}\n`;
        if (def.catchphrases && def.catchphrases.length > 0) {
          prompt += `- 口癖: ${def.catchphrases.join('、')}\n`;
        }
        if (feat.emotionEnabled) {
          prompt += `- 現在の感情: ${EMOTIONS[feat.currentEmotion]?.label || '中立'}\n`;
        }
        if (feat.affectionEnabled) {
          prompt += `- 現在の好感度: ${feat.affectionLevel}/100\n`;
        }
        if (def.customPrompt) {
          prompt += `\n### 追加設定\n${def.customPrompt}\n`;
        }
        prompt += `\n`;
      });

      if (conversation.backgroundInfo) {
        prompt += `## 背景情報・シチュエーション\n${conversation.backgroundInfo}\n\n`;
      }

      if (conversation.relationships && conversation.relationships.length > 0) {
        prompt += `## キャラクター間の関係性\n`;
        conversation.relationships.forEach((rel) => {
          const char1 =
            rel.char1Id === '__user__' ? { name: 'ユーザー' } : participants.find((c) => c.id === rel.char1Id);
          const char2 =
            rel.char2Id === '__user__' ? { name: 'ユーザー' } : participants.find((c) => c.id === rel.char2Id);
          if (char1 && char2) {
            prompt += `- ${char1.name} と ${char2.name}: ${rel.type}`;
            if (rel.description) {
              prompt += ` (${rel.description})`;
            }
            prompt += `\n`;
          }
        });
        prompt += `\n`;
      }

      prompt += `## 重要な指示\n\n`;
      prompt += `**タグの使用は必須です。以下のルールを厳密に守ってください:**\n\n`;

      // If next speaker is specified
      if (forcedNextSpeaker) {
        const nextChar = participants.find((c) => c.id === forcedNextSpeaker);
        if (nextChar) {
          prompt += `1. **次は${nextChar.name}として発言してください**\n`;
          prompt += `2. **[CHARACTER:${nextChar.name}] タグを行の先頭に必ず出力してください**\n`;
        }
      } else {
        prompt += `1. 次に発言すべきキャラクターを判断し、そのキャラクターとして発言してください\n`;
        prompt += `2. **[CHARACTER:キャラクター名] タグを行の先頭に必ず出力してください**\n`;
      }

      // Add emotion/affection instructions
      const hasAutoEmotion = participants.some(
        (c) => c.features.emotionEnabled && c.features.autoManageEmotion
      );
      const hasAutoAffection = participants.some(
        (c) => c.features.affectionEnabled && c.features.autoManageAffection
      );

      if (hasAutoEmotion) {
        prompt += `3. 感情表現: 会話の流れに応じて、発言の最後に [EMOTION:感情キー] を出力してください\n`;
        prompt += `   利用可能な感情: ${Object.keys(EMOTIONS).join(', ')}\n`;
      }

      if (hasAutoAffection) {
        prompt += `4. 好感度: 会話内容に応じて、発言の最後に [AFFECTION:数値] を出力してください（0-100）\n`;
      }

      return prompt;
    },
    [characterManager]
  );

  /**
   * Generate conversation title from messages
   */
  const generateConversationTitle = useCallback((messages: Message[]): string => {
    if (messages.length === 0) return '新しい会話';

    // Use first few messages to generate title
    const preview = messages
      .slice(0, 3)
      .map((m) => m.content)
      .join(' ')
      .slice(0, 30);
    return preview || '新しい会話';
  }, []);

  // ===== Claude API Hook =====
  const claudeAPI = useClaudeAPI({
    selectedModel,
    thinkingEnabled,
    thinkingBudget,
    getCharacterById: characterManager.getCharacterById,
    getEffectiveCharacter: characterManager.getEffectiveCharacter,
    updateCharacter: characterManager.updateCharacter,
    updateConversation: conversationManager.updateConversation,
    buildSystemPrompt,
    parseMultiCharacterResponse,
    generateConversationTitle,
  });

  // ===== Storage Hook =====
  const storage = useStorage({
    characters: characterManager.characters,
    characterGroups: [],
    conversations: conversationManager.conversations,
    currentConversationId: conversationManager.currentConversationId,
    selectedModel,
    thinkingEnabled,
    thinkingBudget,
    usageStats: claudeAPI.usageStats,
    autoSaveEnabled: true,
    isInitialized,
    onLoad: (data) => {
      if (data.characters) characterManager.setAllCharacters(data.characters);
      if (data.conversations) conversationManager.setAllConversations(data.conversations);
      if (data.currentConversationId) conversationManager.setCurrentConversationId(data.currentConversationId);
      if (data.selectedModel) setSelectedModel(data.selectedModel);
      if (data.thinkingEnabled !== undefined) setThinkingEnabled(data.thinkingEnabled);
      if (data.thinkingBudget) setThinkingBudget(data.thinkingBudget);
      if (data.usageStats) claudeAPI.setUsageStats(data.usageStats);
    },
  });

  // ===== Initialization =====
  useEffect(() => {
    const initialize = async () => {
      const loaded = await storage.loadFromStorage();
      if (!loaded && conversationManager.conversations.length === 0) {
        conversationManager.createNewConversation();
      }
      setIsInitialized(true);
    };

    initialize();
  }, []); // Run once on mount

  // ===== Auto-save =====
  useEffect(() => {
    if (isInitialized) {
      storage.debouncedSave();
    }
  }, [
    characterManager.characters,
    conversationManager.conversations,
    conversationManager.currentConversationId,
    selectedModel,
    thinkingEnabled,
    thinkingBudget,
    claudeAPI.usageStats,
    isInitialized,
  ]);

  // ===== Event Handlers =====
  const handleSendMessage = async () => {
    const conversation = conversationManager.getCurrentConversation;
    if (!conversation || !userPrompt.trim()) return;

    const newMessage: Message = {
      id: generateId(),
      role: 'user',
      type: messageType,
      content: userPrompt.trim(),
      timestamp: getTimestamp(),
    };

    conversationManager.updateConversation(conversation.id, {
      messages: [...conversation.messages, newMessage],
    });

    setUserPrompt('');

    // Generate response
    await claudeAPI.generateResponse(
      [...conversation.messages, newMessage],
      conversation,
      conversation.id,
      !!prefillText,
      prefillText || null,
      nextSpeaker,
      prefillText
    );
  };

  // ===== Render =====
  const currentConversation = conversationManager.getCurrentConversation;
  const messages = currentConversation?.messages || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="max-w-6xl mx-auto p-4">
        <header className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-indigo-600">Multi-Character Chat</h1>
          <p className="text-gray-600 mt-2">AIキャラクターとの会話を楽しもう</p>
        </header>

        <div className="grid grid-cols-12 gap-4">
          {/* Sidebar */}
          <aside className="col-span-3 bg-white rounded-lg shadow-lg p-4">
            <button
              onClick={conversationManager.createNewConversation}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 mb-4"
            >
              新しい会話
            </button>

            <div className="space-y-2">
              {conversationManager.sortedConversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === conversationManager.currentConversationId}
                  onSelect={conversationManager.switchConversation}
                  onEditTitle={(id, title) => {
                    setEditingConversationTitle(id);
                    setEditingTitleText(title);
                  }}
                  onExport={() => {}}
                  onDelete={() => {}}
                  editingConversationTitle={editingConversationTitle}
                  editingTitleText={editingTitleText}
                  setEditingTitleText={setEditingTitleText}
                  setEditingConversationTitle={setEditingConversationTitle}
                  updateConversation={conversationManager.updateConversation}
                />
              ))}
            </div>
          </aside>

          {/* Main Chat Area */}
          <main className="col-span-9 bg-white rounded-lg shadow-lg p-6">
            <div className="mb-4">
              <button
                onClick={() => setShowConversationSettings(true)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                会話設定
              </button>
            </div>

            {/* Messages */}
            <div className="space-y-4 mb-6 max-h-[600px] overflow-y-auto">
              {messages.map((msg, idx) => {
                const char = msg.characterId
                  ? characterManager.getCharacterById(msg.characterId)
                  : null;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    index={idx}
                    character={char}
                    editingIndex={messageManager.editingIndex}
                    editingContent={messageManager.editingContent}
                    setEditingContent={messageManager.setEditingContent}
                    editingEmotion={messageManager.editingEmotion}
                    setEditingEmotion={messageManager.setEditingEmotion}
                    editingAffection={messageManager.editingAffection}
                    setEditingAffection={messageManager.setEditingAffection}
                    handleEdit={() => messageManager.handleEdit(idx, messages)}
                    handleSaveEdit={() =>
                      messageManager.handleSaveEdit(idx, currentConversation?.id || null, messages)
                    }
                    handleCancelEdit={messageManager.handleCancelEdit}
                    handleDelete={() =>
                      messageManager.handleDelete(idx, currentConversation?.id || null, messages)
                    }
                    handleFork={() => messageManager.handleFork(idx, currentConversation?.id || null)}
                    showRegeneratePrefill={showRegeneratePrefill}
                    setShowRegeneratePrefill={setShowRegeneratePrefill}
                    regeneratePrefill={regeneratePrefill}
                    setRegeneratePrefill={setRegeneratePrefill}
                    handleRegenerateGroup={() => {}}
                    handleRegenerateFrom={() => {}}
                    handleSwitchVersion={(index, altId) =>
                      messageManager.handleSwitchVersion(index, altId, currentConversation?.id || null, messages)
                    }
                    showVersions={showVersions}
                    setShowVersions={setShowVersions}
                    isLoading={claudeAPI.isLoading}
                    showThinking={showThinking}
                    setShowThinking={setShowThinking}
                    emotions={EMOTIONS}
                  />
                );
              })}
            </div>

            {/* Input */}
            <div className="border-t pt-4">
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="メッセージを入力..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <div className="flex justify-between mt-2">
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as 'user' | 'narration')}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="user">ユーザー</option>
                  <option value="narration">地の文</option>
                </select>
                <button
                  onClick={handleSendMessage}
                  disabled={claudeAPI.isLoading || !userPrompt.trim()}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300"
                >
                  {claudeAPI.isLoading ? '送信中...' : '送信'}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Modals */}
      {showConversationSettings && currentConversation && (
        <ConversationSettings
          conversation={currentConversation}
          characters={characterManager.characters}
          onUpdate={(updates) => {
            conversationManager.updateConversation(currentConversation.id, updates);
          }}
          onClose={() => setShowConversationSettings(false)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}
    </div>
  );
};

export default MultiCharacterChat;
