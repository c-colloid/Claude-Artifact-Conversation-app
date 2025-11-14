import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Trash2, Edit2, RotateCcw, Send, Plus, Eye, EyeOff, Settings, Menu, X, Hash, RefreshCw, Save, HardDrive, User, Heart, Download, Upload, ChevronDown, ChevronRight, Layers, Copy, MessageSquare, Check, Users, BookOpen, FileText } from 'lucide-react';

const MultiCharacterChat = () => {
  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);

  // Characters state
  const [characters, setCharacters] = useState([]);
  const [showCharacterModal, setShowCharacterModal] = useState(false);

  // Conversation state
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);

  const [userPrompt, setUserPrompt] = useState('');
  const [messageType, setMessageType] = useState('user'); // 'user' or 'narration'
  const [nextSpeaker, setNextSpeaker] = useState(null); // Character ID for next speaker
  const [prefillText, setPrefillText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Model settings
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Thinking settings
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(2000);
  const [showThinking, setShowThinking] = useState(true);

  // Editing state
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [regeneratePrefill, setRegeneratePrefill] = useState('');
  const [showRegeneratePrefill, setShowRegeneratePrefill] = useState(null);

  // Stats
  const [usageStats, setUsageStats] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    requestCount: 0
  });

  // Storage state
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarView, setSidebarView] = useState('conversations');
  const [showConversationSettings, setShowConversationSettings] = useState(false);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const characterFileInputRef = useRef(null);
  const conversationFileInputRef = useRef(null);
  const messageRefs = useRef({});
  const autoSaveTimerRef = useRef(null);
  const textareaRef = useRef(null);

  const STORAGE_KEY = 'multi-character-chat-data-v1';

  // Fallback models
  const fallbackModels = [
    { id: 'claude-opus-4-1-20250805', name: 'Opus 4.1', icon: '👑' },
    { id: 'claude-opus-4-20250514', name: 'Opus 4', icon: '💎' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', icon: '⭐' },
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4', icon: '✨' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', icon: '⚡' },
    { id: 'claude-haiku-4-20250514', name: 'Haiku 4', icon: '💨' }
  ];

  const emotions = {
    joy: { label: '喜', emoji: '😊', color: 'text-yellow-500' },
    anger: { label: '怒', emoji: '😠', color: 'text-red-500' },
    sadness: { label: '哀', emoji: '😢', color: 'text-blue-500' },
    fun: { label: '楽', emoji: '😆', color: 'text-green-500' },
    embarrassed: { label: '照', emoji: '😳', color: 'text-pink-500' },
    surprised: { label: '驚', emoji: '😲', color: 'text-purple-500' },
    neutral: { label: '中', emoji: '😐', color: 'text-gray-500' }
  };

  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const getIconForModel = (displayName, modelId) => {
    const name = (displayName || modelId).toLowerCase();
    if (name.includes('opus')) return '👑';
    if (name.includes('sonnet')) return '⭐';
    if (name.includes('haiku')) return '⚡';
    return '🤖';
  };

  const getShortName = (displayName, modelId) => {
    if (displayName) {
      return displayName.replace('Claude ', '');
    }
    if (modelId.includes('opus')) {
      if (modelId.includes('4-1')) return 'Opus 4.1';
      if (modelId.includes('4')) return 'Opus 4';
    }
    if (modelId.includes('sonnet')) {
      if (modelId.includes('4-5')) return 'Sonnet 4.5';
      if (modelId.includes('4')) return 'Sonnet 4';
    }
    if (modelId.includes('haiku')) {
      if (modelId.includes('4-5')) return 'Haiku 4.5';
      if (modelId.includes('4')) return 'Haiku 4';
    }
    return modelId;
  };

  const getDefaultCharacter = () => ({
    id: generateId(),
    name: '新しいキャラクター',
    definition: {
      personality: 'フレンドリーで親切',
      speakingStyle: '丁寧な口調',
      firstPerson: '私',
      secondPerson: 'あなた',
      background: '',
      catchphrases: []
    },
    features: {
      emotionEnabled: true,
      affectionEnabled: true,
      autoManageEmotion: true,
      autoManageAffection: true,
      currentEmotion: 'neutral',
      affectionLevel: 50,
      avatar: '😊'
    },
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });

  const getDefaultConversation = () => ({
    id: generateId(),
    title: '新しい会話',
    participantIds: [], // Array of character IDs
    backgroundInfo: '', // Situation, relationships, etc.
    narrationEnabled: true,
    messages: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });

  const getCurrentConversation = () => {
    return conversations.find(c => c.id === currentConversationId);
  };

  const getCurrentMessages = () => {
    const conv = getCurrentConversation();
    return conv?.messages || [];
  };

  const getCharacterById = (id) => {
    return characters.find(c => c.id === id);
  };

  const parseMultiCharacterResponse = (responseText, conversation, thinkingContent) => {
    const messages = [];
    const characterUpdates = {}; // Collect character updates
    const lines = responseText.split('\n');
    let currentType = null;
    let currentCharacterId = null;
    let currentContent = [];
    let thinkingAdded = false;

    const finishCurrentMessage = () => {
      if (currentContent.length > 0) {
        let content = currentContent.join('\n').trim();
        let emotion = null;
        let affection = null;
        
        if (content) {
          // Extract emotion tag
          const emotionMatch = content.match(/\[EMOTION:(\w+)\]/);
          if (emotionMatch && emotions[emotionMatch[1]]) {
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
          if (currentCharacterId && (emotion || affection !== null)) {
            if (!characterUpdates[currentCharacterId]) {
              characterUpdates[currentCharacterId] = {};
            }
            if (emotion) {
              characterUpdates[currentCharacterId].emotion = emotion;
            }
            if (affection !== null) {
              characterUpdates[currentCharacterId].affection = affection;
            }
          }
          
          messages.push({
            role: 'assistant',
            type: currentType || 'character',
            characterId: currentCharacterId,
            content: content,
            emotion: emotion,
            affection: affection,
            thinking: !thinkingAdded && thinkingContent ? thinkingContent : '',
            timestamp: new Date().toISOString()
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
          .map(id => getCharacterById(id))
          .find(c => c && c.name === charName);
        
        currentType = 'character';
        currentCharacterId = char?.id || null;
        
        // Add the rest of the line after the tag
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
        
        // Add the rest of the line after the tag
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
      // Try to find at least one character tag anywhere in the text
      const anyCharMatch = responseText.match(/\[CHARACTER:([^\]]+)\]/);
      let characterId = null;
      let messageType = 'character';
      
      if (anyCharMatch) {
        const charName = anyCharMatch[1].trim();
        const char = conversation.participantIds
          .map(id => getCharacterById(id))
          .find(c => c && c.name === charName);
        characterId = char?.id || null;
      }

      let cleanContent = responseText.replace(/\[CHARACTER:[^\]]+\]|\[NARRATION\]|\[EMOTION:\w+\]|\[AFFECTION:\d+\]/g, '').trim();

      messages.push({
        role: 'assistant',
        type: messageType,
        characterId: characterId,
        content: cleanContent,
        thinking: thinkingContent,
        timestamp: new Date().toISOString()
      });
    }

    return { messages, characterUpdates };
  };

  const updateCharacter = (characterId, updates) => {
    setCharacters(chars => chars.map(c => 
      c.id === characterId 
        ? { ...c, ...updates, updated: new Date().toISOString() }
        : c
    ));
  };

  const updateConversation = (conversationId, updates) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, ...updates, updated: new Date().toISOString() }
        : conv
    ));
  };

  const buildSystemPrompt = (conversation, nextSpeakerId = null) => {
    if (!conversation) return '';

    const participants = conversation.participantIds
      .map(id => getCharacterById(id))
      .filter(c => c);

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
        prompt += `- 現在の感情: ${emotions[feat.currentEmotion]?.label || '中立'}\n`;
      }
      if (feat.affectionEnabled) {
        prompt += `- 現在の好感度: ${feat.affectionLevel}/100\n`;
      }
      prompt += `\n`;
    });

    if (conversation.backgroundInfo) {
      prompt += `## 背景情報・シチュエーション\n${conversation.backgroundInfo}\n\n`;
    }

    prompt += `## 重要な指示\n`;
    
    // If next speaker is specified
    if (nextSpeakerId) {
      const nextChar = participants.find(c => c.id === nextSpeakerId);
      if (nextChar) {
        prompt += `1. **次は${nextChar.name}として発言してください**\n`;
        prompt += `2. 発言の最初に [CHARACTER:${nextChar.name}] を必ず出力してください\n`;
      }
    } else {
      prompt += `1. 次に発言すべきキャラクターを判断し、そのキャラクターとして発言してください\n`;
      prompt += `2. 発言の最初に [CHARACTER:キャラクター名] を必ず出力してください\n`;
    }
    
    prompt += `3. 各キャラクターの個性を維持し、自然な会話の流れを作ってください\n`;
    prompt += `4. 一人称・二人称は各キャラクターの設定に従ってください\n`;
    
    // Add emotion/affection instructions for characters with these features enabled
    const hasAutoEmotion = participants.some(c => c.features.emotionEnabled && c.features.autoManageEmotion);
    const hasAutoAffection = participants.some(c => c.features.affectionEnabled && c.features.autoManageAffection);
    
    if (hasAutoEmotion) {
      prompt += `5. 感情表現: 会話の流れに応じて、発言の最後に [EMOTION:感情キー] を出力してください\n`;
      prompt += `   利用可能な感情: ${Object.keys(emotions).join(', ')}\n`;
    }
    
    if (hasAutoAffection) {
      const affectionNum = hasAutoEmotion ? 6 : 5;
      prompt += `${affectionNum}. 好感度: 会話内容に応じて、発言の最後に [AFFECTION:数値] を出力してください（0-100）\n`;
      prompt += `   好感度変動の目安: ポジティブな会話+1〜+5、ネガティブな会話-1〜-5\n`;
    }
    
    if (conversation.narrationEnabled) {
      const narrationNum = hasAutoEmotion && hasAutoAffection ? 7 : hasAutoEmotion || hasAutoAffection ? 6 : 5;
      prompt += `${narrationNum}. 必要に応じて [NARRATION] タグで地の文(情景描写、行動描写)を追加できます\n`;
    }

    prompt += `\n例:\n`;
    prompt += `[CHARACTER:${participants[0]?.name || 'キャラクター名'}]\n`;
    prompt += `${participants[0]?.definition.firstPerson || '私'}も同じ意見だよ!\n`;

    return prompt;
  };

  const createNewConversation = () => {
    const newConv = getDefaultConversation();
    setConversations(prev => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    return newConv.id;
  };

  const deleteConversation = (conversationId) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    setConfirmDialog({
      title: '確認',
      message: `「${conv.title}」を削除しますか?この操作は取り消せません。`,
      onConfirm: () => {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          const remaining = conversations.filter(c => c.id !== conversationId);
          if (remaining.length > 0) {
            setCurrentConversationId(remaining[0].id);
          } else {
            createNewConversation();
          }
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const exportConversation = (conversationId) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const participantChars = conv.participantIds.map(id => getCharacterById(id)).filter(c => c);
    const exportData = {
      conversation: conv,
      characters: participantChars,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multi_conversation_${conv.title}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importConversation = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.conversation && data.characters) {
          // Import characters if they don't exist
          const charIdMap = {};
          data.characters.forEach(char => {
            const existingChar = characters.find(c => c.name === char.name);
            if (existingChar) {
              charIdMap[char.id] = existingChar.id;
            } else {
              const newId = generateId();
              charIdMap[char.id] = newId;
              const importedChar = {
                ...char,
                id: newId,
                name: `${char.name}（インポート）`,
                created: new Date().toISOString(),
                updated: new Date().toISOString()
              };
              setCharacters(prev => [...prev, importedChar]);
            }
          });

          // Import conversation with updated character IDs
          const newConv = {
            ...data.conversation,
            id: generateId(),
            title: `${data.conversation.title}（インポート）`,
            participantIds: data.conversation.participantIds.map(id => charIdMap[id] || id),
            messages: data.conversation.messages.map(msg => ({
              ...msg,
              characterId: msg.characterId ? (charIdMap[msg.characterId] || msg.characterId) : null,
              timestamp: new Date().toISOString()
            })),
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          };

          setConversations(prev => [...prev, newConv]);
          setCurrentConversationId(newConv.id);
          setError('');
        } else {
          throw new Error('無効なファイル形式です');
        }
      } catch (err) {
        setError('会話ファイルの読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const exportCharacter = (charId) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const exportData = JSON.stringify(char, null, 2);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character_${char.name}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importCharacter = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const char = JSON.parse(e.target.result);
        const newChar = {
          ...char,
          id: generateId(),
          name: `${char.name}（インポート）`,
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };
        
        setCharacters(prev => [...prev, newChar]);
        setError('');
      } catch (err) {
        setError('キャラクターファイルの読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const generateConversationTitle = (messages) => {
    if (messages.length === 0) return '新しい会話';
    
    // Find first user or character message
    const firstMsg = messages.find(m => m.type === 'user' || m.type === 'character');
    if (!firstMsg) return '新しい会話';
    
    // Create title from first message content
    const preview = firstMsg.content.slice(0, 30);
    return preview + (firstMsg.content.length > 30 ? '…' : '');
  };

  const generateResponse = async (messages, usePrefill = false, customPrefill = null, forcedNextSpeaker = null) => {
    setIsLoading(true);
    setError('');

    try {
      const conversation = getCurrentConversation();
      if (!conversation) {
        throw new Error('会話が選択されていません');
      }

      if (conversation.participantIds.length === 0) {
        throw new Error('キャラクターが登録されていません');
      }

      const systemPrompt = buildSystemPrompt(conversation, forcedNextSpeaker);

      const sanitizedMessages = messages.map(msg => {
        let content = '';
        
        if (msg.type === 'narration') {
          content = `[NARRATION]\n${msg.content}`;
        } else if (msg.type === 'user') {
          content = `[USER]\n${msg.content}`;
        } else {
          const char = getCharacterById(msg.characterId);
          const charName = char?.name || 'Unknown';
          content = `[CHARACTER:${charName}]\n${msg.content}`;
        }

        return {
          role: msg.role === 'user' || msg.type === 'user' || msg.type === 'narration' ? 'user' : 'assistant',
          content: content
        };
      });

      const finalMessages = [...sanitizedMessages];
      
      const prefillToUse = customPrefill !== null ? customPrefill : (usePrefill ? prefillText : '');
      
      if (prefillToUse.trim()) {
        finalMessages.push({
          role: 'assistant',
          content: prefillToUse
        });
      }

      const requestBody = {
        model: selectedModel,
        max_tokens: 4000,
        messages: finalMessages,
        system: systemPrompt
      };

      if (thinkingEnabled) {
        requestBody.thinking = {
          type: 'enabled',
          budget_tokens: thinkingBudget
        };
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) {
          throw new Error(`レート制限に達しました。しばらく待ってから再試行してください。`);
        }
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.usage) {
        setUsageStats(prev => ({
          inputTokens: prev.inputTokens + (data.usage.input_tokens || 0),
          outputTokens: prev.outputTokens + (data.usage.output_tokens || 0),
          totalTokens: prev.totalTokens + (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          requestCount: prev.requestCount + 1
        }));
      }

      let textContent = '';
      let thinkingContent = '';

      data.content.forEach(block => {
        if (block.type === 'thinking') {
          thinkingContent = block.thinking;
        } else if (block.type === 'text') {
          textContent = block.text;
        }
      });

      const fullContent = prefillToUse.trim()
        ? prefillToUse + textContent 
        : textContent;

      // Parse and split response into multiple messages
      const { messages: parsedMessages, characterUpdates } = parseMultiCharacterResponse(fullContent, conversation, thinkingContent);

      // Apply character updates
      if (Object.keys(characterUpdates).length > 0) {
        Object.entries(characterUpdates).forEach(([charId, updates]) => {
          const char = getCharacterById(charId);
          if (char) {
            const featureUpdates = { ...char.features };
            
            if (updates.emotion && char.features.autoManageEmotion) {
              featureUpdates.currentEmotion = updates.emotion;
            }
            
            if (updates.affection !== undefined && char.features.autoManageAffection) {
              featureUpdates.affectionLevel = updates.affection;
            }
            
            updateCharacter(charId, { features: featureUpdates });
          }
        });
      }

      const updatedMessages = [...messages, ...parsedMessages];
      
      // Auto-generate title if still default
      const conv = getCurrentConversation();
      if (conv) {
        const newTitle = conv.title === '新しい会話' && updatedMessages.length >= 2
          ? generateConversationTitle(updatedMessages)
          : conv.title;
        
        updateConversation(currentConversationId, {
          messages: updatedMessages,
          title: newTitle
        });
      }
      
      setUserPrompt('');
      setPrefillText('');

    } catch (err) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!userPrompt.trim()) return;
    if (!currentConversationId) {
      setError('会話を選択してください');
      return;
    }

    const newMessage = {
      role: 'user',
      type: messageType,
      content: userPrompt,
      timestamp: new Date().toISOString()
    };

    const currentMessages = getCurrentMessages();
    const newHistory = [...currentMessages, newMessage];

    updateConversation(currentConversationId, {
      messages: newHistory
    });

    await generateResponse(newHistory, true, null, nextSpeaker);
    setNextSpeaker(null); // Reset next speaker after use
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditingContent(getCurrentMessages()[index].content);
  };

  const handleSaveEdit = (index) => {
    const currentMessages = getCurrentMessages();
    const updated = [...currentMessages];
    updated[index].content = editingContent;

    updateConversation(currentConversationId, {
      messages: updated
    });

    setEditingIndex(null);
  };

  const handleDelete = (index) => {
    const currentMessages = getCurrentMessages();
    const updated = currentMessages.filter((_, i) => i !== index);

    updateConversation(currentConversationId, {
      messages: updated
    });
  };

  const handleRegenerateFrom = async (index) => {
    const currentMessages = getCurrentMessages();
    const historyUpToPoint = currentMessages.slice(0, index);

    updateConversation(currentConversationId, {
      messages: historyUpToPoint
    });

    if (historyUpToPoint.length > 0) {
      await generateResponse(historyUpToPoint, false, regeneratePrefill);
    }

    setRegeneratePrefill('');
    setShowRegeneratePrefill(null);
  };

  const fetchModels = async () => {
    setIsLoadingModels(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'anthropic-version': '2023-06-01',
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        const sortedModels = data.data.sort((a, b) => {
          return b.created_at.localeCompare(a.created_at);
        });
        
        const formattedModels = sortedModels.map(model => ({
          id: model.id,
          name: getShortName(model.display_name, model.id),
          icon: getIconForModel(model.display_name, model.id)
        }));
        
        setModels(formattedModels);
        
        if (!formattedModels.find(m => m.id === selectedModel)) {
          const defaultModel = formattedModels.find(m => m.id.includes('sonnet-4-5')) 
            || formattedModels[0];
          if (defaultModel) {
            setSelectedModel(defaultModel.id);
          }
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setModels(fallbackModels);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const saveToStorage = () => {
    if (!autoSaveEnabled || !isInitialized) return;

    setSaveStatus('saving');
    try {
      const saveData = {
        characters,
        conversations,
        currentConversationId,
        selectedModel,
        thinkingEnabled,
        thinkingBudget,
        usageStats,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      setLastSaved(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const loadFromStorage = () => {
    try {
      const dataString = localStorage.getItem(STORAGE_KEY);

      if (dataString) {
        const data = JSON.parse(dataString);
        
        if (data.characters && data.characters.length > 0) {
          // Migrate characters to add missing features
          const migratedCharacters = data.characters.map(char => {
            const features = char.features || {};
            return {
              ...char,
              features: {
                emotionEnabled: features.emotionEnabled !== undefined ? features.emotionEnabled : true,
                affectionEnabled: features.affectionEnabled !== undefined ? features.affectionEnabled : false,
                autoManageEmotion: features.autoManageEmotion !== undefined ? features.autoManageEmotion : true,
                autoManageAffection: features.autoManageAffection !== undefined ? features.autoManageAffection : true,
                currentEmotion: features.currentEmotion || 'neutral',
                affectionLevel: features.affectionLevel !== undefined ? features.affectionLevel : 50,
                avatar: features.avatar || '😊'
              }
            };
          });
          setCharacters(migratedCharacters);
        }
        
        if (data.conversations && data.conversations.length > 0) {
          // Migrate conversations to add missing fields
          const migratedConversations = data.conversations.map(conv => ({
            ...conv,
            narrationEnabled: conv.narrationEnabled !== undefined ? conv.narrationEnabled : true,
            backgroundInfo: conv.backgroundInfo || ''
          }));
          setConversations(migratedConversations);
        }
        
        if (data.currentConversationId) {
          setCurrentConversationId(data.currentConversationId);
        }
        
        if (data.selectedModel) {
          setSelectedModel(data.selectedModel);
        }
        if (data.thinkingEnabled !== undefined) {
          setThinkingEnabled(data.thinkingEnabled);
        }
        if (data.thinkingBudget) {
          setThinkingBudget(data.thinkingBudget);
        }
        if (data.usageStats) {
          setUsageStats(data.usageStats);
        }
        if (data.timestamp) {
          setLastSaved(new Date(data.timestamp));
        }
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('Load failed:', err);
      return false;
    }
  };

  // Initial load effect
  useEffect(() => {
    const hasData = loadFromStorage();

    if (!hasData) {
      const defaultChar = getDefaultCharacter();
      setCharacters([defaultChar]);
      
      const defaultConv = getDefaultConversation();
      setConversations([defaultConv]);
      setCurrentConversationId(defaultConv.id);
    }

    setIsInitialized(true);
    fetchModels();
  }, []);

  // Auto-save effect
  useEffect(() => {
    if (!isInitialized) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveToStorage();
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [characters, conversations, currentConversationId, selectedModel, thinkingEnabled, thinkingBudget, usageStats, autoSaveEnabled, isInitialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentConversationId]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 400);
    textarea.style.height = `${newHeight}px`;
  }, [userPrompt]);

  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    return lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const currentConversation = getCurrentConversation();
  const currentMessages = getCurrentMessages();

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-md p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-100 rounded-lg transition lg:hidden"
          >
            {showSidebar ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <Users size={24} />
            マルチキャラクター会話
          </h1>

          {currentConversation && (
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
              <MessageSquare size={14} />
              <span className="max-w-xs truncate">{currentConversation.title}</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                {currentConversation.participantIds.length}人
              </span>
            </div>
          )}
          
          <div className="hidden lg:flex items-center gap-2 text-xs">
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-blue-600">
                <Save size={12} className="animate-pulse" />
                保存中
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600">
                <Save size={12} />
                保存完了
              </span>
            )}
            {saveStatus === '' && lastSaved && (
              <span className="text-gray-500 flex items-center gap-1">
                <HardDrive size={12} />
                {formatLastSaved()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCharacterModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
          >
            <User size={16} />
            <span className="hidden md:inline">キャラ管理</span>
          </button>
          {currentConversation && (
            <button
              onClick={() => setShowConversationSettings(!showConversationSettings)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
            >
              <Users size={16} />
              <span className="hidden md:inline">会話設定</span>
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border-b border-gray-200 p-4 space-y-3 max-h-96 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => createNewConversation()} 
              className="flex items-center gap-1 px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition text-sm"
            >
              <Plus size={16} />
              新規会話
            </button>
            <button 
              onClick={() => {
                if (currentConversation) {
                  exportConversation(currentConversation.id);
                }
              }}
              disabled={!currentConversation || currentMessages.length === 0}
              className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-300 text-sm"
            >
              <Download size={16} />
              会話保存
            </button>
            <button 
              onClick={() => conversationFileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
            >
              <Upload size={16} />
              会話読込
            </button>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <HardDrive size={14} />
                自動保存
              </h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-xs text-gray-700">有効</span>
              </label>
            </div>
            <p className="text-xs text-gray-600">
              💾 会話とキャラクターは自動的に保存されます
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">モデル</label>
                <button
                  onClick={fetchModels}
                  disabled={isLoadingModels}
                  className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 p-1"
                  title="モデル一覧を更新"
                >
                  <RefreshCw size={14} className={isLoadingModels ? 'animate-spin' : ''} />
                </button>
              </div>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" 
                disabled={isLoading || isLoadingModels}
              >
                {models.length === 0 ? (
                  <option value="">読込中...</option>
                ) : (
                  models.map(model => (
                    <option key={model.id} value={model.id}>{model.icon} {model.name}</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thinking</label>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={thinkingEnabled} 
                  onChange={(e) => setThinkingEnabled(e.target.checked)} 
                  className="w-5 h-5" 
                  disabled={isLoading} 
                />
                {thinkingEnabled && (
                  <input 
                    type="number" 
                    value={thinkingBudget} 
                    onChange={(e) => setThinkingBudget(Number(e.target.value))} 
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" 
                    min="1000" 
                    max="10000" 
                    step="500" 
                    disabled={isLoading} 
                  />
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">📊 使用量</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-600">リクエスト:</span> <span className="font-semibold text-blue-700">{usageStats.requestCount}</span></div>
              <div><span className="text-gray-600">合計トークン:</span> <span className="font-semibold text-blue-700">{usageStats.totalTokens.toLocaleString()}</span></div>
              <div><span className="text-gray-600">入力:</span> <span className="font-semibold text-green-700">{usageStats.inputTokens.toLocaleString()}</span></div>
              <div><span className="text-gray-600">出力:</span> <span className="font-semibold text-purple-700">{usageStats.outputTokens.toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Conversation Settings Panel */}
      {showConversationSettings && currentConversation && (
        <ConversationSettingsPanel
          conversation={currentConversation}
          characters={characters}
          onUpdate={(updates) => updateConversation(currentConversation.id, updates)}
          onClose={() => setShowConversationSettings(false)}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-64 bg-white border-r border-gray-200 overflow-y-auto p-3 absolute lg:relative h-full lg:h-auto z-10 lg:z-auto shadow-lg lg:shadow-none ${showSidebar ? 'block' : 'hidden lg:block'}`}>
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setSidebarView('conversations')}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                sidebarView === 'conversations' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <MessageSquare size={12} className="inline mr-1" />
              会話
            </button>
            <button
              onClick={() => setSidebarView('messages')}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                sidebarView === 'messages' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={!currentConversation}
            >
              <Hash size={12} className="inline mr-1" />
              履歴
            </button>
          </div>

          {sidebarView === 'conversations' ? (
            <>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare size={16} />
                会話一覧
              </span>
              <button
                onClick={() => createNewConversation()}
                className="p-1 hover:bg-indigo-100 rounded"
                title="新規会話"
              >
                <Plus size={16} className="text-indigo-600" />
              </button>
            </h3>
            {conversations.length > 0 ? (
              <div className="space-y-1">
                {conversations
                  .sort((a, b) => new Date(b.updated) - new Date(a.updated))
                  .map((conv) => {
                    const isActive = currentConversationId === conv.id;
                    return (
                      <div
                        key={conv.id}
                        className={`group rounded-lg transition ${
                          isActive 
                            ? 'bg-indigo-100 border-2 border-indigo-500' 
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-2 p-2">
                          <button
                            onClick={() => setCurrentConversationId(conv.id)}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {isActive && <Check size={12} className="text-indigo-600 flex-shrink-0" />}
                              <span className="font-semibold text-sm truncate">{conv.title}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{conv.messages.length}件</span>
                              <span className="flex items-center gap-1">
                                <Users size={10} />
                                {conv.participantIds.length}
                              </span>
                            </div>
                          </button>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                exportConversation(conv.id);
                              }}
                              className="p-1 hover:bg-green-100 rounded"
                              title="エクスポート"
                            >
                              <Download size={12} className="text-green-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              className="p-1 hover:bg-red-100 rounded"
                              title="削除"
                            >
                              <Trash2 size={12} className="text-red-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">会話がありません</p>
            )}
          </>
          ) : (
            <>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Hash size={16} />
              メッセージ履歴
            </h3>
            {currentMessages.length === 0 ? (
              <p className="text-sm text-gray-500">メッセージがありません</p>
            ) : (
              <div className="space-y-1">
                {currentMessages.map((msg, idx) => {
                  const char = msg.characterId ? getCharacterById(msg.characterId) : null;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        messageRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setShowSidebar(false);
                      }}
                      className={`w-full text-left px-2 py-2 rounded-lg text-xs transition ${
                        msg.type === 'user' 
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-800' 
                          : msg.type === 'narration'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                            : 'bg-purple-50 hover:bg-purple-100 text-purple-800'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1 mb-1">
                        {msg.type === 'user' ? (
                          <><User size={12} /> #{idx + 1} あなた</>
                        ) : msg.type === 'narration' ? (
                          <><FileText size={12} /> #{idx + 1} 地の文</>
                        ) : (
                          <>
                            {char?.features.avatar && <span>{char.features.avatar}</span>}
                            #{idx + 1} {char?.name || '不明'}
                          </>
                        )}
                      </div>
                      <div className="truncate opacity-75">{msg.content.slice(0, 30)}...</div>
                    </button>
                  );
                })}
              </div>
            )}
            </>
          )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentMessages.length === 0 && currentConversation && (
            <div className="text-center text-gray-500 mt-20">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-lg font-semibold">会話を開始しましょう!</p>
              {currentConversation.participantIds.length === 0 ? (
                <>
                  <p className="text-sm mt-2 text-orange-600">⚠️ キャラクターを追加してください</p>
                  <button
                    onClick={() => setShowConversationSettings(true)}
                    className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    会話設定を開く
                  </button>
                </>
              ) : (
                <p className="text-sm mt-2 text-gray-400">会話は自動的に保存されます</p>
              )}
            </div>
          )}

          {currentMessages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              index={index}
              character={message.characterId ? getCharacterById(message.characterId) : null}
              editingIndex={editingIndex}
              editingContent={editingContent}
              setEditingContent={setEditingContent}
              handleEdit={handleEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={() => setEditingIndex(null)}
              handleDelete={handleDelete}
              showRegeneratePrefill={showRegeneratePrefill}
              setShowRegeneratePrefill={setShowRegeneratePrefill}
              regeneratePrefill={regeneratePrefill}
              setRegeneratePrefill={setRegeneratePrefill}
              handleRegenerateFrom={handleRegenerateFrom}
              isLoading={isLoading}
              showThinking={showThinking}
              setShowThinking={setShowThinking}
              emotions={emotions}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  <span className="text-gray-600 text-sm">考え中...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="flex-shrink-0 text-red-500" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-red-800 text-sm">エラー</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-3 space-y-2">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMessageType('user')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                messageType === 'user'
                  ? 'bg-white text-indigo-600 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <User size={14} className="inline mr-1" />
              発言
            </button>
            <button
              onClick={() => setMessageType('narration')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                messageType === 'narration'
                  ? 'bg-white text-purple-600 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              disabled={!currentConversation?.narrationEnabled}
            >
              <FileText size={14} className="inline mr-1" />
              地の文
            </button>
          </div>

          {currentConversation && currentConversation.participantIds.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">次の発言者:</label>
              <select
                value={nextSpeaker || ''}
                onChange={(e) => setNextSpeaker(e.target.value || null)}
                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              >
                <option value="">自動</option>
                {currentConversation.participantIds.map(charId => {
                  const char = getCharacterById(charId);
                  return char ? (
                    <option key={charId} value={charId}>
                      {char.features.avatar} {char.name}
                    </option>
                  ) : null;
                })}
              </select>
            </div>
          )}

          <input 
            type="text" 
            value={prefillText} 
            onChange={(e) => setPrefillText(e.target.value)} 
            placeholder="Prefill（オプション）" 
            className="flex-1 min-w-[150px] px-3 py-2 border border-gray-300 rounded-lg text-sm" 
            disabled={isLoading} 
          />
        </div>
        <div className="flex gap-2">
          <textarea 
            ref={textareaRef}
            value={userPrompt} 
            onChange={(e) => setUserPrompt(e.target.value)} 
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { 
                handleSend(); 
              } 
            }} 
            placeholder={
              !currentConversation 
                ? '会話を選択してください'
                : currentConversation.participantIds.length === 0
                  ? 'キャラクターを追加してください'
                  : messageType === 'narration'
                    ? '地の文を入力... (情景描写、行動描写など)'
                    : 'メッセージを入力... (Ctrl+Enter で送信)'
            }
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none overflow-y-auto" 
            style={{ minHeight: '80px', maxHeight: '400px' }}
            disabled={isLoading || !currentConversation || currentConversation.participantIds.length === 0} 
          />
          <button 
            onClick={handleSend} 
            disabled={isLoading || !userPrompt.trim() || !currentConversation || currentConversation.participantIds.length === 0} 
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-300 flex items-center gap-2 text-sm self-end"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Character Management Modal */}
      {showCharacterModal && (
        <CharacterModal
          characters={characters}
          setCharacters={setCharacters}
          getDefaultCharacter={getDefaultCharacter}
          exportCharacter={exportCharacter}
          importCharacter={importCharacter}
          characterFileInputRef={characterFileInputRef}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={confirmDialog.onCancel}
        />
      )}

      {/* File input refs */}
      <input 
        ref={characterFileInputRef} 
        type="file" 
        accept=".json" 
        onChange={importCharacter} 
        className="hidden" 
      />
      <input 
        ref={conversationFileInputRef} 
        type="file" 
        accept=".json" 
        onChange={importConversation} 
        className="hidden" 
      />
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ 
  message, 
  index, 
  character,
  editingIndex,
  editingContent,
  setEditingContent,
  handleEdit,
  handleSaveEdit,
  handleCancelEdit,
  handleDelete,
  showRegeneratePrefill,
  setShowRegeneratePrefill,
  regeneratePrefill,
  setRegeneratePrefill,
  handleRegenerateFrom,
  isLoading,
  showThinking,
  setShowThinking,
  emotions
}) => {
  const isUser = message.type === 'user';
  const isNarration = message.type === 'narration';
  const isCharacter = message.type === 'character';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-4xl w-full ${
        isNarration 
          ? 'bg-amber-50 border-l-4 border-amber-400' 
          : isUser 
            ? 'bg-blue-100' 
            : 'bg-white'
      } rounded-lg shadow-md p-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isNarration ? (
              <>
                <FileText size={20} className="text-amber-600" />
                <span className="font-semibold text-sm text-amber-700">地の文</span>
              </>
            ) : isUser ? (
              <>
                <User size={20} className="text-blue-600" />
                <span className="font-semibold text-sm text-blue-600">あなた</span>
              </>
            ) : (
              <>
                {character?.features.avatar && (
                  <span className="text-2xl">{character.features.avatar}</span>
                )}
                <span className="font-semibold text-sm text-indigo-600">
                  {character?.name || '不明なキャラクター'}
                </span>
                {character?.features.emotionEnabled && message.emotion && (
                  <span className="text-lg" title={emotions[message.emotion]?.label}>
                    {emotions[message.emotion]?.emoji}
                  </span>
                )}
                {character?.features.affectionEnabled && message.affection !== undefined && (
                  <div className="flex items-center gap-1 text-xs bg-red-50 px-2 py-1 rounded">
                    <Heart size={12} className="text-red-500" />
                    <span className="text-red-600 font-semibold">{message.affection}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => handleEdit(index)} 
              className="p-1 text-gray-500 hover:text-blue-600" 
              title="編集"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={() => handleDelete(index)} 
              className="p-1 text-gray-500 hover:text-red-600" 
              title="削除"
            >
              <Trash2 size={14} />
            </button>
            {!isUser && !isNarration && (
              <button 
                onClick={() => setShowRegeneratePrefill(showRegeneratePrefill === index ? null : index)} 
                className="p-1 text-gray-500 hover:text-purple-600" 
                title="再生成"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>
        </div>

        {showRegeneratePrefill === index && !isUser && !isNarration && (
          <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-purple-700 mb-2">再生成Prefill</label>
            <input 
              type="text" 
              value={regeneratePrefill} 
              onChange={(e) => setRegeneratePrefill(e.target.value)} 
              placeholder="例: [CHARACTER:キャラ名]" 
              className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm mb-2" 
            />
            <div className="flex gap-2">
              <button 
                onClick={() => handleRegenerateFrom(index)} 
                className="px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xs" 
                disabled={isLoading}
              >
                実行
              </button>
              <button 
                onClick={() => { setShowRegeneratePrefill(null); setRegeneratePrefill(''); }} 
                className="px-3 py-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-xs"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {message.thinking && (
          <div className="mb-3 border-l-4 border-yellow-400 bg-yellow-50 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-yellow-700">💭 思考</span>
              <button 
                onClick={() => setShowThinking(!showThinking)} 
                className="text-yellow-600"
              >
                {showThinking ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {showThinking && (
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white p-2 rounded max-h-40 overflow-y-auto">
                {message.thinking}
              </pre>
            )}
          </div>
        )}

        {editingIndex === index ? (
          <div className="space-y-2">
            <textarea 
              value={editingContent} 
              onChange={(e) => setEditingContent(e.target.value)} 
              className="w-full p-3 border border-gray-300 rounded-lg text-sm" 
              rows={10} 
            />
            <div className="flex gap-2">
              <button 
                onClick={() => handleSaveEdit(index)} 
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
              >
                保存
              </button>
              <button 
                onClick={handleCancelEdit} 
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed">
            {message.content}
          </pre>
        )}
      </div>
    </div>
  );
};

// Conversation Settings Panel Component
const ConversationSettingsPanel = ({ conversation, characters, onUpdate, onClose }) => {
  const [localTitle, setLocalTitle] = useState(conversation.title);
  const [localBackground, setLocalBackground] = useState(conversation.backgroundInfo);
  const [localNarration, setLocalNarration] = useState(conversation.narrationEnabled);
  const [localParticipants, setLocalParticipants] = useState(conversation.participantIds);

  const toggleParticipant = (charId) => {
    setLocalParticipants(prev => 
      prev.includes(charId)
        ? prev.filter(id => id !== charId)
        : [...prev, charId]
    );
  };

  const handleSave = () => {
    onUpdate({
      title: localTitle,
      backgroundInfo: localBackground,
      narrationEnabled: localNarration,
      participantIds: localParticipants
    });
    onClose();
  };

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-4 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg text-indigo-600">会話設定</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X size={20} />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">会話タイトル</label>
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          背景情報・シチュエーション
        </label>
        <textarea
          value={localBackground}
          onChange={(e) => setLocalBackground(e.target.value)}
          placeholder="例: 学園の文化祭準備中。主人公は実行委員長。キャラクターたちは各自の出し物の準備をしている。"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          rows={4}
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={localNarration}
            onChange={(e) => setLocalNarration(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">地の文を有効化</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          情景描写や行動描写などのナレーションを追加できます
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          参加キャラクター ({localParticipants.length}人)
        </label>
        {characters.length === 0 ? (
          <p className="text-sm text-gray-500">キャラクターが登録されていません</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {characters.map(char => (
              <label
                key={char.id}
                className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={localParticipants.includes(char.id)}
                  onChange={() => toggleParticipant(char.id)}
                  className="w-4 h-4"
                />
                <span className="text-xl">{char.features.avatar}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{char.name}</div>
                  <div className="text-xs text-gray-500">{char.definition.personality}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          保存
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
};

// Character Modal Component (simplified version)
const CharacterModal = ({ characters, setCharacters, getDefaultCharacter, exportCharacter, importCharacter, characterFileInputRef, onClose }) => {
  const [editingChar, setEditingChar] = useState(null);
  const [isNew, setIsNew] = useState(false);

  const handleCreate = () => {
    const newChar = getDefaultCharacter();
    setEditingChar(newChar);
    setIsNew(true);
  };

  const handleEdit = (char) => {
    setEditingChar(JSON.parse(JSON.stringify(char)));
    setIsNew(false);
  };

  const handleSave = () => {
    if (isNew) {
      setCharacters(prev => [...prev, editingChar]);
    } else {
      setCharacters(prev => prev.map(c => c.id === editingChar.id ? editingChar : c));
    }
    setEditingChar(null);
    setIsNew(false);
  };

  const handleDelete = (charId) => {
    setCharacters(prev => prev.filter(c => c.id !== charId));
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-indigo-600">キャラクター管理</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {editingChar ? (
            <div className="space-y-3">
              <h3 className="font-bold text-lg">
                {isNew ? '新規キャラクター' : 'キャラクター編集'}
              </h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">名前 *</label>
                <input
                  type="text"
                  value={editingChar.name}
                  onChange={(e) => setEditingChar({...editingChar, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">性格</label>
                <input
                  type="text"
                  value={editingChar.definition.personality}
                  onChange={(e) => setEditingChar({
                    ...editingChar,
                    definition: {...editingChar.definition, personality: e.target.value}
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">話し方</label>
                <input
                  type="text"
                  value={editingChar.definition.speakingStyle}
                  onChange={(e) => setEditingChar({
                    ...editingChar,
                    definition: {...editingChar.definition, speakingStyle: e.target.value}
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">一人称</label>
                  <input
                    type="text"
                    value={editingChar.definition.firstPerson}
                    onChange={(e) => setEditingChar({
                      ...editingChar,
                      definition: {...editingChar.definition, firstPerson: e.target.value}
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">二人称</label>
                  <input
                    type="text"
                    value={editingChar.definition.secondPerson}
                    onChange={(e) => setEditingChar({
                      ...editingChar,
                      definition: {...editingChar.definition, secondPerson: e.target.value}
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">口癖・決まり文句</label>
                  <button
                    onClick={() => {
                      const catchphrases = editingChar.definition.catchphrases || [];
                      setEditingChar({
                        ...editingChar,
                        definition: {
                          ...editingChar.definition,
                          catchphrases: [...catchphrases, '']
                        }
                      });
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    追加
                  </button>
                </div>
                {(editingChar.definition.catchphrases || []).length === 0 ? (
                  <p className="text-xs text-gray-500">口癖を追加すると、キャラクターがより個性的になります</p>
                ) : (
                  <div className="space-y-2">
                    {(editingChar.definition.catchphrases || []).map((phrase, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={phrase}
                          onChange={(e) => {
                            const newCatchphrases = [...editingChar.definition.catchphrases];
                            newCatchphrases[index] = e.target.value;
                            setEditingChar({
                              ...editingChar,
                              definition: {...editingChar.definition, catchphrases: newCatchphrases}
                            });
                          }}
                          placeholder="例: ～だよね！、～なのだ"
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          onClick={() => {
                            const newCatchphrases = editingChar.definition.catchphrases.filter((_, i) => i !== index);
                            setEditingChar({
                              ...editingChar,
                              definition: {...editingChar.definition, catchphrases: newCatchphrases}
                            });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">アバター絵文字</label>
                <input
                  type="text"
                  value={editingChar.features.avatar}
                  onChange={(e) => setEditingChar({
                    ...editingChar,
                    features: {...editingChar.features, avatar: e.target.value}
                  })}
                  className="w-full px-3 py-2 border rounded-lg text-2xl"
                  maxLength={2}
                />
              </div>

              <div className="border-t pt-3 space-y-3">
                <h4 className="font-semibold text-sm">機能設定</h4>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingChar.features.emotionEnabled}
                    onChange={(e) => setEditingChar({
                      ...editingChar,
                      features: {...editingChar.features, emotionEnabled: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">感情表示を有効化</span>
                </label>

                {editingChar.features.emotionEnabled && (
                  <div className="ml-6 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editingChar.features.autoManageEmotion !== false}
                        onChange={(e) => setEditingChar({
                          ...editingChar,
                          features: {...editingChar.features, autoManageEmotion: e.target.checked}
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-xs">AIが自動管理</span>
                    </label>
                  </div>
                )}

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingChar.features.affectionEnabled}
                    onChange={(e) => setEditingChar({
                      ...editingChar,
                      features: {...editingChar.features, affectionEnabled: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">好感度システムを有効化</span>
                </label>

                {editingChar.features.affectionEnabled && (
                  <div className="ml-6 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editingChar.features.autoManageAffection !== false}
                        onChange={(e) => setEditingChar({
                          ...editingChar,
                          features: {...editingChar.features, autoManageAffection: e.target.checked}
                        })}
                        className="w-4 h-4"
                      />
                      <span className="text-xs">AIが自動管理</span>
                    </label>
                    
                    <div>
                      <label className="block text-xs mb-1">
                        {editingChar.features.autoManageAffection !== false ? '初期' : '現在の'}好感度: {editingChar.features.affectionLevel || 50}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editingChar.features.affectionLevel || 50}
                        onChange={(e) => setEditingChar({
                          ...editingChar,
                          features: {...editingChar.features, affectionLevel: Number(e.target.value)}
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    setEditingChar(null);
                    setIsNew(false);
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  新規キャラクター作成
                </button>
                <button
                  onClick={() => characterFileInputRef.current?.click()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Upload size={16} />
                  インポート
                </button>
              </div>

              <div className="space-y-2">
                {characters.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    キャラクターがありません
                  </p>
                ) : (
                  characters.map(char => (
                    <div key={char.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{char.features.avatar}</span>
                        <div>
                          <div className="font-semibold">{char.name}</div>
                          <div className="text-xs text-gray-500">{char.definition.personality}</div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(char)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          title="編集"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => exportCharacter(char.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                          title="エクスポート"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(char.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {characterFileInputRef && (
        <input 
          ref={characterFileInputRef} 
          type="file" 
          accept=".json" 
          onChange={importCharacter} 
          className="hidden" 
        />
      )}
    </div>
  );
};

// Confirmation Dialog Component
const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
          <p className="text-gray-600 whitespace-pre-line mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiCharacterChat;
