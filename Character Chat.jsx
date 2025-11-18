import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle, Trash2, Edit2, RotateCcw, Send, Plus, Eye, EyeOff, Settings, Menu, X, Hash, RefreshCw, Save, HardDrive, User, Heart, Download, Upload, ChevronDown, ChevronRight, Layers, Copy, MessageSquare, Check } from 'lucide-react';

const CharacterChat = () => {
  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Characters state
  const [characters, setCharacters] = useState([]);
  const [currentCharacterId, setCurrentCharacterId] = useState(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  
  // Conversation state
  const [conversations, setConversations] = useState({});
  const [activeConversations, setActiveConversations] = useState({});
  
  const [userPrompt, setUserPrompt] = useState('');
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
  const [showThinking, setShowThinking] = useState({});
  
  // Editing state
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [regeneratePrefill, setRegeneratePrefill] = useState('');
  const [showRegeneratePrefill, setShowRegeneratePrefill] = useState(null);
  const [editingConversationTitle, setEditingConversationTitle] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  
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
  const [expandedCharacters, setExpandedCharacters] = useState({});
  const [sidebarView, setSidebarView] = useState('conversations');
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const characterFileInputRef = useRef(null);
  const conversationFileInputRef = useRef(null);
  const messageRefs = useRef({});
  const autoSaveTimerRef = useRef(null);
  const textareaRef = useRef(null);

  const STORAGE_KEY = 'character-chat-data-v2';

  // Fallback models
  const fallbackModels = [
    { id: 'claude-opus-4-1-20250805', name: 'Opus 4.1', icon: '👑' },
    { id: 'claude-opus-4-20250514', name: 'Opus 4', icon: '💎' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5', icon: '⭐' },
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4', icon: '✨' },
    { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5', icon: '⚡' },
    { id: 'claude-haiku-4-20250514', name: 'Haiku 4', icon: '💨' }
  ];

  const getDefaultCharacter = () => ({
    id: generateId(),
    name: '新しいキャラクター',
    baseCharacterId: null,
    overrides: {},
    definition: {
      personality: 'フレンドリーで親切',
      speakingStyle: '丁寧な口調',
      firstPerson: '私',
      secondPerson: 'あなた',
      background: '',
      catchphrases: [],
      customPrompt: ''
    },
    features: {
      emotionEnabled: true,
      affectionEnabled: true,
      avatarEnabled: true,
      avatarType: 'emoji',
      autoManageEmotion: true,
      autoManageAffection: true,
      currentEmotion: 'neutral',
      affectionLevel: 50,
      avatar: '😊',
      avatarImage: null
    },
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });

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

  const getCurrentCharacter = () => {
    return characters.find(c => c.id === currentCharacterId);
  };

  const getBaseCharacter = (character) => {
    if (!character.baseCharacterId) return null;
    return characters.find(c => c.id === character.baseCharacterId);
  };

  const getEffectiveDefinition = (character) => {
    if (!character) return null;
    
    const base = getBaseCharacter(character);
    if (!base) {
      return character.definition;
    }
    
    return {
      ...base.definition,
      ...character.overrides
    };
  };

  const getEffectiveFeatures = (character) => {
    if (!character) return null;
    return character.features;
  };

  const isOverridden = (character, field) => {
    if (!character.baseCharacterId) return false;
    return character.overrides.hasOwnProperty(field);
  };

  const buildSystemPrompt = (character) => {
    if (!character) return '';
    
    const def = getEffectiveDefinition(character);
    const feat = getEffectiveFeatures(character);
    
    let prompt = `あなたは${character.name}として振る舞ってください。\n\n`;
    
    prompt += `# キャラクター設定\n`;
    prompt += `名前: ${character.name}\n`;
    if (def.personality) prompt += `性格: ${def.personality}\n`;
    if (def.speakingStyle) prompt += `話し方: ${def.speakingStyle}\n`;
    if (def.firstPerson) prompt += `一人称: ${def.firstPerson}\n`;
    if (def.secondPerson) prompt += `二人称: ${def.secondPerson}\n`;
    if (def.background) prompt += `\n背景:\n${def.background}\n`;
    if (def.catchphrases && def.catchphrases.length > 0) {
      prompt += `\n口癖・特徴的な言い回し:\n${def.catchphrases.map(p => `- ${p}`).join('\n')}\n`;
    }
    
    prompt += `\n# 重要な指示\n`;
    prompt += `- 必ず${character.name}のキャラクターを維持してください\n`;
    prompt += `- 一人称は必ず「${def.firstPerson}」を使用してください\n`;
    prompt += `- 相手への呼びかけは「${def.secondPerson}」を使用してください\n`;
    
    if (feat.emotionEnabled) {
      prompt += `\n# 感情表現\n`;
      prompt += `現在の感情: ${emotions[feat.currentEmotion]?.label || '中立'}\n`;
      
      if (feat.autoManageEmotion) {
        prompt += `会話の流れに応じて自然に感情を変化させてください。\n`;
        prompt += `\n**重要**: 応答の最後に、現在の感情を以下の形式で必ず出力してください:\n`;
        prompt += `[EMOTION:感情キー]\n`;
        prompt += `\n利用可能な感情キー:\n`;
        Object.keys(emotions).forEach(key => {
          prompt += `- ${key}: ${emotions[key].label}（${emotions[key].emoji}）\n`;
        });
        prompt += `\n例: 嬉しい内容なら [EMOTION:joy]、怒っているなら [EMOTION:anger]\n`;
      } else {
        prompt += `現在の感情に応じて自然な態度を取ってください。\n`;
      }
    }
    
    if (feat.affectionEnabled) {
      prompt += `\n# 好感度\n`;
      prompt += `現在の好感度: ${feat.affectionLevel}/100\n`;
      
      if (feat.autoManageAffection) {
        prompt += `会話内容に応じて好感度を自然に変動させてください。\n`;
        prompt += `\n**重要**: 応答の最後に、新しい好感度の値を以下の形式で必ず出力してください:\n`;
        prompt += `[AFFECTION:新しい好感度の値]\n`;
        prompt += `\n好感度変動の目安:\n`;
        prompt += `- 現在値: ${feat.affectionLevel}\n`;
        prompt += `- 非常にポジティブな会話: +3〜+5ポイント変動\n`;
        prompt += `- ポジティブな会話: +1〜+2ポイント変動\n`;
        prompt += `- 中立的な会話: 変化なし\n`;
        prompt += `- ネガティブな会話: -1〜-2ポイント変動\n`;
        prompt += `- 非常にネガティブな会話: -3〜-5ポイント変動\n`;
        prompt += `- 最小値: 0、最大値: 100\n`;
        prompt += `\n例: 現在${feat.affectionLevel}で良い会話なら [AFFECTION:${Math.min(100, feat.affectionLevel + 2)}]、嫌な会話なら [AFFECTION:${Math.max(0, feat.affectionLevel - 3)}]\n`;
      } else {
        prompt += `好感度に応じて態度や言葉遣いを調整してください。\n`;
      }
    }
    
    if (def.customPrompt) {
      prompt += `\n# 追加設定\n${def.customPrompt}\n`;
    }
    
    return prompt;
  };

  const createNewConversation = (characterId) => {
    const newConvId = generateId();
    const newConv = {
      id: newConvId,
      title: '新しい会話',
      messages: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    setConversations(prev => ({
      ...prev,
      [characterId]: {
        ...(prev[characterId] || {}),
        [newConvId]: newConv
      }
    }));
    
    setActiveConversations(prev => ({
      ...prev,
      [characterId]: newConvId
    }));
    
    return newConvId;
  };

  const getCurrentConversation = () => {
    if (!currentCharacterId) return null;
    const convId = activeConversations[currentCharacterId];
    if (!convId) return null;
    return conversations[currentCharacterId]?.[convId];
  };

  const getCurrentMessages = () => {
    const conv = getCurrentConversation();
    return conv?.messages || [];
  };

  const updateConversation = (characterId, conversationId, updates) => {
    setConversations(prev => ({
      ...prev,
      [characterId]: {
        ...prev[characterId],
        [conversationId]: {
          ...prev[characterId][conversationId],
          ...updates,
          updated: new Date().toISOString()
        }
      }
    }));
  };

  const deleteConversation = (characterId, conversationId) => {
    const charConvs = conversations[characterId];
    if (!charConvs) return;
    
    const convTitle = charConvs[conversationId]?.title || '会話';
    
    setConfirmDialog({
      title: '確認',
      message: `「${convTitle}」を削除しますか？この操作は取り消せません。`,
      onConfirm: () => {
        const newCharConvs = { ...charConvs };
        delete newCharConvs[conversationId];
        
        setConversations(prev => ({
          ...prev,
          [characterId]: newCharConvs
        }));
        
        if (activeConversations[characterId] === conversationId) {
          const remainingConvIds = Object.keys(newCharConvs);
          if (remainingConvIds.length > 0) {
            setActiveConversations(prev => ({
              ...prev,
              [characterId]: remainingConvIds[0]
            }));
          } else {
            createNewConversation(characterId);
          }
        }
        
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const switchConversation = (characterId, conversationId) => {
    setActiveConversations(prev => ({
      ...prev,
      [characterId]: conversationId
    }));
  };

  const exportConversation = (characterId, conversationId) => {
    const conv = conversations[characterId]?.[conversationId];
    if (!conv) return;
    
    const character = characters.find(c => c.id === characterId);
    const exportData = {
      conversation: conv,
      character: character,
      exportDate: new Date().toISOString(),
      version: '2.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${character?.name || 'unknown'}_${conv.title}_${new Date().toISOString().slice(0, 10)}.json`;
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
        
        if (data.conversationHistory && data.character) {
          const conv = {
            id: generateId(),
            title: `インポート: ${new Date().toLocaleDateString()}`,
            messages: data.conversationHistory,
            created: data.exportDate || new Date().toISOString(),
            updated: new Date().toISOString()
          };
          
          let targetCharId = data.character.id;
          const existingChar = characters.find(c => c.id === targetCharId);
          
          if (!existingChar) {
            const importedChar = {
              ...data.character,
              id: generateId(),
              name: `${data.character.name}（インポート）`,
              created: new Date().toISOString(),
              updated: new Date().toISOString()
            };
            setCharacters(prev => [...prev, importedChar]);
            targetCharId = importedChar.id;
          }
          
          setConversations(prev => ({
            ...prev,
            [targetCharId]: {
              ...(prev[targetCharId] || {}),
              [conv.id]: conv
            }
          }));
          
          setCurrentCharacterId(targetCharId);
          setActiveConversations(prev => ({
            ...prev,
            [targetCharId]: conv.id
          }));
          
          setError('');
        } else if (data.conversation && data.character) {
          const conv = {
            ...data.conversation,
            id: generateId(),
            title: `${data.conversation.title}（インポート）`,
            updated: new Date().toISOString()
          };
          
          let targetCharId = data.character.id;
          const existingChar = characters.find(c => c.id === targetCharId);
          
          if (!existingChar) {
            const importedChar = {
              ...data.character,
              id: generateId(),
              name: `${data.character.name}（インポート）`,
              created: new Date().toISOString(),
              updated: new Date().toISOString()
            };
            setCharacters(prev => [...prev, importedChar]);
            targetCharId = importedChar.id;
          }
          
          setConversations(prev => ({
            ...prev,
            [targetCharId]: {
              ...(prev[targetCharId] || {}),
              [conv.id]: conv
            }
          }));
          
          setCurrentCharacterId(targetCharId);
          setActiveConversations(prev => ({
            ...prev,
            [targetCharId]: conv.id
          }));
          
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

  const updateConversationTitle = (characterId, conversationId, newTitle) => {
    updateConversation(characterId, conversationId, { title: newTitle });
  };

  const generateConversationTitle = (messages) => {
    if (messages.length === 0) return '新しい会話';
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return '新しい会話';
    const preview = firstUserMsg.content.slice(0, 30);
    return preview + (firstUserMsg.content.length > 30 ? '...' : '');
  };

  const createCharacter = (baseCharacterId = null) => {
    const newChar = getDefaultCharacter();
    if (baseCharacterId) {
      const base = characters.find(c => c.id === baseCharacterId);
      if (base) {
        newChar.name = `${base.name}（派生）`;
        newChar.baseCharacterId = baseCharacterId;
        newChar.overrides = {};
      }
    }
    return newChar;
  };

  const updateCharacter = (characterId, updates) => {
    setCharacters(chars => chars.map(c => {
      if (c.id === characterId) {
        const updated = { ...c, ...updates, updated: new Date().toISOString() };
        
        if (c.baseCharacterId && updates.definition) {
          const base = chars.find(ch => ch.id === c.baseCharacterId);
          if (base) {
            const overrides = {};
            Object.keys(updates.definition).forEach(key => {
              if (updates.definition[key] !== base.definition[key]) {
                overrides[key] = updates.definition[key];
              }
            });
            updated.overrides = overrides;
          }
        }
        
        return updated;
      }
      return c;
    }));
  };

  const deleteCharacter = (characterId) => {
    const char = characters.find(c => c.id === characterId);
    if (!char) return;
    
    const derivedChars = characters.filter(c => c.baseCharacterId === characterId);
    
    const performDelete = () => {
      const updatedCharacters = characters.filter(c => c.id !== characterId);
      setCharacters(updatedCharacters);
      
      const newConversations = { ...conversations };
      delete newConversations[characterId];
      setConversations(newConversations);
      
      const newActiveConvs = { ...activeConversations };
      delete newActiveConvs[characterId];
      setActiveConversations(newActiveConvs);
      
      if (currentCharacterId === characterId) {
        const nextChar = updatedCharacters.length > 0 ? updatedCharacters[0] : null;
        setCurrentCharacterId(nextChar?.id || null);
      }
      setConfirmDialog(null);
    };
    
    if (derivedChars.length > 0) {
      setConfirmDialog({
        title: '確認',
        message: `このキャラクターから派生したキャラクターが${derivedChars.length}個あります。削除すると派生キャラクターも影響を受けます。\n\n「${char.name}」を削除しますか？`,
        onConfirm: performDelete,
        onCancel: () => setConfirmDialog(null)
      });
    } else {
      setConfirmDialog({
        title: '確認',
        message: `「${char.name}」を削除しますか？このキャラクターの全ての会話も削除されます。`,
        onConfirm: performDelete,
        onCancel: () => setConfirmDialog(null)
      });
    }
  };

  const duplicateCharacter = (characterId) => {
    const char = characters.find(c => c.id === characterId);
    if (!char) return;
    
    const newChar = {
      ...JSON.parse(JSON.stringify(char)),
      id: generateId(),
      name: `${char.name}（コピー）`,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    
    setCharacters([...characters, newChar]);
    createNewConversation(newChar.id);
  };

  const exportCharacter = (characterId) => {
    const char = characters.find(c => c.id === characterId);
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
        char.id = generateId();
        char.name = `${char.name}（インポート）`;
        char.created = new Date().toISOString();
        char.updated = new Date().toISOString();
        
        setCharacters([...characters, char]);
        createNewConversation(char.id);
        setError('');
      } catch (err) {
        setError('キャラクターファイルの読み込みに失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Storage functions
  const saveToStorage = () => {
    if (!autoSaveEnabled || !isInitialized) return;
    
    setSaveStatus('saving');
    try {
      const saveData = {
        characters,
        currentCharacterId,
        conversations,
        activeConversations,
        selectedModel,
        thinkingEnabled,
        thinkingBudget,
        usageStats,
        timestamp: new Date().toISOString(),
        version: '2.0'
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
        
        // Migrate old character data to new format
        if (data.characters && data.characters.length > 0) {
          const migratedCharacters = data.characters.map(char => {
            // Add avatarType if missing
            if (char.features && !char.features.avatarType) {
              char.features.avatarType = 'emoji';
            }
            // Add avatarImage if missing
            if (char.features && char.features.avatarImage === undefined) {
              char.features.avatarImage = null;
            }
            // Add autoManageEmotion if missing
            if (char.features && char.features.autoManageEmotion === undefined) {
              char.features.autoManageEmotion = true;
            }
            // Add autoManageAffection if missing
            if (char.features && char.features.autoManageAffection === undefined) {
              char.features.autoManageAffection = true;
            }
            return char;
          });
          setCharacters(migratedCharacters);
        }
        
        if (data.currentCharacterId) {
          setCurrentCharacterId(data.currentCharacterId);
        }
        if (data.conversations && Object.keys(data.conversations).length > 0) {
          setConversations(data.conversations);
        }
        if (data.activeConversations && Object.keys(data.activeConversations).length > 0) {
          setActiveConversations(data.activeConversations);
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
        
        return true; // Successfully loaded
      }
      return false; // No data to load
    } catch (err) {
      console.error('Load failed:', err);
      return false;
    }
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

  const generateResponse = async (messages, usePrefill = false, customPrefill = null) => {
    setIsLoading(true);
    setError('');

    try {
      const character = getCurrentCharacter();
      if (!character) {
        throw new Error('キャラクターが選択されていません');
      }

      const systemPrompt = buildSystemPrompt(character);

      const sanitizedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

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

      // Extract emotion and affection from response
      let extractedEmotion = character.features.currentEmotion;
      let extractedAffection = character.features.affectionLevel;
      let cleanedContent = fullContent;

      if (character.features.autoManageEmotion) {
        const emotionMatch = fullContent.match(/\[EMOTION:(\w+)\]/);
        if (emotionMatch && emotions[emotionMatch[1]]) {
          extractedEmotion = emotionMatch[1];
          cleanedContent = cleanedContent.replace(/\[EMOTION:\w+\]/, '').trim();
        }
      }

      if (character.features.autoManageAffection) {
        const affectionMatch = fullContent.match(/\[AFFECTION:(\d+)\]/);
        if (affectionMatch) {
          const newValue = parseInt(affectionMatch[1]);
          extractedAffection = Math.max(0, Math.min(100, newValue));
          cleanedContent = cleanedContent.replace(/\[AFFECTION:\d+\]/, '').trim();
        }
      }

      // Update character state
      if (character.features.autoManageEmotion && extractedEmotion !== character.features.currentEmotion) {
        updateCharacter(character.id, {
          features: {
            ...character.features,
            currentEmotion: extractedEmotion
          }
        });
      }

      if (character.features.autoManageAffection && extractedAffection !== character.features.affectionLevel) {
        updateCharacter(character.id, {
          features: {
            ...character.features,
            affectionLevel: extractedAffection
          }
        });
      }

      const newMessage = {
        role: 'assistant',
        content: cleanedContent,
        thinking: thinkingContent,
        characterId: character.id,
        characterName: character.name,
        emotion: extractedEmotion,
        affection: extractedAffection,
        avatar: character.features.avatar,
        avatarType: character.features.avatarType,
        avatarImage: character.features.avatarImage,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...messages, newMessage];
      
      const conv = getCurrentConversation();
      if (conv) {
        const newTitle = conv.title === '新しい会話' && updatedMessages.length >= 2
          ? generateConversationTitle(updatedMessages)
          : conv.title;
        
        updateConversation(currentCharacterId, conv.id, {
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
    if (!currentCharacterId) {
      setError('キャラクターを選択してください');
      return;
    }

    const userMessage = {
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toISOString()
    };

    const currentMessages = getCurrentMessages();
    const newHistory = [...currentMessages, userMessage];
    
    const conv = getCurrentConversation();
    if (conv) {
      updateConversation(currentCharacterId, conv.id, {
        messages: newHistory
      });
    }

    await generateResponse(newHistory, true);
  };

  const handleNewConversation = () => {
    if (!currentCharacterId) {
      setError('キャラクターを選択してください');
      return;
    }
    
    const currentMessages = getCurrentMessages();
    
    if (currentMessages.length > 0) {
      setConfirmDialog({
        title: '確認',
        message: '新規会話を開始しますか？',
        onConfirm: () => {
          createNewConversation(currentCharacterId);
          setUserPrompt('');
          setPrefillText('');
          setError('');
          setConfirmDialog(null);
        },
        onCancel: () => setConfirmDialog(null)
      });
    } else {
      createNewConversation(currentCharacterId);
      setUserPrompt('');
      setPrefillText('');
      setError('');
    }
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditingContent(getCurrentMessages()[index].content);
  };

  const handleSaveEdit = (index) => {
    const currentMessages = getCurrentMessages();
    const updated = [...currentMessages];
    updated[index].content = editingContent;
    
    const conv = getCurrentConversation();
    if (conv) {
      updateConversation(currentCharacterId, conv.id, {
        messages: updated
      });
    }
    
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingContent('');
  };

  const handleDelete = (index) => {
    const currentMessages = getCurrentMessages();
    const updated = currentMessages.filter((_, i) => i !== index);
    
    const conv = getCurrentConversation();
    if (conv) {
      updateConversation(currentCharacterId, conv.id, {
        messages: updated
      });
    }
  };

  const handleRegenerateFrom = async (index) => {
    const currentMessages = getCurrentMessages();
    const historyUpToPoint = currentMessages.slice(0, index);
    
    const conv = getCurrentConversation();
    if (conv) {
      updateConversation(currentCharacterId, conv.id, {
        messages: historyUpToPoint
      });
    }
    
    if (historyUpToPoint.length > 0 && historyUpToPoint[historyUpToPoint.length - 1].role === 'user') {
      await generateResponse(historyUpToPoint, false, regeneratePrefill);
    }
    
    setRegeneratePrefill('');
    setShowRegeneratePrefill(null);
  };

  // Initial load effect - runs once on mount
  useEffect(() => {
    const hasData = loadFromStorage();
    
    // If no data was loaded, create default character
    if (!hasData) {
      const defaultChar = getDefaultCharacter();
      setCharacters([defaultChar]);
      setCurrentCharacterId(defaultChar.id);
      
      const newConvId = generateId();
      setConversations({
        [defaultChar.id]: {
          [newConvId]: {
            id: newConvId,
            title: '新しい会話',
            messages: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          }
        }
      });
      setActiveConversations({
        [defaultChar.id]: newConvId
      });
    }
    
    // Mark as initialized
    setIsInitialized(true);
    
    // Fetch models
    fetchModels();
  }, []); // Empty dependency array - runs only once

  // Initialize conversations for characters without them
  useEffect(() => {
    if (!isInitialized) return;
    
    const charIds = characters.map(c => c.id);
    let needsUpdate = false;
    const newConversations = { ...conversations };
    const newActiveConversations = { ...activeConversations };
    
    charIds.forEach(charId => {
      if (!conversations[charId] || Object.keys(conversations[charId]).length === 0) {
        const newConvId = generateId();
        newConversations[charId] = {
          [newConvId]: {
            id: newConvId,
            title: '新しい会話',
            messages: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          }
        };
        newActiveConversations[charId] = newConvId;
        needsUpdate = true;
      } else if (!activeConversations[charId]) {
        const firstConvId = Object.keys(conversations[charId])[0];
        newActiveConversations[charId] = firstConvId;
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      setConversations(newConversations);
      setActiveConversations(newActiveConversations);
    }
  }, [characters, isInitialized]);

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
  }, [characters, currentCharacterId, conversations, activeConversations, selectedModel, thinkingEnabled, thinkingBudget, usageStats, autoSaveEnabled, isInitialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentCharacterId, activeConversations]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 80), 400);
    textarea.style.height = `${newHeight}px`;
  }, [userPrompt]);

  const scrollToMessage = (index) => {
    messageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowSidebar(false);
  };

  const formatLastSaved = () => {
    if (!lastSaved) return '';
    const now = new Date();
    const diff = Math.floor((now - lastSaved) / 1000);
    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    return lastSaved.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return '今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const toggleCharacterExpanded = (characterId) => {
    setExpandedCharacters(prev => ({
      ...prev,
      [characterId]: !prev[characterId]
    }));
  };

  const currentCharacter = getCurrentCharacter();
  const currentDefinition = getEffectiveDefinition(currentCharacter);
  const currentFeatures = getEffectiveFeatures(currentCharacter);
  const currentMessages = getCurrentMessages();
  const currentConversation = getCurrentConversation();

  // Show loading state during initialization
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-md p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-gray-100 rounded-lg transition lg:hidden"
          >
            {showSidebar ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="text-xl font-bold text-purple-600">💬 キャラクター会話</h1>
          
          {currentCharacter && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-purple-100 rounded-lg">
              {currentFeatures.avatarEnabled && (
                currentFeatures.avatarType === 'image' && currentFeatures.avatarImage ? (
                  <img src={currentFeatures.avatarImage} alt="avatar" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <span className="text-lg">{currentFeatures.avatar || '😊'}</span>
                )
              )}
              <span className="font-semibold text-purple-700">{currentCharacter.name}</span>
              {currentFeatures.affectionEnabled && (
                <div className="flex items-center gap-1 text-xs">
                  <Heart size={12} className="text-red-500" />
                  <span className="text-red-600">{currentFeatures.affectionLevel}</span>
                </div>
              )}
              {currentFeatures.emotionEnabled && (
                <span className="text-sm">{emotions[currentFeatures.currentEmotion]?.emoji}</span>
              )}
            </div>
          )}
          
          {currentConversation && (
            <div className="hidden lg:flex items-center gap-2 text-sm text-gray-600">
              <MessageSquare size={14} />
              <span className="max-w-xs truncate">{currentConversation.title}</span>
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
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
          >
            <User size={16} />
            <span className="hidden md:inline">キャラ管理</span>
          </button>
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
            <button onClick={handleNewConversation} disabled={!currentCharacterId} className="flex items-center gap-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition disabled:bg-gray-300 text-sm">
              <Plus size={16} />
              新規会話
            </button>
            <button 
              onClick={() => {
                if (currentConversation) {
                  exportConversation(currentCharacterId, currentConversation.id);
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
                  className="text-purple-600 hover:text-purple-700 disabled:text-gray-400 p-1"
                  title="モデル一覧を更新"
                >
                  <RefreshCw size={14} className={isLoadingModels ? 'animate-spin' : ''} />
                </button>
              </div>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={isLoading || isLoadingModels}>
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
                <input type="checkbox" checked={thinkingEnabled} onChange={(e) => setThinkingEnabled(e.target.checked)} className="w-5 h-5" disabled={isLoading} />
                {thinkingEnabled && (
                  <input type="number" value={thinkingBudget} onChange={(e) => setThinkingBudget(Number(e.target.value))} className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" min="1000" max="10000" step="500" disabled={isLoading} />
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {(showSidebar || window.innerWidth >= 1024) && (
          <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-3 absolute lg:relative h-full lg:h-auto z-10 lg:z-auto shadow-lg lg:shadow-none">
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setSidebarView('conversations')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${sidebarView === 'conversations' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <MessageSquare size={14} className="inline mr-1" />
                会話
              </button>
              <button
                onClick={() => setSidebarView('messages')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${sidebarView === 'messages' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                <Hash size={14} className="inline mr-1" />
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
                    onClick={handleNewConversation}
                    disabled={!currentCharacterId}
                    className="p-1 hover:bg-purple-100 rounded disabled:opacity-50"
                    title="新規会話"
                  >
                    <Plus size={16} className="text-purple-600" />
                  </button>
                </h3>
                {!currentCharacterId ? (
                  <p className="text-sm text-gray-500">キャラクターを選択してください</p>
                ) : conversations[currentCharacterId] && Object.keys(conversations[currentCharacterId]).length > 0 ? (
                  <div className="space-y-1">
                    {Object.values(conversations[currentCharacterId])
                      .sort((a, b) => new Date(b.updated) - new Date(a.updated))
                      .map((conv) => {
                        const isActive = activeConversations[currentCharacterId] === conv.id;
                        return (
                          <div
                            key={conv.id}
                            className={`group rounded-lg transition ${isActive ? 'bg-purple-100 border-2 border-purple-500' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'}`}
                          >
                            <div className="flex items-start gap-2 p-2">
                              <button
                                onClick={() => switchConversation(currentCharacterId, conv.id)}
                                className="flex-1 text-left min-w-0"
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {isActive && <Check size={12} className="text-purple-600 flex-shrink-0" />}
                                  {editingConversationTitle === conv.id ? (
                                    <input
                                      type="text"
                                      value={editingTitleText}
                                      onChange={(e) => setEditingTitleText(e.target.value)}
                                      onBlur={() => {
                                        updateConversationTitle(currentCharacterId, conv.id, editingTitleText);
                                        setEditingConversationTitle(null);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          updateConversationTitle(currentCharacterId, conv.id, editingTitleText);
                                          setEditingConversationTitle(null);
                                        }
                                      }}
                                      className="flex-1 px-2 py-1 text-xs border rounded"
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <span className="font-semibold text-sm truncate">{conv.title}</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>{conv.messages.length}件</span>
                                  <span>{formatDate(conv.updated)}</span>
                                </div>
                              </button>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingConversationTitle(conv.id);
                                    setEditingTitleText(conv.title);
                                  }}
                                  className="p-1 hover:bg-blue-100 rounded"
                                  title="タイトル編集"
                                >
                                  <Edit2 size={12} className="text-blue-600" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    exportConversation(currentCharacterId, conv.id);
                                  }}
                                  className="p-1 hover:bg-green-100 rounded"
                                  title="エクスポート"
                                >
                                  <Download size={12} className="text-green-600" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(currentCharacterId, conv.id);
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
                    {currentMessages.map((msg, idx) => (
                      <button
                        key={idx}
                        onClick={() => scrollToMessage(idx)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${msg.role === 'user' ? 'bg-blue-50 hover:bg-blue-100 text-blue-800' : 'bg-purple-50 hover:bg-purple-100 text-purple-800'}`}
                      >
                        <div className="font-semibold flex items-center gap-2">
                          {msg.role === 'user' ? (
                            '👤'
                          ) : msg.avatarType === 'image' && msg.avatarImage ? (
                            <img src={msg.avatarImage} alt="avatar" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <span>{msg.avatar || '🤖'}</span>
                          )}
                          #{idx + 1}
                        </div>
                        <div className="text-xs truncate opacity-75">{msg.content.slice(0, 40)}...</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentMessages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              {currentCharacter ? (
                <>
                  <div className="text-6xl mb-4">
                    {currentFeatures?.avatarEnabled && currentFeatures.avatarType === 'image' && currentFeatures.avatarImage ? (
                      <img src={currentFeatures.avatarImage} alt="avatar" className="w-24 h-24 rounded-full object-cover mx-auto" />
                    ) : (
                      <span>{currentFeatures?.avatar || '🤖'}</span>
                    )}
                  </div>
                  <p className="text-lg font-semibold">{currentCharacter.name}との会話を始めましょう！</p>
                  {currentConversation && (
                    <p className="text-sm mt-2 text-gray-400">{currentConversation.title}</p>
                  )}
                  <p className="text-sm mt-2 text-gray-400">会話は自動的に保存されます</p>
                </>
              ) : (
                <>
                  <p className="text-lg">キャラクターを選択してください</p>
                  <button
                    onClick={() => setShowCharacterModal(true)}
                    className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    キャラクター管理を開く
                  </button>
                </>
              )}
            </div>
          )}

          {currentMessages.map((message, index) => (
            <div
              key={index}
              ref={el => messageRefs.current[index] = el}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-4xl w-full ${message.role === 'user' ? 'bg-blue-100' : 'bg-white'} rounded-lg shadow-md p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {message.role === 'assistant' && currentFeatures?.avatarEnabled && (
                      message.avatarType === 'image' && message.avatarImage ? (
                        <img src={message.avatarImage} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-2xl">{message.avatar || '🤖'}</span>
                      )
                    )}
                    {message.role === 'user' && <span className="text-2xl">👤</span>}
                    <span className={`font-semibold text-sm ${message.role === 'user' ? 'text-blue-600' : 'text-purple-600'}`}>
                      {message.role === 'user' ? 'あなた' : message.characterName || 'キャラクター'}
                    </span>
                    {message.role === 'assistant' && currentFeatures?.emotionEnabled && message.emotion && (
                      <span className="text-lg" title={emotions[message.emotion]?.label}>
                        {emotions[message.emotion]?.emoji}
                      </span>
                    )}
                    {message.role === 'assistant' && currentFeatures?.affectionEnabled && message.affection !== undefined && (
                      <div className="flex items-center gap-1 text-xs bg-red-50 px-2 py-1 rounded">
                        <Heart size={12} className="text-red-500" />
                        <span className="text-red-600 font-semibold">{message.affection}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(index)} className="p-1 text-gray-500 hover:text-blue-600" title="編集">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(index)} className="p-1 text-gray-500 hover:text-red-600" title="削除">
                      <Trash2 size={14} />
                    </button>
                    {message.role === 'assistant' && (
                      <button onClick={() => setShowRegeneratePrefill(showRegeneratePrefill === index ? null : index)} className="p-1 text-gray-500 hover:text-purple-600" title="再生成">
                        <RotateCcw size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {showRegeneratePrefill === index && message.role === 'assistant' && (
                  <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <label className="block text-xs font-medium text-purple-700 mb-2">再生成Prefill</label>
                    <input 
                      type="text" 
                      value={regeneratePrefill} 
                      onChange={(e) => setRegeneratePrefill(e.target.value)} 
                      placeholder="例: わかりました。" 
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
                        onClick={() => setShowThinking(prev => ({ ...prev, [index]: !(prev[index] ?? true) }))}
                        className="text-yellow-600 hover:bg-yellow-100 p-1 rounded transition-colors cursor-pointer"
                      >
                        {(showThinking[index] ?? true) ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {(showThinking[index] ?? true) && (
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white p-2 rounded max-h-40 overflow-y-auto">
                        {message.thinking}
                      </pre>
                    )}
                  </div>
                )}

                {editingIndex === index ? (
                  <div className="space-y-2">
                    <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-sm" rows={10} />
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEdit(index)} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">保存</button>
                      <button onClick={handleCancelEdit} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed">
                    {message.content}
                  </pre>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center gap-3">
                  {currentFeatures?.avatarEnabled && (
                    currentFeatures.avatarType === 'image' && currentFeatures.avatarImage ? (
                      <img src={currentFeatures.avatarImage} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl">{currentFeatures.avatar || '🤖'}</span>
                    )
                  )}
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
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
        <div>
          <input 
            type="text" 
            value={prefillText} 
            onChange={(e) => setPrefillText(e.target.value)} 
            placeholder="Prefill（オプション）例: わかりました。" 
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" 
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
            placeholder={currentCharacter ? `${currentCharacter.name}に話しかける... (Ctrl+Enter で送信)` : 'キャラクターを選択してください'}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none overflow-y-auto" 
            style={{ minHeight: '80px', maxHeight: '400px' }}
            disabled={isLoading || !currentCharacterId} 
          />
          <button 
            onClick={handleSend} 
            disabled={isLoading || !userPrompt.trim() || !currentCharacterId} 
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-300 flex items-center gap-2 text-sm self-end"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Character Management Modal */}
      {showCharacterModal && (
        <CharacterModal
          characters={characters}
          currentCharacterId={currentCharacterId}
          setCurrentCharacterId={setCurrentCharacterId}
          createCharacter={createCharacter}
          updateCharacter={updateCharacter}
          deleteCharacter={deleteCharacter}
          duplicateCharacter={duplicateCharacter}
          exportCharacter={exportCharacter}
          importCharacter={importCharacter}
          getEffectiveDefinition={getEffectiveDefinition}
          getBaseCharacter={getBaseCharacter}
          isOverridden={isOverridden}
          emotions={emotions}
          onClose={() => setShowCharacterModal(false)}
          characterFileInputRef={characterFileInputRef}
          expandedCharacters={expandedCharacters}
          toggleCharacterExpanded={toggleCharacterExpanded}
          setConfirmDialog={setConfirmDialog}
          setCharacters={setCharacters}
          getDefaultCharacter={getDefaultCharacter}
        />
      )}

      <input ref={characterFileInputRef} type="file" accept=".json" onChange={importCharacter} className="hidden" />
      <input ref={conversationFileInputRef} type="file" accept=".json" onChange={importConversation} className="hidden" />
      
      {/* Confirmation Dialog */}
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

const ConfirmDialog = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" 
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        // Only close if clicking directly on the background
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
          <p className="text-gray-600 whitespace-pre-line mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
              キャンセル
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onConfirm();
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Emoji Picker Component
const EmojiPicker = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  
  const emojiCategories = {
    smileys: {
      name: '😊 顔',
      emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐']
    },
    animals: {
      name: '🐶 動物',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔']
    },
    food: {
      name: '🍕 食べ物',
      emojis: ['🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯']
    },
    activities: {
      name: '⚽ 活動',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏊', '🚣', '🧗', '🚵', '🚴', '🏎️', '🏍️', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩']
    },
    travel: {
      name: '✈️ 旅行',
      emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕', '🕍', '⛩️', '🕋']
    },
    objects: {
      name: '📱 物',
      emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '🪪', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓']
    },
    symbols: {
      name: '❤️ 記号',
      emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠', '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧']
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        // Only close if clicking directly on the background
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">絵文字を選択</h3>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b overflow-x-auto">
          {Object.entries(emojiCategories).map(([key, category]) => (
            <button
              key={key}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveCategory(key);
              }}
              className={`px-4 py-2 text-sm whitespace-nowrap ${
                activeCategory === key
                  ? 'border-b-2 border-purple-600 text-purple-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="p-4 h-80 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-8 gap-2">
            {emojiCategories[activeCategory].emojis.map((emoji, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(emoji);
                  onClose();
                }}
                className="text-3xl p-2 hover:bg-gray-100 rounded-lg transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Image Cropper Component
const ImageCropper = ({ imageSrc, onCrop, onCancel }) => {
  const canvasRef = useRef(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      imageRef.current = img;
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    drawCanvas();
  }, [crop, zoom, imageSize]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    const ctx = canvas.getContext('2d');
    const canvasSize = 400;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Calculate image dimensions
    const scale = zoom;
    const imgWidth = imageSize.width * scale;
    const imgHeight = imageSize.height * scale;

    // Draw image
    ctx.drawImage(
      imageRef.current,
      crop.x,
      crop.y,
      imgWidth,
      imgHeight
    );

    // Draw crop circle overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, 150, 0, 2 * Math.PI);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(canvasSize / 2, canvasSize / 2, 150, 0, 2 * Math.PI);
    ctx.stroke();
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setCrop({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;

    // Create output canvas
    const outputCanvas = document.createElement('canvas');
    const outputSize = 300;
    outputCanvas.width = outputSize;
    outputCanvas.height = outputSize;
    const outputCtx = outputCanvas.getContext('2d');

    // Calculate crop area
    const canvasSize = 400;
    const cropRadius = 150;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    const scale = zoom;
    const imgWidth = imageSize.width * scale;
    const imgHeight = imageSize.height * scale;

    // Calculate source crop coordinates
    const sourceX = (centerX - cropRadius - crop.x) / scale;
    const sourceY = (centerY - cropRadius - crop.y) / scale;
    const sourceSize = (cropRadius * 2) / scale;

    // Draw cropped circle
    outputCtx.beginPath();
    outputCtx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, 2 * Math.PI);
    outputCtx.clip();

    outputCtx.drawImage(
      imageRef.current,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    const croppedImage = outputCanvas.toDataURL('image/png');
    onCrop(croppedImage);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        // Only close if clicking directly on the background
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">画像をクロップ</h3>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={400}
              className="w-full h-auto border border-gray-300 rounded-lg cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              ズーム: {zoom.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            💡 画像をドラッグして位置を調整し、スライダーでズームできます
          </div>

          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCrop();
              }}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              クロップ
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CharacterModal = ({ 
  characters, 
  currentCharacterId, 
  setCurrentCharacterId,
  createCharacter, 
  updateCharacter, 
  deleteCharacter,
  duplicateCharacter,
  exportCharacter,
  importCharacter,
  getEffectiveDefinition,
  getBaseCharacter,
  isOverridden,
  emotions,
  onClose,
  characterFileInputRef,
  expandedCharacters,
  toggleCharacterExpanded,
  setConfirmDialog,
  setCharacters,
  getDefaultCharacter
}) => {
  const [editingChar, setEditingChar] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [isNewCharacter, setIsNewCharacter] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const imageInputRef = useRef(null);

  const handleStartEdit = (char, isNew = false) => {
    setEditingChar(JSON.parse(JSON.stringify(char)));
    setIsNewCharacter(isNew);
    setActiveTab('edit');
  };

  const handleSaveEdit = () => {
    if (!editingChar) return;
    
    if (isNewCharacter) {
      setCharacters([...characters, editingChar]);
      setCurrentCharacterId(editingChar.id);
    } else {
      updateCharacter(editingChar.id, editingChar);
    }
    
    setEditingChar(null);
    setIsNewCharacter(false);
    setActiveTab('list');
  };

  const handleCancelEdit = () => {
    setEditingChar(null);
    setIsNewCharacter(false);
    setActiveTab('list');
  };

  const handleCreateNew = () => {
    const newChar = getDefaultCharacter();
    handleStartEdit(newChar, true);
  };

  const handleCreateDerived = (baseId) => {
    const newChar = createCharacter(baseId);
    handleStartEdit(newChar, true);
  };

  const updateEditingField = (path, value) => {
    setEditingChar(prev => {
      const updated = { ...prev };
      const keys = path.split('.');
      let current = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      return updated;
    });
  };

  const addCatchphrase = () => {
    setEditingChar(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        catchphrases: [...(prev.definition.catchphrases || []), '']
      }
    }));
  };

  const updateCatchphrase = (index, value) => {
    setEditingChar(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        catchphrases: prev.definition.catchphrases.map((p, i) => i === index ? value : p)
      }
    }));
  };

  const removeCatchphrase = (index) => {
    setEditingChar(prev => ({
      ...prev,
      definition: {
        ...prev.definition,
        catchphrases: prev.definition.catchphrases.filter((_, i) => i !== index)
      }
    }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target.result);
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set isDragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルをドロップしてください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target.result);
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleImageCrop = (croppedImage) => {
    updateEditingField('features.avatarImage', croppedImage);
    updateEditingField('features.avatarType', 'image');
    setShowImageCropper(false);
    setUploadedImage(null);
  };

  const getDisplayAvatar = (char) => {
    if (!char.features.avatarEnabled) return null;
    if (char.features.avatarType === 'image' && char.features.avatarImage) {
      return <img src={char.features.avatarImage} alt="avatar" className="w-8 h-8 rounded-full object-cover" />;
    }
    return <span className="text-2xl">{char.features.avatar || '😊'}</span>;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 50 }}
      onClick={(e) => {
        // Only close if clicking directly on the background
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 flex flex-col" 
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold text-purple-600">🎭 キャラクター管理</h2>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b flex-shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setActiveTab('list');
            }}
            className={`flex-1 px-4 py-3 font-medium ${activeTab === 'list' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            キャラクター一覧
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (activeTab === 'edit') return;
              handleCreateNew();
            }}
            className={`flex-1 px-4 py-3 font-medium ${activeTab === 'edit' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {activeTab === 'edit' ? '編集中' : '新規作成'}
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1" style={{ minHeight: 0 }}>
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateNew();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Plus size={16} />
                  新規キャラクター
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    characterFileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Upload size={16} />
                  インポート
                </button>
              </div>

              {characters.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>キャラクターがありません</p>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateNew();
                    }}
                    className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    最初のキャラクターを作成
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {characters.map(char => {
                    const isBase = !char.baseCharacterId;
                    const baseChar = getBaseCharacter(char);
                    const effectiveDef = getEffectiveDefinition(char);
                    const isExpanded = expandedCharacters[char.id];
                    const derivedChars = characters.filter(c => c.baseCharacterId === char.id);

                    return (
                      <div key={char.id} className="border rounded-lg overflow-hidden">
                        <div className={`p-4 ${currentCharacterId === char.id ? 'bg-purple-100 border-2 border-purple-500' : 'bg-white'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {char.features.avatarEnabled && (
                                <div className="flex-shrink-0">
                                  {getDisplayAvatar(char)}
                                </div>
                              )}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-bold text-lg">{char.name}</h3>
                                  {!isBase && (
                                    <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                      <Layers size={12} />
                                      派生
                                    </span>
                                  )}
                                  {currentCharacterId === char.id && (
                                    <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded">
                                      使用中
                                    </span>
                                  )}
                                </div>
                                
                                {baseChar && (
                                  <p className="text-xs text-blue-600 mb-2">
                                    ベース: {baseChar.name}
                                  </p>
                                )}

                                <div className="flex flex-wrap gap-2 text-xs mb-2">
                                  {effectiveDef.personality && (
                                    <span className={`px-2 py-1 rounded ${isOverridden(char, 'personality') ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>
                                      {effectiveDef.personality}
                                    </span>
                                  )}
                                  {effectiveDef.speakingStyle && (
                                    <span className={`px-2 py-1 rounded ${isOverridden(char, 'speakingStyle') ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>
                                      {effectiveDef.speakingStyle}
                                    </span>
                                  )}
                                </div>

                                {char.features.affectionEnabled && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Heart size={14} className="text-red-500" />
                                    <span className="text-gray-600">好感度: {char.features.affectionLevel}</span>
                                  </div>
                                )}

                                {derivedChars.length > 0 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleCharacterExpanded(char.id);
                                    }}
                                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    派生キャラクター ({derivedChars.length})
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentCharacterId(char.id);
                                }}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                                title="このキャラクターを使用"
                              >
                                <User size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(char);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="編集"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateDerived(char.id);
                                }}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                                title="派生キャラクターを作成"
                              >
                                <Layers size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateCharacter(char.id);
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                                title="複製"
                              >
                                <Copy size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  exportCharacter(char.id);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                title="エクスポート"
                              >
                                <Download size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteCharacter(char.id);
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                                title="削除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {isExpanded && derivedChars.length > 0 && (
                          <div className="bg-gray-50 border-t p-3 space-y-2">
                            {derivedChars.map(derivedChar => (
                              <div key={derivedChar.id} className="bg-white rounded p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {derivedChar.features.avatarEnabled && (
                                    <div className="flex-shrink-0">
                                      {getDisplayAvatar(derivedChar)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-semibold text-sm">{derivedChar.name}</div>
                                    <div className="text-xs text-gray-500">
                                      オーバーライド: {Object.keys(derivedChar.overrides).length}項目
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCurrentCharacterId(derivedChar.id);
                                    }}
                                    className="p-1 text-purple-600 hover:bg-purple-50 rounded text-sm"
                                  >
                                    <User size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStartEdit(derivedChar);
                                    }}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'edit' && editingChar && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-purple-600 flex items-center gap-2">
                {editingChar.baseCharacterId ? <Layers size={20} /> : <User size={20} />}
                {editingChar.baseCharacterId ? '派生キャラクターの編集' : 'キャラクターの編集'}
              </h3>

              {editingChar.baseCharacterId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 このキャラクターは「{getBaseCharacter(editingChar)?.name}」から派生しています。
                    変更した項目のみが保存され、それ以外はベースから継承されます。
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
                  <input
                    type="text"
                    value={editingChar.name}
                    onChange={(e) => updateEditingField('name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'personality') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    性格
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'personality') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editingChar.baseCharacterId 
                      ? (editingChar.overrides.personality || getBaseCharacter(editingChar)?.definition.personality || '')
                      : (editingChar.definition.personality || '')}
                    onChange={(e) => {
                      if (editingChar.baseCharacterId) {
                        updateEditingField('overrides.personality', e.target.value);
                      } else {
                        updateEditingField('definition.personality', e.target.value);
                      }
                    }}
                    placeholder="例: フレンドリーで親切、好奇心旺盛"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'speakingStyle') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    話し方
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'speakingStyle') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={editingChar.baseCharacterId 
                      ? (editingChar.overrides.speakingStyle || getBaseCharacter(editingChar)?.definition.speakingStyle || '')
                      : (editingChar.definition.speakingStyle || '')}
                    onChange={(e) => {
                      if (editingChar.baseCharacterId) {
                        updateEditingField('overrides.speakingStyle', e.target.value);
                      } else {
                        updateEditingField('definition.speakingStyle', e.target.value);
                      }
                    }}
                    placeholder="例: 丁寧な口調、タメ口、関西弁"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'firstPerson') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      一人称
                      {editingChar.baseCharacterId && isOverridden(editingChar, 'firstPerson') && (
                        <span className="ml-2 text-xs text-yellow-600">（上書き）</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={editingChar.baseCharacterId 
                        ? (editingChar.overrides.firstPerson || getBaseCharacter(editingChar)?.definition.firstPerson || '')
                        : (editingChar.definition.firstPerson || '')}
                      onChange={(e) => {
                        if (editingChar.baseCharacterId) {
                          updateEditingField('overrides.firstPerson', e.target.value);
                        } else {
                          updateEditingField('definition.firstPerson', e.target.value);
                        }
                      }}
                      placeholder="例: 私、僕、俺"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'secondPerson') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      二人称
                      {editingChar.baseCharacterId && isOverridden(editingChar, 'secondPerson') && (
                        <span className="ml-2 text-xs text-yellow-600">（上書き）</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={editingChar.baseCharacterId 
                        ? (editingChar.overrides.secondPerson || getBaseCharacter(editingChar)?.definition.secondPerson || '')
                        : (editingChar.definition.secondPerson || '')}
                      onChange={(e) => {
                        if (editingChar.baseCharacterId) {
                          updateEditingField('overrides.secondPerson', e.target.value);
                        } else {
                          updateEditingField('definition.secondPerson', e.target.value);
                        }
                      }}
                      placeholder="例: あなた、君、お前"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'background') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    背景設定
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'background') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  <textarea
                    value={editingChar.baseCharacterId 
                      ? (editingChar.overrides.background || getBaseCharacter(editingChar)?.definition.background || '')
                      : (editingChar.definition.background || '')}
                    onChange={(e) => {
                      if (editingChar.baseCharacterId) {
                        updateEditingField('overrides.background', e.target.value);
                      } else {
                        updateEditingField('definition.background', e.target.value);
                      }
                    }}
                    placeholder="キャラクターの背景、経歴、設定など"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={4}
                  />
                </div>

                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'catchphrases') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      口癖・特徴的な言い回し
                      {editingChar.baseCharacterId && isOverridden(editingChar, 'catchphrases') && (
                        <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                      )}
                    </label>
                    <button
                      onClick={addCatchphrase}
                      className="text-purple-600 hover:text-purple-700 text-sm"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingChar.definition.catchphrases || []).map((phrase, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={phrase}
                          onChange={(e) => updateCatchphrase(index, e.target.value)}
                          placeholder="例: ～だよね！"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <button
                          onClick={() => removeCatchphrase(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'customPrompt') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    追加のシステムプロンプト（上級者向け）
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'customPrompt') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  <textarea
                    value={editingChar.baseCharacterId 
                      ? (editingChar.overrides.customPrompt || getBaseCharacter(editingChar)?.definition.customPrompt || '')
                      : (editingChar.definition.customPrompt || '')}
                    onChange={(e) => {
                      if (editingChar.baseCharacterId) {
                        updateEditingField('overrides.customPrompt', e.target.value);
                      } else {
                        updateEditingField('definition.customPrompt', e.target.value);
                      }
                    }}
                    placeholder="詳細な振る舞いの指示など"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows={3}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-700 mb-3">機能設定</h4>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingChar.features.emotionEnabled}
                      onChange={(e) => updateEditingField('features.emotionEnabled', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <div className="font-medium">感情表示</div>
                      <div className="text-sm text-gray-600">会話に応じて感情を表示</div>
                    </div>
                  </label>

                  {editingChar.features.emotionEnabled && (
                    <div className="ml-8 space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            checked={editingChar.features.autoManageEmotion !== false}
                            onChange={(e) => updateEditingField('features.autoManageEmotion', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            🤖 自動管理（AIが会話に応じて感情を変化させる）
                          </span>
                        </label>
                        
                        {!editingChar.features.autoManageEmotion && (
                          <>
                            <label className="block text-sm font-medium text-gray-700 mb-2">手動設定: 現在の感情</label>
                            <select
                              value={editingChar.features.currentEmotion}
                              onChange={(e) => updateEditingField('features.currentEmotion', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              {Object.entries(emotions).map(([key, emotion]) => (
                                <option key={key} value={key}>
                                  {emotion.emoji} {emotion.label}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        
                        {editingChar.features.autoManageEmotion !== false && (
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                            💡 現在の感情: {emotions[editingChar.features.currentEmotion]?.emoji} {emotions[editingChar.features.currentEmotion]?.label}
                            <br />
                            会話の内容に応じてAIが自動的に感情を変化させます
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingChar.features.affectionEnabled}
                      onChange={(e) => updateEditingField('features.affectionEnabled', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <div className="font-medium">好感度システム</div>
                      <div className="text-sm text-gray-600">好感度を表示・管理</div>
                    </div>
                  </label>

                  {editingChar.features.affectionEnabled && (
                    <div className="ml-8 space-y-3">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <label className="flex items-center gap-2 mb-3">
                          <input
                            type="checkbox"
                            checked={editingChar.features.autoManageAffection !== false}
                            onChange={(e) => updateEditingField('features.autoManageAffection', e.target.checked)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            🤖 自動管理（AIが会話に応じて好感度を変化させる）
                          </span>
                        </label>
                        
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {editingChar.features.autoManageAffection !== false ? '初期好感度' : '現在の好感度'}: {editingChar.features.affectionLevel}
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={editingChar.features.affectionLevel}
                            onChange={(e) => updateEditingField('features.affectionLevel', Number(e.target.value))}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>0（最低）</span>
                            <span>50（普通）</span>
                            <span>100（最高）</span>
                          </div>
                        </div>
                        
                        {editingChar.features.autoManageAffection !== false ? (
                          <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                            💡 会話開始時の好感度: {editingChar.features.affectionLevel}/100
                            <br />
                            会話の内容に応じてAIが自動的に好感度を変化させます
                            <br />
                            （ポジティブな会話で上昇、ネガティブな会話で下降）
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                            ⚠️ 手動モード: 好感度は固定されます
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingChar.features.avatarEnabled}
                      onChange={(e) => updateEditingField('features.avatarEnabled', e.target.checked)}
                      className="w-5 h-5"
                    />
                    <div className="flex-1">
                      <div className="font-medium">アバター表示</div>
                      <div className="text-sm text-gray-600">アイコン・絵文字を表示</div>
                    </div>
                  </label>

                  {editingChar.features.avatarEnabled && (
                    <div className="ml-8 p-3 bg-gray-50 rounded-lg space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">アバタータイプ</label>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateEditingField('features.avatarType', 'emoji');
                            }}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                              editingChar.features.avatarType === 'emoji'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            😊 絵文字
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              updateEditingField('features.avatarType', 'image');
                            }}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                              editingChar.features.avatarType === 'image'
                                ? 'bg-purple-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            🖼️ 画像
                          </button>
                        </div>
                      </div>

                      {editingChar.features.avatarType === 'emoji' ? (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">絵文字</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg p-4">
                              <span className="text-5xl">{editingChar.features.avatar || '😊'}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowEmojiPicker(true);
                              }}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                            >
                              変更
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">画像</label>
                          
                          {editingChar.features.avatarImage ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 flex items-center justify-center bg-white border-2 border-gray-300 rounded-lg p-4">
                                  <img 
                                    src={editingChar.features.avatarImage} 
                                    alt="avatar" 
                                    className="w-24 h-24 rounded-full object-cover"
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      imageInputRef.current?.click();
                                    }}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 whitespace-nowrap"
                                  >
                                    変更
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateEditingField('features.avatarImage', null);
                                    }}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 whitespace-nowrap"
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div
                              onDragOver={handleDragOver}
                              onDragEnter={handleDragEnter}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
                                isDragging
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-300 bg-white hover:border-gray-400'
                              }`}
                            >
                              <div className="flex flex-col items-center justify-center gap-3">
                                <div className="text-4xl">
                                  {isDragging ? '📥' : '🖼️'}
                                </div>
                                <div className="text-center">
                                  <p className="text-sm font-medium text-gray-700 mb-1">
                                    {isDragging ? '画像をドロップ' : '画像をドラッグ＆ドロップ'}
                                  </p>
                                  <p className="text-xs text-gray-500 mb-3">または</p>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      imageInputRef.current?.click();
                                    }}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                                  >
                                    ファイルを選択
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-500 mt-2">
                            💡 画像をアップロード後、円形にクロップできます（PNG, JPG, GIF対応）
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'edit' && editingChar && (
          <div className="border-t bg-white p-4 flex-shrink-0">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSaveEdit();
                }}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                保存
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCancelEdit();
                }}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            updateEditingField('features.avatar', emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {showImageCropper && uploadedImage && (
        <ImageCropper
          imageSrc={uploadedImage}
          onCrop={handleImageCrop}
          onCancel={() => {
            setShowImageCropper(false);
            setUploadedImage(null);
          }}
        />
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        onClick={(e) => e.stopPropagation()}
        className="hidden"
      />
    </div>
  );
};

export default CharacterChat;
