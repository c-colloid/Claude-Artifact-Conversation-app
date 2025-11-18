/**
 * Multi Character Chat Application
 *
 * 複数キャラクターが参加できる会話アプリケーション
 *
 * 主な機能:
 * - 複数キャラクターによる同時会話
 * - キャラクター管理（作成、編集、削除、派生キャラクター）
 * - 感情システム（7種類の感情、自動/手動管理）
 * - 好感度システム（0-100、自動/手動管理）
 * - アバター機能（絵文字/画像、ドラッグ&ドロップ、画像クロップ）
 * - 地の文機能（自動生成可能）
 * - 会話分岐機能
 * - 会話設定（背景情報、関係性定義）
 * - Extended Thinking対応
 * - データのインポート/エクスポート
 * - LocalStorageによる自動保存
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AlertCircle, Trash2, Edit2, RotateCcw, Send, Plus, Eye, EyeOff, Settings, Menu, X, Hash, RefreshCw, Save, HardDrive, User, Heart, Download, Upload, ChevronDown, ChevronRight, Layers, Copy, MessageSquare, Check, Users, BookOpen, FileText, Image, History, ChevronUp, SkipForward } from 'lucide-react';

/**
 * デバウンス関数
 * 連続した呼び出しを遅延させ、最後の呼び出しのみを実行する
 * @param {Function} func - 実行する関数
 * @param {number} delay - 遅延時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * スロットル関数
 * 一定時間内に1回のみ関数を実行する
 * @param {Function} func - 実行する関数
 * @param {number} limit - 実行間隔（ミリ秒）
 * @returns {Function} スロットルされた関数
 */
const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * 画像圧縮関数
 * アバター画像を最適化してファイルサイズを削減
 *
 * @param {File} file - 圧縮する画像ファイル
 * @param {number} maxSize - 最大サイズ（ピクセル、デフォルト: 200）
 * @param {number} quality - 圧縮品質（0-1、デフォルト: 0.7）
 * @returns {Promise<string>} Base64エンコードされた圧縮画像
 *
 * 機能:
 * - アスペクト比を維持したリサイズ
 * - WebP形式でエクスポート（70%品質）
 * - ファイルサイズを60-80%削減
 */
const compressImage = async (file, maxSize = 200, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // アスペクト比を維持してリサイズ
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // WebP形式でエクスポート（ブラウザが対応していない場合はJPEG）
        const mimeType = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
          ? 'image/webp'
          : 'image/jpeg';

        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * IndexedDB データベースラッパー
 * LocalStorageの制限を解消し、非同期でデータを保存・読み込み
 *
 * 機能:
 * - 非同期データ操作（UIブロッキングなし）
 * - 無制限のストレージ容量
 * - 構造化されたデータストア
 * - 10-20倍の保存速度（大量データ時）
 */
const IndexedDBWrapper = {
  DB_NAME: 'MultiCharacterChatDB',
  DB_VERSION: 1,
  STORE_NAME: 'appData',
  dbInstance: null,

  /**
   * データベースを開く（接続をキャッシュして再利用）
   * @returns {Promise<IDBDatabase>}
   */
  openDB: function() {
    if (this.dbInstance) {
      return Promise.resolve(this.dbInstance);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        reject(new Error('IndexedDBを開けませんでした'));
      };

      request.onsuccess = () => {
        this.dbInstance = request.result;
        resolve(this.dbInstance);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // オブジェクトストアが存在しない場合は作成
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const objectStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  },

  /**
   * トランザクションを実行する共通ヘルパー
   * @param {string} mode - 'readonly' または 'readwrite'
   * @param {function} operation - (objectStore) => IDBRequest を返す関数
   * @param {string} errorMsg - エラー時のメッセージ
   * @param {function} processResult - (result) => 処理結果を返す関数（オプション）
   * @returns {Promise<any>}
   */
  executeTransaction: async function(mode, operation, errorMsg, processResult) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], mode);
      const objectStore = transaction.objectStore(this.STORE_NAME);
      const request = operation(objectStore);

      request.onsuccess = () => resolve(processResult ? processResult(request.result) : undefined);
      request.onerror = () => reject(new Error(errorMsg));
    });
  },

  /**
   * データを保存
   */
  setItem: async function(key, value) {
    return this.executeTransaction('readwrite',
      (store) => store.put({ key, value, timestamp: new Date().toISOString() }),
      'データの保存に失敗しました'
    );
  },

  /**
   * データを読み込み
   */
  getItem: async function(key) {
    return this.executeTransaction('readonly',
      (store) => store.get(key),
      'データの読み込みに失敗しました',
      (result) => result ? result.value : null
    );
  },

  /**
   * データを削除
   */
  removeItem: async function(key) {
    return this.executeTransaction('readwrite',
      (store) => store.delete(key),
      'データの削除に失敗しました'
    );
  },

  /**
   * すべてのデータをクリア
   */
  clear: async function() {
    return this.executeTransaction('readwrite',
      (store) => store.clear(),
      'データのクリアに失敗しました'
    );
  },
};

const MultiCharacterChat = () => {
  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);

  // Characters state
  const [characters, setCharacters] = useState([]);
  const [characterGroups, setCharacterGroups] = useState([]);
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
  const [editingConversationTitle, setEditingConversationTitle] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // Version management state
  const [showVersions, setShowVersions] = useState({});

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
  const [sidebarView, setSidebarView] = useState('conversations'); // 'conversations', 'messages', 'stats'
  const [showConversationSettings, setShowConversationSettings] = useState(false);

  // Message display optimization
  const [visibleMessageCount, setVisibleMessageCount] = useState(100);
  const MESSAGE_LOAD_INCREMENT = 50; // 「もっと見る」で読み込む件数

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Refs
  const messagesEndRef = useRef(null);
  const characterFileInputRef = useRef(null);
  const conversationFileInputRef = useRef(null);
  const messageRefs = useRef({});
  const textareaRef = useRef(null);

  // ===== 定数定義 =====
  const STORAGE_KEY = 'multi-character-chat-data-v1';
  const AUTO_SAVE_DELAY = 2000; // ミリ秒
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

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
    baseCharacterId: null, // For derived characters
    overrides: {}, // Which properties are overridden from base
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
      autoManageEmotion: true,
      autoManageAffection: true,
      currentEmotion: 'neutral',
      affectionLevel: 50,
      avatar: '😊',
      avatarType: 'emoji', // 'emoji' or 'image'
      avatarImage: null // base64 encoded image data
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
    autoGenerateNarration: false, // AI automatically generates narration
    relationships: [], // Array of {char1Id, char2Id, type, description}
    parentConversationId: null, // For forked conversations
    forkPoint: null, // Message index where this was forked
    messages: [],
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  });

  // ===== パフォーマンス最適化: useMemoで計算コストの高い値をメモ化 =====

  // 現在の会話をメモ化
  /**
   * 現在選択されている会話を取得（useMemoでメモ化）
   * conversationsまたはcurrentConversationIdが変更された時のみ再計算
   */
  const getCurrentConversation = useMemo(() => {
    return conversations.find(c => c.id === currentConversationId);
  }, [conversations, currentConversationId]);

  /**
   * 現在の会話の全メッセージを取得（内部処理用）
   * 編集、削除、フォークなどの機能で使用
   * getCurrentConversationが変更された時のみ再計算
   */
  const getAllMessages = useMemo(() => {
    if (!getCurrentConversation) return [];
    return getCurrentConversation.messages || [];
  }, [getCurrentConversation]);

  /**
   * 表示用のメッセージリスト（パフォーマンス最適化）
   * 最新からvisibleMessageCount件のみを表示
   * 長い会話でのレンダリング負荷を削減
   */
  const getVisibleMessages = useMemo(() => {
    if (getAllMessages.length <= visibleMessageCount) {
      return getAllMessages;
    }
    // 最新のN件を取得（配列の末尾から）
    return getAllMessages.slice(-visibleMessageCount);
  }, [getAllMessages, visibleMessageCount]);

  /**
   * 後方互換性のため、getCurrentMessagesをgetAllMessagesのエイリアスとして保持
   * 元の実装との互換性を維持
   */
  const getCurrentMessages = getAllMessages;

  // キャラクター検索をメモ化（useCallback）
  const getCharacterById = useCallback((id) => {
    return characters.find(c => c.id === id);
  }, [characters]);

  // 派生キャラクターを含む実効的なキャラクター情報を取得（useCallbackでメモ化）
  const getEffectiveCharacter = useCallback((character) => {
    if (!character) return null;

    // If no base, return as-is
    if (!character.baseCharacterId) {
      return character;
    }

    // Get base character
    const baseChar = getCharacterById(character.baseCharacterId);
    if (!baseChar) {
      // Base not found, return as-is
      return character;
    }

    // Get effective base (recursive for multi-level inheritance)
    const effectiveBase = getEffectiveCharacter(baseChar);

    // Merge properties
    const merged = {
      ...character,
      definition: {
        personality: character.overrides.personality ? character.definition.personality : effectiveBase.definition.personality,
        speakingStyle: character.overrides.speakingStyle ? character.definition.speakingStyle : effectiveBase.definition.speakingStyle,
        firstPerson: character.overrides.firstPerson ? character.definition.firstPerson : effectiveBase.definition.firstPerson,
        secondPerson: character.overrides.secondPerson ? character.definition.secondPerson : effectiveBase.definition.secondPerson,
        background: character.overrides.background ? character.definition.background : effectiveBase.definition.background,
        catchphrases: character.overrides.catchphrases ? character.definition.catchphrases : effectiveBase.definition.catchphrases,
        customPrompt: character.overrides.customPrompt ? character.definition.customPrompt : effectiveBase.definition.customPrompt
      },
      features: {
        emotionEnabled: character.overrides.emotionEnabled !== undefined ? character.features.emotionEnabled : effectiveBase.features.emotionEnabled,
        affectionEnabled: character.overrides.affectionEnabled !== undefined ? character.features.affectionEnabled : effectiveBase.features.affectionEnabled,
        autoManageEmotion: character.overrides.autoManageEmotion !== undefined ? character.features.autoManageEmotion : effectiveBase.features.autoManageEmotion,
        autoManageAffection: character.overrides.autoManageAffection !== undefined ? character.features.autoManageAffection : effectiveBase.features.autoManageAffection,
        currentEmotion: character.overrides.currentEmotion ? character.features.currentEmotion : effectiveBase.features.currentEmotion,
        affectionLevel: character.overrides.affectionLevel !== undefined ? character.features.affectionLevel : effectiveBase.features.affectionLevel,
        avatar: character.overrides.avatar ? character.features.avatar : effectiveBase.features.avatar
      }
    };

    return merged;
  }, [getCharacterById]);

  const parseMultiCharacterResponse = (responseText, conversation, thinkingContent, responseGroupId = null) => {
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

          const messageId = generateId();
          const timestamp = new Date().toISOString();

          messages.push({
            id: messageId,
            role: 'assistant',
            type: currentType || 'character',
            characterId: currentCharacterId,
            content: content,
            emotion: emotion,
            affection: affection,
            thinking: !thinkingAdded && thinkingContent ? thinkingContent : '',
            timestamp: timestamp,
            responseGroupId: responseGroupId,
            alternatives: [{
              id: generateId(),
              content: content,
              emotion: emotion,
              affection: affection,
              thinking: !thinkingAdded && thinkingContent ? thinkingContent : '',
              timestamp: timestamp,
              isActive: true
            }]
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

      const messageId = generateId();
      const timestamp = new Date().toISOString();

      messages.push({
        id: messageId,
        role: 'assistant',
        type: messageType,
        characterId: characterId,
        content: cleanContent,
        thinking: thinkingContent,
        timestamp: timestamp,
        responseGroupId: responseGroupId,
        alternatives: [{
          id: generateId(),
          content: cleanContent,
          emotion: null,
          affection: null,
          thinking: thinkingContent,
          timestamp: timestamp,
          isActive: true
        }]
      });
    }

    return { messages, characterUpdates };
  };

  /**
   * キャラクター更新（useCallbackでメモ化）
   * 依存関係なし（setCharactersは安定）
   */
  const updateCharacter = useCallback((characterId, updates) => {
    setCharacters(chars => chars.map(c =>
      c.id === characterId
        ? { ...c, ...updates, updated: new Date().toISOString() }
        : c
    ));
  }, []);

  /**
   * 会話更新（useCallbackでメモ化）
   * 依存関係なし（setConversationsは安定）
   */
  const updateConversation = useCallback((conversationId, updates) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, ...updates, updated: new Date().toISOString() }
        : conv
    ));
  }, []);

  // システムプロンプトを構築（useCallbackでメモ化）
  /**
   * 参加キャラクターのリストをメモ化
   * 現在の会話の参加者IDとキャラクター配列が変更された時のみ再計算
   * getEffectiveCharacter適用で派生キャラクターを解決
   */
  const participantCharacters = useMemo(() => {
    if (!getCurrentConversation) return [];
    return getCurrentConversation.participantIds
      .map(id => getCharacterById(id))
      .map(c => getEffectiveCharacter(c))
      .filter(c => c);
  }, [getCurrentConversation, getCharacterById, getEffectiveCharacter]);

  /**
   * 会話リストを更新日時でソート（useMemoでメモ化）
   * conversationsが変更された時のみ再ソート
   */
  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }, [conversations]);

  // システムプロンプトを構築（useCallbackでメモ化）
  const buildSystemPrompt = useCallback((conversation, nextSpeakerId = null) => {
    if (!conversation) return '';

    const participants = conversation.participantIds
      .map(id => getCharacterById(id))
      .map(c => getEffectiveCharacter(c)) // Apply inheritance
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
        const char1 = rel.char1Id === '__user__' ? { name: 'ユーザー' } : participants.find(c => c.id === rel.char1Id);
        const char2 = rel.char2Id === '__user__' ? { name: 'ユーザー' } : participants.find(c => c.id === rel.char2Id);
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
    if (nextSpeakerId) {
      const nextChar = participants.find(c => c.id === nextSpeakerId);
      if (nextChar) {
        prompt += `1. **次は${nextChar.name}として発言してください**\n`;
        prompt += `2. **[CHARACTER:${nextChar.name}] タグを行の先頭に必ず出力してください**\n`;
        prompt += `   - タグの後に改行してから発言内容を書いてください\n`;
        prompt += `   - タグと発言内容を同じ行に書かないでください\n`;
      }
    } else {
      prompt += `1. 次に発言すべきキャラクターを判断し、そのキャラクターとして発言してください\n`;
      prompt += `2. **[CHARACTER:キャラクター名] タグを行の先頭に必ず出力してください**\n`;
      prompt += `   - タグの後に改行してから発言内容を書いてください\n`;
      prompt += `   - タグと発言内容を同じ行に書かないでください\n`;
    }

    prompt += `3. **複数のキャラクターが発言する場合**\n`;
    prompt += `   - 各キャラクターの発言の前に必ず [CHARACTER:キャラクター名] タグを付けてください\n`;
    prompt += `   - キャラクター間の発言は空行で区切ってください\n`;
    prompt += `4. 各キャラクターの個性を維持し、自然な会話の流れを作ってください\n`;
    prompt += `5. 一人称・二人称は各キャラクターの設定に従ってください\n`;

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
      if (conversation.autoGenerateNarration) {
        prompt += `${narrationNum}. **地の文を自動生成**: 会話の合間に [NARRATION] タグで地の文を積極的に挿入してください\n`;
        prompt += `   - 情景描写: 周囲の環境、天気、雰囲気など\n`;
        prompt += `   - 行動描写: キャラクターの動作、表情、仕草など\n`;
        prompt += `   - 心理描写: キャラクターの内面、思考など\n`;
        prompt += `   - 複数のキャラクター発言の合間に自然に挿入してください\n`;
      } else {
        prompt += `${narrationNum}. 必要に応じて [NARRATION] タグで地の文(情景描写、行動描写)を追加できます\n`;
      }
    }

    prompt += `\n## 出力形式の例\n\n`;
    prompt += `**単一キャラクターの発言:**\n`;
    prompt += `[CHARACTER:${participants[0]?.name || 'アリス'}]\n`;
    prompt += `${participants[0]?.definition.firstPerson || '私'}も同じ意見だよ!\n\n`;

    if (participants.length > 1) {
      prompt += `**複数キャラクターの発言:**\n`;
      prompt += `[CHARACTER:${participants[0]?.name || 'アリス'}]\n`;
      prompt += `そうだね、行こうか！\n\n`;
      prompt += `[CHARACTER:${participants[1]?.name || 'ボブ'}]\n`;
      prompt += `いいアイデアだね！\n\n`;
    }

    if (conversation.narrationEnabled) {
      prompt += `**地の文を含む場合:**\n`;
      prompt += `[NARRATION]\n`;
      prompt += `二人は笑顔で頷き合った。窓の外では、春の陽気な光が差し込んでいる。\n\n`;
      prompt += `[CHARACTER:${participants[0]?.name || 'アリス'}]\n`;
      prompt += `じゃあ、準備しようか！\n\n`;
    }

    prompt += `\n**重要: 必ず各発言の前にタグを付け、タグと内容は改行で分けてください。**\n`;

    return prompt;
  }, [getCharacterById, getEffectiveCharacter]);

  /**
   * 新規会話作成（useCallbackでメモ化）
   * getDefaultConversation関数が変更された時のみ再生成
   */
  const createNewConversation = useCallback(() => {
    const newConv = getDefaultConversation();
    setConversations(prev => [...prev, newConv]);
    setCurrentConversationId(newConv.id);
    return newConv.id;
  }, []);

  /**
   * 会話を分岐（useCallbackでメモ化）
   * conversationsが変更された時のみ再生成
   */
  const forkConversation = useCallback((conversationId, messageIndex) => {
    const originalConv = conversations.find(c => c.id === conversationId);
    if (!originalConv) return;

    // メッセージ配列が存在し、messageIndexが有効範囲内であることを確認
    const originalMessages = originalConv.messages || [];
    if (messageIndex < 0 || messageIndex >= originalMessages.length) {
      console.error(`Invalid messageIndex: ${messageIndex}, messages length: ${originalMessages.length}`);
      return;
    }

    // 分岐点までのメッセージをディープコピー
    const forkedMessages = originalMessages.slice(0, messageIndex + 1).map(msg => ({...msg}));

    const forkedConv = {
      ...getDefaultConversation(),
      title: `${originalConv.title}（分岐${messageIndex + 1}）`,
      participantIds: [...originalConv.participantIds],
      backgroundInfo: originalConv.backgroundInfo,
      narrationEnabled: originalConv.narrationEnabled,
      autoGenerateNarration: originalConv.autoGenerateNarration,
      relationships: originalConv.relationships ? [...originalConv.relationships] : [],
      parentConversationId: conversationId,
      forkPoint: messageIndex,
      messages: forkedMessages
    };

    setConversations(prev => [...prev, forkedConv]);
    setCurrentConversationId(forkedConv.id);
    return forkedConv.id;
  }, [conversations, getDefaultConversation]);

  /**
   * 会話削除（useCallbackでメモ化）
   * conversations, currentConversationId, createNewConversationが変更された時のみ再生成
   */
  const deleteConversation = useCallback((conversationId) => {
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
  }, [conversations, currentConversationId, createNewConversation]);

  // Character Group Management
  const createCharacterGroup = (name, characterIds) => {
    const newGroup = {
      id: generateId(),
      name,
      characterIds,
      created: new Date().toISOString()
    };
    setCharacterGroups(prev => [...prev, newGroup]);
    return newGroup.id;
  };

  const updateCharacterGroup = (groupId, updates) => {
    setCharacterGroups(prev =>
      prev.map(group => group.id === groupId ? { ...group, ...updates } : group)
    );
  };

  const deleteCharacterGroup = (groupId) => {
    setCharacterGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const applyCharacterGroup = (groupId) => {
    const group = characterGroups.find(g => g.id === groupId);
    if (!group || !currentConversationId) return;

    // Add all characters from the group to the current conversation
    const currentConv = getCurrentConversation;
    if (!currentConv) return;

    const newParticipantIds = [...new Set([...currentConv.participantIds, ...group.characterIds])];
    updateConversation(currentConversationId, {
      participantIds: newParticipantIds
    });
  };

  // Stats calculation
  const getConversationStats = () => {
    const currentConv = getCurrentConversation;
    if (!currentConv) return null;

    const stats = {
      totalMessages: currentConv.messages.length,
      userMessages: 0,
      characterMessages: {},
      narrationCount: 0,
      characterAffection: {}
    };

    currentConv.messages.forEach(msg => {
      if (msg.type === 'user') {
        stats.userMessages++;
      } else if (msg.type === 'narration') {
        stats.narrationCount++;
      } else if (msg.type === 'character' && msg.characterId) {
        stats.characterMessages[msg.characterId] = (stats.characterMessages[msg.characterId] || 0) + 1;

        if (msg.affection !== undefined) {
          if (!stats.characterAffection[msg.characterId]) {
            stats.characterAffection[msg.characterId] = [];
          }
          stats.characterAffection[msg.characterId].push(msg.affection);
        }
      }
    });

    return stats;
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

  /**
   * キャラクター複製（useCallbackでメモ化）
   * charactersが変更された時のみ再生成
   */
  const duplicateCharacter = useCallback((charId) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const newChar = {
      ...JSON.parse(JSON.stringify(char)),
      id: generateId(),
      name: `${char.name}（コピー）`,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    setCharacters(prev => [...prev, newChar]);
  }, [characters]);

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
      const conversation = getCurrentConversation;
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
          // 重要: roleはmsg.roleをそのまま使う（地の文がassistantから来た場合はassistantのまま）
          role: msg.role,
          content: content
        };
      });

      // 連続する同じroleのメッセージを結合（Claude APIの制約に対応）
      const mergedMessages = [];
      for (let i = 0; i < sanitizedMessages.length; i++) {
        const current = sanitizedMessages[i];

        if (mergedMessages.length > 0 &&
            mergedMessages[mergedMessages.length - 1].role === current.role) {
          // 直前と同じroleなら結合
          mergedMessages[mergedMessages.length - 1].content += '\n\n' + current.content;
        } else {
          mergedMessages.push({ ...current });
        }
      }

      const finalMessages = [...mergedMessages];
      
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

      // Generate a unique group ID for all messages from this API response
      const responseGroupId = generateId();

      // Parse and split response into multiple messages
      const { messages: parsedMessages, characterUpdates } = parseMultiCharacterResponse(fullContent, conversation, thinkingContent, responseGroupId);

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
      const conv = getCurrentConversation;
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

  /**
   * メッセージ送信（useCallbackでメモ化）
   * userPrompt, currentConversationId, messageType, nextSpeaker, getCurrentMessages,
   * updateConversation, generateResponseが変更された時のみ再生成
   */
  const handleSend = useCallback(async () => {
    if (!userPrompt.trim()) return;
    if (!currentConversationId) {
      setError('会話を選択してください');
      return;
    }

    const newMessage = {
      id: generateId(),
      role: 'user',
      type: messageType,
      content: userPrompt,
      timestamp: new Date().toISOString(),
      responseGroupId: null,
      alternatives: null
    };

    const currentMessages = getCurrentMessages;
    const newHistory = [...currentMessages, newMessage];

    updateConversation(currentConversationId, {
      messages: newHistory
    });

    await generateResponse(newHistory, true, null, nextSpeaker);
    setNextSpeaker(null); // Reset next speaker after use
  }, [userPrompt, currentConversationId, messageType, nextSpeaker, getCurrentMessages, updateConversation, generateResponse]);

  /**
   * メッセージ編集開始（useCallbackでメモ化）
   * getCurrentMessagesが変更された時のみ再生成
   */
  const handleEdit = useCallback((index) => {
    setEditingIndex(index);
    setEditingContent(getAllMessages[index].content);
  }, [getAllMessages]);

  /**
   * メッセージ編集保存（useCallbackでメモ化）
   * getAllMessages, editingContent, currentConversationId, updateConversationが変更された時のみ再生成
   */
  const handleSaveEdit = useCallback((index) => {
    const currentMessages = getAllMessages;
    const updated = [...currentMessages];
    updated[index].content = editingContent;

    updateConversation(currentConversationId, {
      messages: updated
    });

    setEditingIndex(null);
  }, [getAllMessages, editingContent, currentConversationId, updateConversation]);

  /**
   * メッセージ編集キャンセル（useCallbackでメモ化）
   */
  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  /**
   * メッセージ削除（useCallbackでメモ化）
   * getAllMessages, currentConversationId, updateConversationが変更された時のみ再生成
   */
  const handleDelete = useCallback((index) => {
    const currentMessages = getAllMessages;
    const updated = currentMessages.filter((_, i) => i !== index);

    updateConversation(currentConversationId, {
      messages: updated
    });
  }, [getAllMessages, currentConversationId, updateConversation]);

  /**
   * 会話分岐（useCallbackでメモ化）
   * currentConversationId, forkConversationが変更された時のみ再生成
   */
  const handleFork = useCallback((index) => {
    if (!currentConversationId) return;
    forkConversation(currentConversationId, index);
  }, [currentConversationId, forkConversation]);

  /**
   * 指定位置から再生成（useCallbackでメモ化）
   * getAllMessages, currentConversationId, updateConversation, regeneratePrefillが変更された時のみ再生成
   */
  /**
   * グループ内再生成（同じAPI呼び出しグループ内のこのバブル以降を再生成）
   */
  const handleRegenerateGroup = useCallback(async (index) => {
    const currentMessages = getAllMessages;
    const targetMessage = currentMessages[index];

    if (!targetMessage) {
      setError('メッセージが見つかりません。');
      return;
    }

    if (targetMessage.role !== 'assistant') {
      setError(`アシスタントメッセージのみ再生成できます。（現在のロール: ${targetMessage.role || 'なし'}、タイプ: ${targetMessage.type || 'なし'}）`);
      return;
    }

    // 直前のuserメッセージまで遡る
    let userMessageIndex = index - 1;
    while (userMessageIndex >= 0 && currentMessages[userMessageIndex].role === 'assistant') {
      userMessageIndex--;
    }

    if (userMessageIndex < 0 || currentMessages[userMessageIndex].role !== 'user') {
      setError('再生成できるユーザーメッセージが見つかりません。');
      return;
    }

    // userメッセージまでの履歴を取得
    const historyUpToPoint = currentMessages.slice(0, userMessageIndex + 1);

    // 同じグループ内の、再生成対象より前のメッセージを取得
    const sameGroupMessages = [];
    if (targetMessage.responseGroupId) {
      for (let i = userMessageIndex + 1; i < index; i++) {
        if (currentMessages[i].responseGroupId === targetMessage.responseGroupId) {
          sameGroupMessages.push(currentMessages[i]);
        }
      }
    }

    // プリフィルテキストを構築
    let prefillParts = [];

    for (const msg of sameGroupMessages) {
      if (msg.type === 'narration') {
        prefillParts.push(`[NARRATION]\n${msg.content}`);
      } else if (msg.type === 'character') {
        const char = getCharacterById(msg.characterId);
        prefillParts.push(`[CHARACTER:${char?.name}]\n${msg.content}`);
      }
    }

    // targetMessageの開始タグを追加
    if (targetMessage.type === 'narration') {
      prefillParts.push('[NARRATION]\n');
    } else if (targetMessage.type === 'character') {
      const char = getCharacterById(targetMessage.characterId);
      prefillParts.push(`[CHARACTER:${char?.name}]\n`);
    }

    // ユーザーのカスタムプリフィルを追加
    if (regeneratePrefill) {
      prefillParts[prefillParts.length - 1] += regeneratePrefill;
    }

    const prefill = prefillParts.join('\n\n');

    // 一時的にメッセージを削除（targetMessage以降の同じグループを削除）
    const updatedMessages = currentMessages.filter((msg, i) => {
      if (i < index) return true;
      if (msg.responseGroupId && msg.responseGroupId === targetMessage.responseGroupId) return false;
      if (!msg.responseGroupId && i === index) return false;
      return true;
    });

    updateConversation(currentConversationId, {
      messages: updatedMessages
    });

    // API呼び出し
    await generateResponse(historyUpToPoint, false, prefill);

    setRegeneratePrefill('');
    setShowRegeneratePrefill(null);
  }, [getAllMessages, currentConversationId, updateConversation, regeneratePrefill, generateResponse, getCharacterById]);

  /**
   * 全体再生成（このバブル以降の全メッセージを再生成）
   */
  const handleRegenerateFrom = useCallback(async (index) => {
    const currentMessages = getAllMessages;

    // Prevent regenerating from index 0 which would clear all messages
    if (index === 0) {
      setError('最初のメッセージからは再生成できません。');
      return;
    }

    const historyUpToPoint = currentMessages.slice(0, index);

    updateConversation(currentConversationId, {
      messages: historyUpToPoint
    });

    // Only regenerate if the last message is from user
    if (historyUpToPoint.length > 0 && historyUpToPoint[historyUpToPoint.length - 1].role === 'user') {
      await generateResponse(historyUpToPoint, false, regeneratePrefill);
    }

    setRegeneratePrefill('');
    setShowRegeneratePrefill(null);
  }, [getAllMessages, currentConversationId, updateConversation, regeneratePrefill, generateResponse]);

  /**
   * バージョン切り替え
   */
  const handleSwitchVersion = useCallback((messageIndex, alternativeId) => {
    const currentMessages = getAllMessages;
    const message = currentMessages[messageIndex];

    if (!message || !message.alternatives) return;

    const selectedAlt = message.alternatives.find(alt => alt.id === alternativeId);
    if (!selectedAlt) return;

    const updatedMessage = {
      ...message,
      content: selectedAlt.content,
      emotion: selectedAlt.emotion,
      affection: selectedAlt.affection,
      thinking: selectedAlt.thinking,
      alternatives: message.alternatives.map(alt => ({
        ...alt,
        isActive: alt.id === alternativeId
      }))
    };

    const updatedMessages = currentMessages.map((msg, i) =>
      i === messageIndex ? updatedMessage : msg
    );

    updateConversation(currentConversationId, {
      messages: updatedMessages
    });
  }, [getAllMessages, currentConversationId, updateConversation]);

  const scrollToMessage = useCallback((index) => {
    // メッセージが表示範囲外の場合、visibleMessageCountを調整
    const totalMessages = getAllMessages.length;
    const currentStartIndex = totalMessages <= visibleMessageCount ? 0 : totalMessages - visibleMessageCount;

    if (index < currentStartIndex) {
      // メッセージが表示範囲より前にある場合、表示範囲を拡張
      const newVisibleCount = totalMessages - index;
      setVisibleMessageCount(newVisibleCount);

      // 少し遅延させてからスクロール（DOM更新を待つ）
      setTimeout(() => {
        messageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      // メッセージが表示範囲内にある場合、即座にスクロール
      messageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setShowSidebar(false);
  }, [getAllMessages.length, visibleMessageCount]);

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

  /**
   * データをストレージに保存
   * IndexedDBを使用した非同期保存（UIブロッキングなし）
   * LocalStorageも併用してフォールバック対応
   */
  const saveToStorage = useCallback(async () => {
    if (!autoSaveEnabled || !isInitialized) return;

    setSaveStatus('saving');
    try {
      const saveData = {
        characters,
        characterGroups,
        conversations,
        currentConversationId,
        selectedModel,
        thinkingEnabled,
        thinkingBudget,
        usageStats,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };

      // IndexedDBに保存（非同期、UIブロッキングなし）
      await IndexedDBWrapper.setItem(STORAGE_KEY, saveData);

      // フォールバック用にLocalStorageにも保存
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      } catch (localStorageErr) {
        // LocalStorageの容量制限エラーは無視（IndexedDBがメイン）
        console.warn('LocalStorage save failed (quota exceeded), using IndexedDB only:', localStorageErr);
      }

      setLastSaved(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [characters, characterGroups, conversations, currentConversationId, selectedModel, thinkingEnabled, thinkingBudget, usageStats, autoSaveEnabled, isInitialized]);

  /**
   * デバウンスされた自動保存関数
   * 2秒の遅延で保存を実行し、頻繁な保存を防ぐ
   */
  const debouncedSave = useMemo(
    () => debounce(() => {
      saveToStorage();
    }, AUTO_SAVE_DELAY),
    [saveToStorage]
  );

  /**
   * ストレージからデータを読み込み
   * IndexedDBから読み込み、失敗時はLocalStorageからフォールバック
   * LocalStorageからIndexedDBへの自動マイグレーション付き
   */
  const loadFromStorage = async () => {
    try {
      let data = null;

      // まずIndexedDBから読み込み
      try {
        data = await IndexedDBWrapper.getItem(STORAGE_KEY);
      } catch (indexedDBErr) {
        console.warn('IndexedDB load failed, trying LocalStorage:', indexedDBErr);
      }

      // IndexedDBにデータがない場合、LocalStorageから読み込んでマイグレーション
      if (!data) {
        const dataString = localStorage.getItem(STORAGE_KEY);
        if (dataString) {
          data = JSON.parse(dataString);

          // LocalStorageからIndexedDBへマイグレーション
          if (data) {
            console.log('Migrating data from LocalStorage to IndexedDB...');
            try {
              await IndexedDBWrapper.setItem(STORAGE_KEY, data);
              console.log('Migration complete');
            } catch (migrationErr) {
              console.error('Migration failed:', migrationErr);
            }
          }
        }
      }

      if (data) {
        if (data.characters && data.characters.length > 0) {
          // Migrate characters to add missing features
          const migratedCharacters = data.characters.map(char => {
            const features = char.features || {};
            const definition = char.definition || {};
            return {
              ...char,
              baseCharacterId: char.baseCharacterId || null,
              overrides: char.overrides || {},
              definition: {
                ...definition,
                customPrompt: definition.customPrompt || ''
              },
              features: {
                emotionEnabled: features.emotionEnabled !== undefined ? features.emotionEnabled : true,
                affectionEnabled: features.affectionEnabled !== undefined ? features.affectionEnabled : false,
                autoManageEmotion: features.autoManageEmotion !== undefined ? features.autoManageEmotion : true,
                autoManageAffection: features.autoManageAffection !== undefined ? features.autoManageAffection : true,
                currentEmotion: features.currentEmotion || 'neutral',
                affectionLevel: features.affectionLevel !== undefined ? features.affectionLevel : 50,
                avatar: features.avatar || '😊',
                avatarType: features.avatarType || 'emoji',
                avatarImage: features.avatarImage || null
              }
            };
          });
          setCharacters(migratedCharacters);
        }

        if (data.characterGroups && data.characterGroups.length > 0) {
          setCharacterGroups(data.characterGroups);
        }

        if (data.conversations && data.conversations.length > 0) {
          // Migrate conversations to add missing fields
          const migratedConversations = data.conversations.map(conv => ({
            ...conv,
            narrationEnabled: conv.narrationEnabled !== undefined ? conv.narrationEnabled : true,
            autoGenerateNarration: conv.autoGenerateNarration || false,
            backgroundInfo: conv.backgroundInfo || '',
            relationships: conv.relationships || [],
            parentConversationId: conv.parentConversationId || null,
            forkPoint: conv.forkPoint || null
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
    const initializeData = async () => {
      const hasData = await loadFromStorage();

      if (!hasData) {
        const defaultChar = getDefaultCharacter();
        setCharacters([defaultChar]);

        const defaultConv = getDefaultConversation();
        setConversations([defaultConv]);
        setCurrentConversationId(defaultConv.id);
      }

      setIsInitialized(true);
      fetchModels();
    };

    initializeData();
  }, []);

  /**
   * 自動保存Effect
   * データが変更されるたびにデバウンスされた保存を実行
   * デバウンス関数により、2秒以内の連続した変更は1回の保存にまとめられる
   */
  useEffect(() => {
    if (!isInitialized) return;
    debouncedSave();
  }, [characters, conversations, currentConversationId, selectedModel, thinkingEnabled, thinkingBudget, usageStats, autoSaveEnabled, isInitialized, debouncedSave]);

  /**
   * 会話切り替え時の処理
   * - スクロールを最下部に移動
   * - 表示メッセージ数をリセット（新しい会話では最新100件のみ表示）
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setVisibleMessageCount(100); // 会話切り替え時はリセット
  }, [currentConversationId]);

  /**
   * メッセージ追加時のスクロール処理
   * メッセージ数が変更されたら最下部にスクロール
   */
  useEffect(() => {
    if (getAllMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [getAllMessages.length]);

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

  const currentConversation = getCurrentConversation;
  const currentMessages = getCurrentMessages;

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
            <button
              onClick={() => setSidebarView('stats')}
              className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                sidebarView === 'stats'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={!currentConversation}
            >
              <BookOpen size={12} className="inline mr-1" />
              統計
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
                {sortedConversations.map((conv) => {
                    const isActive = currentConversationId === conv.id;
                    return (
                      <ConversationListItem
                        key={conv.id}
                        conversation={conv}
                        isActive={isActive}
                        onSelect={setCurrentConversationId}
                        onEditTitle={(id, title) => {
                          setEditingConversationTitle(id);
                          setEditingTitleText(title);
                        }}
                        onExport={exportConversation}
                        onDelete={deleteConversation}
                        editingConversationTitle={editingConversationTitle}
                        editingTitleText={editingTitleText}
                        setEditingTitleText={setEditingTitleText}
                        setEditingConversationTitle={setEditingConversationTitle}
                        updateConversation={updateConversation}
                      />
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">会話がありません</p>
            )}
          </>
          ) : sidebarView === 'messages' ? (
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
                      onClick={() => scrollToMessage(idx)}
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
                            {char && <AvatarDisplay character={char} size="sm" />}
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
          ) : sidebarView === 'stats' ? (
            <>
            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <BookOpen size={16} />
              統計情報
            </h3>
            {(() => {
              const stats = getConversationStats();
              if (!stats) return <p className="text-sm text-gray-500">統計情報がありません</p>;

              return (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-blue-800 mb-2">メッセージ</h4>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>総メッセージ数:</span>
                        <span className="font-semibold">{stats.totalMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>あなた:</span>
                        <span className="font-semibold text-blue-600">{stats.userMessages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>地の文:</span>
                        <span className="font-semibold text-amber-600">{stats.narrationCount}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <h4 className="font-semibold text-sm text-purple-800 mb-2">キャラクター発言数</h4>
                    <div className="text-xs space-y-1">
                      {Object.entries(stats.characterMessages).map(([charId, count]) => {
                        const char = getCharacterById(charId);
                        return (
                          <div key={charId} className="flex justify-between items-center">
                            <div className="flex items-center gap-1">
                              {char && <AvatarDisplay character={char} size="sm" />}
                              <span>{char?.name || '不明'}</span>
                            </div>
                            <span className="font-semibold text-purple-600">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {Object.keys(stats.characterAffection).length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <h4 className="font-semibold text-sm text-red-800 mb-2">平均好感度</h4>
                      <div className="text-xs space-y-1">
                        {Object.entries(stats.characterAffection).map(([charId, affections]) => {
                          const char = getCharacterById(charId);
                          const avg = Math.round(affections.reduce((a, b) => a + b, 0) / affections.length);
                          return (
                            <div key={charId} className="flex justify-between items-center">
                              <div className="flex items-center gap-1">
                                {char && <AvatarDisplay character={char} size="sm" />}
                                <span>{char?.name || '不明'}</span>
                              </div>
                              <span className="font-semibold text-red-600 flex items-center gap-1">
                                <Heart size={10} />
                                {avg}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            </>
          ) : null}
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

          {/* 「過去のメッセージを読み込む」ボタン */}
          {getAllMessages.length > visibleMessageCount && (
            <div className="text-center py-2">
              <button
                onClick={() => setVisibleMessageCount(prev => prev + MESSAGE_LOAD_INCREMENT)}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition text-sm font-medium flex items-center gap-2 mx-auto"
              >
                <ChevronDown size={16} />
                過去のメッセージを読み込む ({getAllMessages.length - visibleMessageCount}件)
              </button>
            </div>
          )}

          {getVisibleMessages.map((message, visibleIndex) => {
            // 実際のインデックスを計算（全メッセージ配列での位置）
            // visibleMessageCountより少ない場合は0から、多い場合は適切なオフセットを計算
            const startIndex = getAllMessages.length <= visibleMessageCount ? 0 : getAllMessages.length - visibleMessageCount;
            const actualIndex = startIndex + visibleIndex;
            return (
            <div key={actualIndex} ref={(el) => messageRefs.current[actualIndex] = el}>
            <MessageBubble
              message={message}
              index={actualIndex}
              character={message.characterId ? getCharacterById(message.characterId) : null}
              editingIndex={editingIndex}
              editingContent={editingContent}
              setEditingContent={setEditingContent}
              handleEdit={handleEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={() => setEditingIndex(null)}
              handleDelete={handleDelete}
              handleFork={handleFork}
              showRegeneratePrefill={showRegeneratePrefill}
              setShowRegeneratePrefill={setShowRegeneratePrefill}
              regeneratePrefill={regeneratePrefill}
              setRegeneratePrefill={setRegeneratePrefill}
              handleRegenerateGroup={handleRegenerateGroup}
              handleRegenerateFrom={handleRegenerateFrom}
              handleSwitchVersion={handleSwitchVersion}
              showVersions={showVersions}
              setShowVersions={setShowVersions}
              isLoading={isLoading}
              showThinking={showThinking}
              setShowThinking={setShowThinking}
              emotions={emotions}
            />
            </div>
            );
          })}

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
                  if (!char) return null;
                  const avatar = char.features.avatarType === 'emoji' ? char.features.avatar : '📷';
                  return (
                    <option key={charId} value={charId}>
                      {avatar} {char.name}
                    </option>
                  );
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
          characterGroups={characterGroups}
          setCharacterGroups={setCharacterGroups}
          getDefaultCharacter={getDefaultCharacter}
          exportCharacter={exportCharacter}
          importCharacter={importCharacter}
          characterFileInputRef={characterFileInputRef}
          emotions={emotions}
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

// ===== パフォーマンス最適化: React.memoでメモ化された会話リストアイテム =====
/**
 * 会話リストの個別アイテムコンポーネント
 * conversation.id, conversation.title, conversation.updated, isActiveが変更された時のみ再レンダリング
 */
const ConversationListItem = React.memo(({
  conversation,
  isActive,
  onSelect,
  onEditTitle,
  onExport,
  onDelete,
  editingConversationTitle,
  editingTitleText,
  setEditingTitleText,
  setEditingConversationTitle,
  updateConversation
}) => {
  return (
    <div
      className={`group rounded-lg transition ${
        isActive
          ? 'bg-indigo-100 border-2 border-indigo-500'
          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
      }`}
    >
      <div className="flex items-start gap-2 p-2">
        <button
          onClick={() => onSelect(conversation.id)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-center gap-2 mb-1">
            {isActive && <Check size={12} className="text-indigo-600 flex-shrink-0" />}
            {editingConversationTitle === conversation.id ? (
              <input
                type="text"
                value={editingTitleText}
                onChange={(e) => setEditingTitleText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateConversation(conversation.id, { title: editingTitleText });
                    setEditingConversationTitle(null);
                  } else if (e.key === 'Escape') {
                    setEditingConversationTitle(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                  updateConversation(conversation.id, { title: editingTitleText });
                  setEditingConversationTitle(null);
                }}
                autoFocus
                className="flex-1 px-2 py-0.5 text-sm font-semibold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <span className="font-semibold text-sm truncate">{conversation.title}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{conversation.messages.length}件</span>
            <span className="flex items-center gap-1">
              <Users size={10} />
              {conversation.participantIds.length}
            </span>
          </div>
        </button>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditTitle(conversation.id, conversation.title);
            }}
            className="p-1 hover:bg-blue-100 rounded"
            title="タイトル編集"
          >
            <Edit2 size={12} className="text-blue-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExport(conversation.id);
            }}
            className="p-1 hover:bg-green-100 rounded"
            title="エクスポート"
          >
            <Download size={12} className="text-green-600" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(conversation.id);
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
}, (prevProps, nextProps) => {
  // カスタム比較関数: 会話ID、タイトル、更新日時、アクティブ状態が同じなら再レンダリングしない
  return prevProps.conversation.id === nextProps.conversation.id &&
         prevProps.conversation.title === nextProps.conversation.title &&
         prevProps.conversation.updated === nextProps.conversation.updated &&
         prevProps.conversation.messages.length === nextProps.conversation.messages.length &&
         prevProps.conversation.participantIds.length === nextProps.conversation.participantIds.length &&
         prevProps.isActive === nextProps.isActive &&
         prevProps.editingConversationTitle === nextProps.editingConversationTitle;
});

// Message Bubble Component
// ===== パフォーマンス最適化: React.memoでメモ化されたメッセージバブル =====
// メッセージの内容が変更された場合のみ再レンダリングされます
const MessageBubble = React.memo(({
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
  handleFork,
  showRegeneratePrefill,
  setShowRegeneratePrefill,
  regeneratePrefill,
  setRegeneratePrefill,
  handleRegenerateGroup,
  handleRegenerateFrom,
  handleSwitchVersion,
  showVersions,
  setShowVersions,
  isLoading,
  showThinking,
  setShowThinking,
  emotions
}) => {
  const isUser = message.type === 'user';
  const isNarration = message.type === 'narration';
  const isCharacter = message.type === 'character';

  const toggleVersions = () => {
    setShowVersions(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

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
                <AvatarDisplay character={character} size="sm" />
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
              onClick={() => handleFork(index)}
              className="p-1 text-gray-500 hover:text-green-600"
              title="ここから分岐"
            >
              <Copy size={14} />
            </button>
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
            {!isUser && (
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

        {showRegeneratePrefill === index && !isUser && (
          <div className="mb-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
            <label className="block text-xs font-medium text-purple-700 mb-2">
              再生成プリフィル（オプション）
            </label>
            <input
              type="text"
              value={regeneratePrefill}
              onChange={(e) => setRegeneratePrefill(e.target.value)}
              placeholder={
                message.type === 'narration'
                  ? "例: もっと緊張感のある描写で"
                  : `例: ${character?.name}の性格をより強調して`
              }
              className="w-full px-3 py-2 border border-purple-300 rounded-lg text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleRegenerateGroup(index)}
                className="flex-1 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-xs font-medium flex items-center justify-center gap-1"
                disabled={isLoading}
                title="同じグループ内のこのバブル以降を再生成"
              >
                <RotateCcw size={12} />
                ここから（グループ内）
              </button>
              <button
                onClick={() => handleRegenerateFrom(index)}
                className="flex-1 px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-xs font-medium flex items-center justify-center gap-1"
                disabled={isLoading}
                title="このバブル以降の全メッセージを再生成"
              >
                <SkipForward size={12} />
                ここから（全体）
              </button>
            </div>
            <button
              onClick={() => { setShowRegeneratePrefill(null); setRegeneratePrefill(''); }}
              className="w-full mt-2 px-3 py-1.5 bg-gray-400 text-white rounded-lg hover:bg-gray-500 text-xs"
            >
              キャンセル
            </button>
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
          <>
            <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed">
              {message.content}
            </pre>

            {/* バージョン切り替えUI */}
            {message.alternatives && message.alternatives.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <button
                    onClick={toggleVersions}
                    className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800 transition"
                  >
                    <History size={14} />
                    <span>{message.alternatives.length}つのバージョン</span>
                    {showVersions[index] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                {showVersions[index] && (
                  <div className="mt-2 space-y-1">
                    {message.alternatives.slice().reverse().map((alt, i) => {
                      const versionNumber = message.alternatives.length - i;
                      return (
                        <button
                          key={alt.id}
                          onClick={() => handleSwitchVersion(index, alt.id)}
                          className={`w-full text-left px-3 py-2 rounded text-xs transition ${
                            alt.isActive
                              ? 'bg-purple-100 border border-purple-300 text-purple-700 font-medium'
                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {alt.isActive && '✓ '}
                          バージョン{versionNumber}
                          <span className="text-gray-500 ml-2">
                            ({new Date(alt.timestamp).toLocaleTimeString()})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数: メッセージの内容とインデックスが同じなら再レンダリングしない
  return prevProps.message.content === nextProps.message.content &&
         prevProps.message.timestamp === nextProps.message.timestamp &&
         prevProps.editingIndex === nextProps.editingIndex &&
         prevProps.showRegeneratePrefill === nextProps.showRegeneratePrefill &&
         prevProps.showVersions?.[nextProps.index] === nextProps.showVersions?.[nextProps.index] &&
         prevProps.character?.id === nextProps.character?.id;
});

// ===== パフォーマンス最適化: React.memoでメモ化された会話設定パネル =====
/**
 * 会話設定パネルコンポーネント
 * conversation.id, characters配列が変更された時のみ再レンダリング
 */
const ConversationSettingsPanel = React.memo(({ conversation, characters, onUpdate, onClose }) => {
  const [localTitle, setLocalTitle] = useState(conversation.title);
  const [localBackground, setLocalBackground] = useState(conversation.backgroundInfo);
  const [localNarration, setLocalNarration] = useState(conversation.narrationEnabled);
  const [localAutoNarration, setLocalAutoNarration] = useState(conversation.autoGenerateNarration || false);
  const [localParticipants, setLocalParticipants] = useState(conversation.participantIds);
  const [localRelationships, setLocalRelationships] = useState(conversation.relationships || []);

  const relationshipTypes = ['友人', '親友', '恋人', 'ライバル', '家族', '師弟', '同僚', 'その他'];

  const toggleParticipant = (charId) => {
    setLocalParticipants(prev =>
      prev.includes(charId)
        ? prev.filter(id => id !== charId)
        : [...prev, charId]
    );
  };

  const addRelationship = () => {
    if (localParticipants.length < 2) return;
    setLocalRelationships(prev => [...prev, {
      char1Id: localParticipants[0],
      char2Id: localParticipants[1],
      type: '友人',
      description: ''
    }]);
  };

  const updateRelationship = (index, field, value) => {
    setLocalRelationships(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const deleteRelationship = (index) => {
    setLocalRelationships(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onUpdate({
      title: localTitle,
      backgroundInfo: localBackground,
      narrationEnabled: localNarration,
      autoGenerateNarration: localAutoNarration,
      participantIds: localParticipants,
      relationships: localRelationships
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 50 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8 flex flex-col"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white border-b p-4 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-xl text-indigo-600 flex items-center gap-2">
            <Users size={24} />
            会話設定
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: 0 }}>

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

      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={localNarration}
            onChange={(e) => setLocalNarration(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm font-medium text-gray-700">地の文を有効化</span>
        </label>
        <p className="text-xs text-gray-500 ml-6">
          情景描写や行動描写などのナレーションを追加できます
        </p>

        {localNarration && (
          <div className="ml-6 mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={localAutoNarration}
                onChange={(e) => setLocalAutoNarration(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-purple-700">AIが自動で地の文を生成</span>
            </label>
            <p className="text-xs text-purple-600 mt-1 ml-6">
              会話の合間に自動的に情景描写や行動描写を挿入します
            </p>
          </div>
        )}
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
                <AvatarDisplay character={char} size="sm" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{char.name}</div>
                  <div className="text-xs text-gray-500">{char.definition.personality}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            キャラクター間の関係性 ({localRelationships.length}件)
          </label>
          <button
            onClick={addRelationship}
            disabled={localParticipants.length < 2}
            className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-1"
          >
            <Plus size={14} />
            追加
          </button>
        </div>
        {localParticipants.length < 2 ? (
          <p className="text-xs text-gray-500">2人以上のキャラクターを追加すると関係性を設定できます</p>
        ) : localRelationships.length === 0 ? (
          <p className="text-xs text-gray-500">関係性を追加して、キャラクター間の繋がりを定義できます</p>
        ) : (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {localRelationships.map((rel, idx) => (
              <div key={idx} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={rel.char1Id}
                    onChange={(e) => updateRelationship(idx, 'char1Id', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border rounded"
                  >
                    <option value="__user__">わたし（ユーザー）</option>
                    {localParticipants.map(charId => {
                      const char = characters.find(c => c.id === charId);
                      return char ? (
                        <option key={charId} value={charId}>{char.name}</option>
                      ) : null;
                    })}
                  </select>
                  <span className="text-xs text-gray-500">と</span>
                  <select
                    value={rel.char2Id}
                    onChange={(e) => updateRelationship(idx, 'char2Id', e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border rounded"
                  >
                    <option value="__user__">わたし（ユーザー）</option>
                    {localParticipants.map(charId => {
                      const char = characters.find(c => c.id === charId);
                      return char ? (
                        <option key={charId} value={charId}>{char.name}</option>
                      ) : null;
                    })}
                  </select>
                </div>
                <select
                  value={rel.type}
                  onChange={(e) => updateRelationship(idx, 'type', e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  {relationshipTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rel.description}
                    onChange={(e) => updateRelationship(idx, 'description', e.target.value)}
                    placeholder="詳細な説明（オプション）"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                  />
                  <button
                    onClick={() => deleteRelationship(idx)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        </div>

        <div className="sticky bottom-0 bg-white border-t p-4 flex gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition"
          >
            保存
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数: conversationとcharactersが変更された時のみ再レンダリング
  return prevProps.conversation?.id === nextProps.conversation?.id &&
         prevProps.conversation?.updated === nextProps.conversation?.updated &&
         prevProps.characters.length === nextProps.characters.length;
});

// ===== パフォーマンス最適化: React.memoでメモ化されたキャラクターモーダル =====
/**
 * キャラクター管理モーダルコンポーネント
 * characters配列が変更された時のみ再レンダリング
 */
const CharacterModal = React.memo(({ characters, setCharacters, characterGroups, setCharacterGroups, getDefaultCharacter, exportCharacter, importCharacter, characterFileInputRef, emotions, onClose }) => {
  const [editingChar, setEditingChar] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [isDerived, setIsDerived] = useState(false);
  const [viewTab, setViewTab] = useState('characters'); // 'characters' or 'groups'
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastSavedCharacterId, setLastSavedCharacterId] = useState(null);
  const avatarImageInputRef = useRef(null);

  /**
   * デバウンスされた検索処理
   * 300ms遅延させることで、ユーザーが入力中の不要な処理を削減
   */
  const debouncedSearch = useMemo(
    () => debounce((query) => {
      setDebouncedSearchQuery(query);
    }, 300),
    []
  );

  // 検索クエリが変更されたらデバウンス検索を実行
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  /**
   * フィルタリングされたキャラクターリスト
   * charactersまたは検索クエリが変更されたら再計算される
   */
  const filteredCharacters = useMemo(() => {
    return characters.filter(char => {
      if (!debouncedSearchQuery) return true;
      const query = debouncedSearchQuery.toLowerCase();
      return char.name.toLowerCase().includes(query) ||
             char.definition.personality?.toLowerCase().includes(query) ||
             char.definition.background?.toLowerCase().includes(query);
    });
  }, [characters, debouncedSearchQuery]);

  const handleCreate = () => {
    const newChar = getDefaultCharacter();
    setEditingChar(newChar);
    setIsNew(true);
    setIsDerived(false);
  };

  const handleCreateDerived = (baseChar) => {
    const newChar = {
      ...getDefaultCharacter(),
      name: `${baseChar.name}（派生）`,
      baseCharacterId: baseChar.id,
      overrides: {} // Start with no overrides
    };
    setEditingChar(newChar);
    setIsNew(true);
    setIsDerived(true);
  };

  const handleEdit = (char) => {
    setEditingChar(JSON.parse(JSON.stringify(char)));
    setIsNew(false);
    setIsDerived(!!char.baseCharacterId);
  };

  const toggleOverride = (field) => {
    if (!editingChar) return;

    const newOverrides = { ...editingChar.overrides };
    if (newOverrides[field]) {
      delete newOverrides[field];
    } else {
      newOverrides[field] = true;
    }

    setEditingChar({
      ...editingChar,
      overrides: newOverrides
    });
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

  const handleSave = () => {
    const savedCharId = editingChar.id;
    if (isNew) {
      setCharacters(prev => [...prev, editingChar]);
    } else {
      setCharacters(prev => prev.map(c => c.id === editingChar.id ? editingChar : c));
    }
    setEditingChar(null);
    setIsNew(false);
    setIsDerived(false);

    // 保存成功のフィードバックを表示
    setLastSavedCharacterId(savedCharId);
    setTimeout(() => {
      setLastSavedCharacterId(null);
    }, 3000);
  };

  const handleDelete = (charId) => {
    // Check if any character derives from this one
    const hasDerived = characters.some(c => c.baseCharacterId === charId);
    if (hasDerived && !confirm('このキャラクターから派生したキャラクターが存在します。削除すると派生キャラクターも影響を受けます。続けますか？')) {
      return;
    }
    setCharacters(prev => prev.filter(c => c.id !== charId));
  };

  const getBaseCharacter = (charId) => {
    return characters.find(c => c.id === charId);
  };

  const isOverridden = (char, field) => {
    if (!char.baseCharacterId) return false;
    return !!char.overrides[field];
  };

  const handleAvatarImageUpload = (event) => {
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
    setEditingChar({
      ...editingChar,
      features: {
        ...editingChar.features,
        avatarType: 'image',
        avatarImage: croppedImage
      }
    });
    setShowImageCropper(false);
    setUploadedImage(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 50 }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 flex flex-col"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-xl font-bold text-indigo-600">キャラクター管理</h2>
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
              setEditingChar(null);
            }}
            className={`flex-1 px-4 py-3 font-medium ${!editingChar ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            キャラクター一覧
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (editingChar) return;
              handleCreate();
            }}
            className={`flex-1 px-4 py-3 font-medium ${editingChar ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {editingChar ? '編集中' : '新規作成'}
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1" style={{ minHeight: 0 }}>
          {editingChar ? (
            <div className="space-y-3">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {isNew ? (isDerived ? '派生キャラクター作成' : '新規キャラクター') : 'キャラクター編集'}
                {isDerived && (
                  <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1">
                    <Layers size={14} />
                    派生
                  </span>
                )}
              </h3>

              {isDerived && editingChar.baseCharacterId && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-purple-800">
                    <Layers size={14} />
                    <span className="font-semibold">派生元:</span>
                    <span>{getBaseCharacter(editingChar.baseCharacterId)?.name || '不明'}</span>
                  </div>
                  <p className="text-xs text-purple-600 mt-1">
                    チェックを入れた項目のみカスタマイズできます。未チェックは派生元の値を継承します。
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">名前 *</label>
                  {isDerived && (
                    <label className="flex items-center gap-1 text-xs text-purple-600">
                      <input
                        type="checkbox"
                        checked={editingChar.overrides.name}
                        onChange={() => toggleOverride('name')}
                        className="w-3 h-3"
                      />
                      カスタマイズ
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={editingChar.name}
                  onChange={(e) => setEditingChar({...editingChar, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={isDerived && !editingChar.overrides.name}
                />
              </div>

              <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'personality') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    性格
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'personality') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  {isDerived && (
                    <label className="flex items-center gap-1 text-xs text-purple-600">
                      <input
                        type="checkbox"
                        checked={editingChar.overrides.personality}
                        onChange={() => toggleOverride('personality')}
                        className="w-3 h-3"
                      />
                      カスタマイズ
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={editingChar.definition.personality}
                  onChange={(e) => setEditingChar({
                    ...editingChar,
                    definition: {...editingChar.definition, personality: e.target.value}
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={isDerived && !editingChar.overrides.personality}
                />
              </div>

              <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'speakingStyle') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    話し方
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'speakingStyle') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  {isDerived && (
                    <label className="flex items-center gap-1 text-xs text-purple-600">
                      <input
                        type="checkbox"
                        checked={editingChar.overrides.speakingStyle}
                        onChange={() => toggleOverride('speakingStyle')}
                        className="w-3 h-3"
                      />
                      カスタマイズ
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={editingChar.definition.speakingStyle}
                  onChange={(e) => setEditingChar({
                    ...editingChar,
                    definition: {...editingChar.definition, speakingStyle: e.target.value}
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={isDerived && !editingChar.overrides.speakingStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'firstPerson') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">
                      一人称
                      {editingChar.baseCharacterId && isOverridden(editingChar, 'firstPerson') && (
                        <span className="ml-2 text-xs text-yellow-600">（上書き）</span>
                      )}
                    </label>
                    {isDerived && (
                      <label className="flex items-center gap-1 text-xs text-purple-600">
                        <input
                          type="checkbox"
                          checked={editingChar.overrides.firstPerson}
                          onChange={() => toggleOverride('firstPerson')}
                          className="w-3 h-3"
                        />
                      </label>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editingChar.definition.firstPerson}
                    onChange={(e) => setEditingChar({
                      ...editingChar,
                      definition: {...editingChar.definition, firstPerson: e.target.value}
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={isDerived && !editingChar.overrides.firstPerson}
                  />
                </div>
                <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'secondPerson') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">
                      二人称
                      {editingChar.baseCharacterId && isOverridden(editingChar, 'secondPerson') && (
                        <span className="ml-2 text-xs text-yellow-600">（上書き）</span>
                      )}
                    </label>
                    {isDerived && (
                      <label className="flex items-center gap-1 text-xs text-purple-600">
                        <input
                          type="checkbox"
                          checked={editingChar.overrides.secondPerson}
                          onChange={() => toggleOverride('secondPerson')}
                          className="w-3 h-3"
                        />
                      </label>
                    )}
                  </div>
                  <input
                    type="text"
                    value={editingChar.definition.secondPerson}
                    onChange={(e) => setEditingChar({
                      ...editingChar,
                      definition: {...editingChar.definition, secondPerson: e.target.value}
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={isDerived && !editingChar.overrides.secondPerson}
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

              <div className={`${editingChar.baseCharacterId && isOverridden(editingChar, 'customPrompt') ? 'bg-yellow-50 border-yellow-200' : ''} border rounded-lg p-3`}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    カスタムシステムプロンプト
                    {editingChar.baseCharacterId && isOverridden(editingChar, 'customPrompt') && (
                      <span className="ml-2 text-xs text-yellow-600">（オーバーライド中）</span>
                    )}
                  </label>
                  {isDerived && (
                    <label className="flex items-center gap-1 text-xs text-purple-600">
                      <input
                        type="checkbox"
                        checked={editingChar.overrides.customPrompt}
                        onChange={() => toggleOverride('customPrompt')}
                        className="w-3 h-3"
                      />
                      カスタマイズ
                    </label>
                  )}
                </div>
                <textarea
                  value={editingChar.definition.customPrompt || ''}
                  onChange={(e) => setEditingChar({
                    ...editingChar,
                    definition: {...editingChar.definition, customPrompt: e.target.value}
                  })}
                  placeholder="キャラクターに関する追加の指示や設定を記述できます。&#10;例: このキャラクターは特定の話題には強い意見を持っています。&#10;より詳細なロールプレイ設定や制約を記述できます。"
                  className="w-full px-3 py-2 border rounded-lg text-sm min-h-[100px]"
                  disabled={isDerived && !editingChar.overrides.customPrompt}
                />
                <p className="text-xs text-gray-500 mt-1">
                  キャラクター設定に追加したい詳細な指示を自由に記述できます
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">アバター</label>
                  {isDerived && (
                    <label className="flex items-center gap-1 text-xs text-purple-600">
                      <input
                        type="checkbox"
                        checked={editingChar.overrides.avatar}
                        onChange={() => toggleOverride('avatar')}
                        className="w-3 h-3"
                      />
                      カスタマイズ
                    </label>
                  )}
                </div>

                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setEditingChar({
                      ...editingChar,
                      features: {...editingChar.features, avatarType: 'emoji'}
                    })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      editingChar.features.avatarType === 'emoji'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    disabled={isDerived && !editingChar.overrides.avatar}
                  >
                    😊 絵文字
                  </button>
                  <button
                    onClick={() => setEditingChar({
                      ...editingChar,
                      features: {...editingChar.features, avatarType: 'image'}
                    })}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                      editingChar.features.avatarType === 'image'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                    disabled={isDerived && !editingChar.overrides.avatar}
                  >
                    <Image size={14} className="inline mr-1" />
                    画像
                  </button>
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
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        disabled={isDerived && !editingChar.overrides.avatar}
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
                                avatarImageInputRef.current?.click();
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                              disabled={isDerived && !editingChar.overrides.avatar}
                            >
                              変更
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChar({
                                  ...editingChar,
                                  features: {...editingChar.features, avatarImage: null}
                                });
                              }}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 whitespace-nowrap"
                              disabled={isDerived && !editingChar.overrides.avatar}
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
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        } ${(isDerived && !editingChar.overrides.avatar) ? 'opacity-50 pointer-events-none' : ''}`}
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
                                avatarImageInputRef.current?.click();
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                              disabled={isDerived && !editingChar.overrides.avatar}
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

              <input
                ref={avatarImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarImageUpload}
                className="hidden"
              />

              <div className="border-t pt-3 space-y-3">
                <h4 className="font-semibold text-sm">機能設定</h4>
                
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

              <div className="relative">
                <input
                  type="text"
                  placeholder="キャラクター名や性格で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {filteredCharacters.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    {searchQuery ? '検索結果がありません' : 'キャラクターがありません'}
                  </p>
                ) : (
                  filteredCharacters.map(char => {
                    const baseChar = char.baseCharacterId ? getBaseCharacter(char.baseCharacterId) : null;
                    const isRecentlySaved = char.id === lastSavedCharacterId;
                    return (
                      <div
                        key={char.id}
                        className={`border rounded-lg p-3 transition-colors duration-300 ${
                          isRecentlySaved ? 'bg-green-50 border-green-300 shadow-md' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <AvatarDisplay character={char} size="md" />
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold flex items-center gap-2">
                                {char.name}
                                {isRecentlySaved && (
                                  <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                    <Check size={10} />
                                    保存済み
                                  </span>
                                )}
                                {baseChar && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Layers size={10} />
                                    派生元: {baseChar.name}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{char.definition.personality}</div>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleCreateDerived(char)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                              title="派生キャラを作成"
                            >
                              <Layers size={16} />
                            </button>
                            <button
                              onClick={() => duplicateCharacter(char.id)}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                              title="複製"
                            >
                              <Copy size={16} />
                            </button>
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
                      </div>
                    );
                  })
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

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            setEditingChar({
              ...editingChar,
              features: {...editingChar.features, avatar: emoji}
            });
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
    </div>
  );
});

// Confirmation Dialog Component
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
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef(null);

  useEffect(() => {
    const img = new window.Image();
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

    // Calculate base scale to fit image in canvas
    const maxDimension = Math.max(imageSize.width, imageSize.height);
    const baseScale = canvasSize / maxDimension;

    // Apply user zoom on top of base scale
    const scale = baseScale * zoom;
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

    // Calculate base scale to fit image in canvas
    const maxDimension = Math.max(imageSize.width, imageSize.height);
    const baseScale = canvasSize / maxDimension;

    // Apply user zoom on top of base scale
    const scale = baseScale * zoom;
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

    // WebP形式で圧縮（70%品質）、対応していない場合はJPEG
    const mimeType = outputCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
      ? 'image/webp'
      : 'image/jpeg';
    const croppedImage = outputCanvas.toDataURL(mimeType, 0.7);
    onCrop(croppedImage);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
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

// ===== パフォーマンス最適化: React.memoでメモ化された確認ダイアログ =====
const ConfirmDialog = React.memo(({ title, message, onConfirm, onCancel }) => {
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
});

// ===== パフォーマンス最適化: React.memoでメモ化されたアバター表示 =====
const AvatarDisplay = React.memo(({ character, size = 'md' }) => {
  if (!character) return null;

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-10 h-10 text-2xl',
    lg: 'w-16 h-16 text-4xl'
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  if (character.features.avatarType === 'image' && character.features.avatarImage) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 bg-gray-100`}>
        <img
          src={character.features.avatarImage}
          alt={character.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <span className={`${sizeClass} flex items-center justify-center flex-shrink-0`}>
      {character.features.avatar || '😊'}
    </span>
  );
}, (prevProps, nextProps) => {
  // キャラクターIDとアバター設定が同じなら再レンダリングしない
  return prevProps.character?.id === nextProps.character?.id &&
         prevProps.character?.features.avatar === nextProps.character?.features.avatar &&
         prevProps.character?.features.avatarImage === nextProps.character?.features.avatarImage &&
         prevProps.size === nextProps.size;
});

export default MultiCharacterChat;
