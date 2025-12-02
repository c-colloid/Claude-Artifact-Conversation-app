/**
 * Multi Character Chat Application
 *
 * Bundled from TypeScript source files
 * Bundle Date: 2025-12-02T06:20:27.399Z
 * Source: src/ directory
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Download, Edit2, Eye, EyeOff, FileText, Heart, History, Plus, RefreshCw, RotateCcw, Search, SkipForward, Sparkles, Trash2, Upload, User, Users, X } from 'lucide-react';

// ========================================
// Constants & Utilities
// ========================================

// ========================================
// Display Settings
// ========================================

const MESSAGE_LOAD_INCREMENT = 50; // Number of messages to load when clicking "Load More"

// ========================================
// Storage Settings
// ========================================

const STORAGE_KEY = 'multi-character-chat-data-v1';
const AUTO_SAVE_DELAY = 2000; // milliseconds

// ========================================
// File Settings
// ========================================

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

// ========================================
// Model Definitions
// ========================================

const FALLBACK_MODELS = [
  { id: 'claude-opus-4-1-20250805', display_name: 'Claude Opus 4.1', name: 'Opus 4.1', icon: '👑' },
  { id: 'claude-opus-4-20250514', display_name: 'Claude Opus 4', name: 'Opus 4', icon: '💎' },
  { id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', name: 'Sonnet 4.5', icon: '⭐' },
  { id: 'claude-sonnet-4-20250514', display_name: 'Claude Sonnet 4', name: 'Sonnet 4', icon: '✨' },
  { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5', name: 'Haiku 4.5', icon: '⚡' },
  { id: 'claude-haiku-4-20250514', display_name: 'Claude Haiku 4', name: 'Haiku 4', icon: '💨' }
];

// ========================================
// Emotion Definitions
// ========================================

const EMOTIONS: Record<string, EmotionInfo> = {
  joy: { label: '喜', emoji: '😊', color: 'text-yellow-500' },
  anger: { label: '怒', emoji: '😠', color: 'text-red-500' },
  sadness: { label: '哀', emoji: '😢', color: 'text-blue-500' },
  fun: { label: '楽', emoji: '😆', color: 'text-green-500' },
  embarrassed: { label: '照', emoji: '😳', color: 'text-pink-500' },
  surprised: { label: '驚', emoji: '😲', color: 'text-purple-500' },
  neutral: { label: '中', emoji: '😐', color: 'text-gray-500' }
};

// ========================================
// API Settings
// ========================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4000;

// ========================================
// Default Thinking Settings
// ========================================

const DEFAULT_THINKING_BUDGET = 2000; // tokens
const MIN_THINKING_BUDGET = 1000;
const MAX_THINKING_BUDGET = 10000;

// ========================================
// Function Utilities
// ========================================

/**
 * Debounce function
 * Delays function execution and only executes the last call
 */
const debounce = <T extends (...args) => any>(
  func,
  delay
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttle function
 * Limits function execution to once per interval
 */
const throttle = <T extends (...args) => any>(
  func,
  limit
): ((...args: Parameters<T>) => void) => {
  let inThrottle;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// ========================================
// Image Utilities
// ========================================

/**
 * Image compression function
 * Optimizes avatar images to reduce file size
 *
 * Features:
 * - Maintains aspect ratio during resize
 * - Exports format (70% quality)
 * - Reduces file size by 60-80%
 */
const compressImage = async (
  file,
  maxSize = 200,
  quality = 0.7
): Promise => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio during resize
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
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export (fallback to JPEG if browser doesn't support WebP)
        const mimeType =
          canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
            ? 'image/webp'
            : 'image/jpeg';

        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = e.target?.result;
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsDataURL(file);
  });
};

// ========================================
// ID & Timestamp Utilities
// ========================================

/**
 * Generate unique ID
 * Uses timestamp + random string for uniqueness
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Get current ISO timestamp
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDate = () => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * Create timestamp object for created/updated fields
 */
const createTimestamps = () => {
  const now = getTimestamp();
  return {
    created,
    updated
  };
};

// ========================================
// File Utilities
// ========================================

/**
 * Generate filename for export
 */
const generateFileName = (prefix, name) => {
  return `${prefix}_${name}_${getTodayDate()}.json`;
};

// ========================================
// Model Utilities
// ========================================

/**
 * Get icon for model based on name
 */
const getIconForModel = (displayName, modelId) => {
  const name = (displayName || modelId).toLowerCase();
  if (name.includes('opus')) return '👑';
  if (name.includes('sonnet')) return '⭐';
  if (name.includes('haiku')) return '⚡';
  return '🤖';
};

/**
 * Get short display name for model
 */
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

/**
 * デバウンス関数
 * 連続した呼び出しを遅延させ、最後の呼び出しのみを実行する
 * @param func - 実行する関数
 * @param delay - 遅延時間（ミリ秒）
 * @returns デバウンスされた関数
 */
const debounce = <T extends (...args) => any>(
  func,
  delay
): ((...args: Parameters<T>) => void) => {
  let timeoutId;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * スロットル関数
 * 一定時間内に1回のみ関数を実行する
 * @param func - 実行する関数
 * @param limit - 実行間隔（ミリ秒）
 * @returns スロットルされた関数
 */
const throttle = <T extends (...args) => any>(
  func,
  limit
): ((...args: Parameters<T>) => void) => {
  let inThrottle;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * 画像圧縮関数
 * アバター画像を最適化してファイルサイズを削減
 *
 * @param file - 圧縮する画像ファイル
 * @param maxSize - 最大サイズ（ピクセル、デフォルト: 200）
 * @param quality - 圧縮品質（0-1、デフォルト: 0.7）
 * @returns Base64エンコードされた圧縮画像
 *
 * 機能:
 * - アスペクト比を維持したリサイズ
 * - WebP形式でエクスポート（70%品質）
 * - ファイルサイズを60-80%削減
 */
const compressImage = async (
  file,
  maxSize = 200,
  quality = 0.7
): Promise => {
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
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // WebP形式でエクスポート（ブラウザが対応していない場合はJPEG）
        const mimeType =
          canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
            ? 'image/webp'
            : 'image/jpeg';

        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = e.target?.result;
    };

    reader.onerror = () => {
      reject(new Error('ファイルの読み込みに失敗しました'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * 今日の日付を取得（YYYY-MM-DD形式）
 * @returns YYYY-MM-DD形式の文字列
 */
const getTodayDate = () => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * ファイル名を生成（プレフィックス + 名前 + 日付）
 * @param prefix - ファイル名のプレフィックス
 * @param name - ファイル名に含める名前
 * @returns 生成されたファイル名
 */
const generateFileName = (prefix, name) => {
  return `${prefix}_${name}_${getTodayDate()}.json`;
};

class IndexedDBWrapperClass {
  private DB_NAME = 'MultiCharacterChatDB';
  private DB_VERSION = 1;
  private STORE_NAME = 'appData';
  private dbInstance= null;

  /**
   * Open database (cache and reuse connection)
   */
  private async openDB(): Promise<IDBDatabase> {
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
        const db = (event.target).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const objectStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
          objectStore.createIndex('timestamp', 'timestamp', { unique });
        }
      };
    });
  }

  /**
   * Execute transaction helper
   */
  private async executeTransaction<T>(
    mode,
    operation: (store) => IDBRequest,
    errorMsg,
    processResult?: (result) => T
  ): Promise<T | undefined> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], mode);
      const objectStore = transaction.objectStore(this.STORE_NAME);
      const request = operation(objectStore);

      request.onsuccess = () => {
        const result = processResult ? processResult(request.result) ;
        resolve(result);
      };

      request.onerror = () => {
        reject(new Error(errorMsg));
      };
    });
  }

  /**
   * Save data
   */
  async setItem(key, value): Promise {
    await this.executeTransaction(
      'readwrite',
      (store) => store.put({ key, value, timestamp: getTimestamp() }),
      'データの保存に失敗しました'
    );
  }

  /**
   * Load data
   */
  async getItem<T = any>(key): Promise<T | null> {
    const result = await this.executeTransaction(
      'readonly',
      (store) => store.get(key),
      'データの読み込みに失敗しました',
      (result) => (result ? result.value )
    );
    return result ?? null;
  }

  /**
   * Delete data
   */
  async removeItem(key): Promise {
    await this.executeTransaction(
      'readwrite',
      (store) => store.delete(key),
      'データの削除に失敗しました'
    );
  }

  /**
   * Clear all data
   */
  async clear(): Promise {
    await this.executeTransaction(
      'readwrite',
      (store) => store.clear(),
      'データのクリアに失敗しました'
    );
  }
}

// Export singleton instance
const IndexedDBWrapper = new IndexedDBWrapperClass();

// ========================================
// Custom Hooks
// ========================================

import { useState, useCallback } from 'react';

const useCharacterManager = () => {
  const [characters, setCharacters] = useState<Character[]>([]);

  /**
   * Get character by ID
   */
  const getCharacterById = useCallback(
    (id)=> {
      return characters.find((c) => c.id === id);
    },
    [characters]
  );

  /**
   * Get effective character (resolves derived character inheritance)
   * Supports multi-level inheritance recursively
   */
  const getEffectiveCharacter = useCallback(
    (character)=> {
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
      if (!effectiveBase) return character;

      // Merge properties
      const merged = {
        ...character,
        definition: {
          personality: character.overrides.personality
            ? character.definition.personality
            : effectiveBase.definition.personality,
          speakingStyle: character.overrides.speakingStyle
            ? character.definition.speakingStyle
            : effectiveBase.definition.speakingStyle,
          firstPerson: character.overrides.firstPerson
            ? character.definition.firstPerson
            : effectiveBase.definition.firstPerson,
          secondPerson: character.overrides.secondPerson
            ? character.definition.secondPerson
            : effectiveBase.definition.secondPerson,
          background: character.overrides.background
            ? character.definition.background
            : effectiveBase.definition.background,
          catchphrases: character.overrides.catchphrases
            ? character.definition.catchphrases
            : effectiveBase.definition.catchphrases,
          customPrompt: character.overrides.customPrompt
            ? character.definition.customPrompt
            : effectiveBase.definition.customPrompt,
        },
        features: {
          emotionEnabled:
            character.overrides.emotionEnabled !== undefined
              ? character.features.emotionEnabled
              : effectiveBase.features.emotionEnabled,
          affectionEnabled:
            character.overrides.affectionEnabled !== undefined
              ? character.features.affectionEnabled
              : effectiveBase.features.affectionEnabled,
          autoManageEmotion:
            character.overrides.autoManageEmotion !== undefined
              ? character.features.autoManageEmotion
              : effectiveBase.features.autoManageEmotion,
          autoManageAffection:
            character.overrides.autoManageAffection !== undefined
              ? character.features.autoManageAffection
              : effectiveBase.features.autoManageAffection,
          currentEmotion: character.overrides.currentEmotion
            ? character.features.currentEmotion
            : effectiveBase.features.currentEmotion,
          affectionLevel:
            character.overrides.affectionLevel !== undefined
              ? character.features.affectionLevel
              : effectiveBase.features.affectionLevel,
          avatar: character.overrides.avatar
            ? character.features.avatar
            : effectiveBase.features.avatar,
          avatarType: character.overrides.avatarType
            ? character.features.avatarType
            : effectiveBase.features.avatarType,
          avatarImage: character.overrides.avatarImage
            ? character.features.avatarImage
            : effectiveBase.features.avatarImage,
        },
      };

      return merged;
    },
    [getCharacterById]
  );

  /**
   * Create new character
   */
  const createCharacter = useCallback((data: Partial<Character>) => {
    const newCharacter = {
      id: generateId(),
      name: data.name || '新しいキャラクター',
      baseCharacterId: data.baseCharacterId || null,
      overrides: data.overrides || {},
      definition: {
        personality: data.definition?.personality || 'フレンドリーで親切',
        speakingStyle: data.definition?.speakingStyle || '丁寧な口調',
        firstPerson: data.definition?.firstPerson || '私',
        secondPerson: data.definition?.secondPerson || 'あなた',
        background: data.definition?.background || '',
        catchphrases: data.definition?.catchphrases || [],
        customPrompt: data.definition?.customPrompt || '',
      },
      features: {
        emotionEnabled: data.features?.emotionEnabled ?? true,
        affectionEnabled: data.features?.affectionEnabled ?? true,
        autoManageEmotion: data.features?.autoManageEmotion ?? true,
        autoManageAffection: data.features?.autoManageAffection ?? true,
        currentEmotion: data.features?.currentEmotion || 'neutral',
        affectionLevel: data.features?.affectionLevel ?? 50,
        avatar: data.features?.avatar || '😊',
        avatarType: data.features?.avatarType || 'emoji',
        avatarImage: data.features?.avatarImage || null,
      },
      ...createTimestamps(),
    };

    setCharacters((prev) => [...prev, newCharacter]);
    return newCharacter;
  }, []);

  /**
   * Update character
   */
  const updateCharacter = useCallback((characterId, updates: Partial<Character>) => {
    setCharacters((chars) =>
      chars.map((c) =>
        c.id === characterId ? { ...c, ...updates, updated: getTimestamp() }
      )
    );
  }, []);

  /**
   * Delete character
   */
  const deleteCharacter = useCallback((characterId) => {
    setCharacters((prev) => prev.filter((c) => c.id !== characterId));
  }, []);

  /**
   * Duplicate character
   */
  const duplicateCharacter = useCallback(
    (characterId)=> {
      const original = getCharacterById(characterId);
      if (!original) return null;

      const duplicate = {
        ...original,
        id: generateId(),
        name: `${original.name} (コピー)`,
        ...createTimestamps(),
      };

      setCharacters((prev) => [...prev, duplicate]);
      return duplicate;
    },
    [getCharacterById]
  );

  /**
   * Export character to JSON file
   */
  const exportCharacter = useCallback(
    (characterId) => {
      const char = getCharacterById(characterId);
      if (!char) return;

      const exportData = JSON.stringify(char, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = generateFileName('character', char.name);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [getCharacterById]
  );

  /**
   * Import character from JSON file
   */
  const importCharacter = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const char = JSON.parse(e.target?.result);
          const newChar = {
            ...char,
            id: generateId(),
            name: `${char.name}（インポート）`,
            ...createTimestamps(),
          };

          setCharacters((prev) => [...prev, newChar]);
        } catch (err) {
          console.error('Failed to import character:', err);
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    []
  );

  /**
   * Set all characters (for loading from storage)
   */
  const setAllCharacters = useCallback((value: React.SetStateAction<Character[]>) => {
    setCharacters(value);
  }, []);

  return {
    characters,
    getCharacterById,
    getEffectiveCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    duplicateCharacter,
    exportCharacter,
    importCharacter,
    setAllCharacters,
  };
};

import { useState, useCallback, useMemo } from 'react';

const useConversationManager = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  /**
   * Get default conversation template
   */
  const getDefaultConversation = useCallback(() => {
    return {
      id: generateId(),
      title: '新しい会話',
      participantIds: [],
      backgroundInfo: '',
      narrationEnabled,
      autoGenerateNarration,
      relationships: [],
      parentConversationId,
      forkPoint,
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
    (id)=> {
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
  const updateConversation = useCallback((conversationId, updates: Partial<Conversation>) => {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, ...updates, updated: getTimestamp() }
      )
    );
  }, []);

  /**
   * Fork conversation at a specific message
   */
  const forkConversation = useCallback(
    (conversationId, messageIndex)=> {
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

      const forkedConv = {
        ...getDefaultConversation(),
        title: `${originalConv.title}（分岐${messageIndex + 1}）`,
        participantIds: [...originalConv.participantIds],
        backgroundInfo: originalConv.backgroundInfo,
        narrationEnabled: originalConv.narrationEnabled,
        autoGenerateNarration: originalConv.autoGenerateNarration,
        relationships: originalConv.relationships ? [...originalConv.relationships] : [],
        parentConversationId,
        forkPoint,
        messages,
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
    (conversationId, onConfirm?: () => void) => {
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
    (conversationId)=> {
      const original = getConversationById(conversationId);
      if (!original) return null;

      const duplicate = {
        ...original,
        id: generateId(),
        title: `${original.title} (コピー)`,
        parentConversationId,
        forkPoint,
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
  const switchConversation = useCallback((conversationId) => {
    setCurrentConversationId(conversationId);
  }, []);

  /**
   * Set all conversations (for loading from storage)
   */
  const setAllConversations = useCallback((newConversations) => {
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

import { useState, useCallback } from 'react';

const useMessageManager = (options) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingEmotion, setEditingEmotion] = useState<string | null>(null);
  const [editingAffection, setEditingAffection] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState<Record<number, boolean>>({});

  /**
   * Start editing a message
   */
  const handleEdit = useCallback(
    (index, messages) => {
      const message = messages[index];
      if (!message) return;

      setEditingIndex(index);
      setEditingContent(message.content);
      setEditingEmotion(message.emotion || null);
      setEditingAffection(
        message.affection !== undefined && message.affection !== null ? message.affection
      );
    },
    []
  );

  /**
   * Save edited message
   */
  const handleSaveEdit = useCallback(
    (index, conversationId, messages) => {
      if (!conversationId) return;

      const updated = [...messages];
      if (!updated[index]) return;

      updated[index].content = editingContent;
      updated[index].emotion = editingEmotion || undefined;
      updated[index].affection = editingAffection !== null ? editingAffection ;

      options.updateConversation(conversationId, {
        messages,
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
    (index, conversationId, messages) => {
      if (!conversationId) return;

      const updated = messages.filter((_, i) => i !== index);

      options.updateConversation(conversationId, {
        messages,
      });
    },
    [options]
  );

  /**
   * Fork conversation at a specific message
   */
  const handleFork = useCallback(
    (index, conversationId) => {
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
      index,
      alternativeId,
      conversationId,
      messages
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
        isActive,
      };

      // Update alternatives array
      const updatedAlternatives = message.alternatives.map((alt) =>
        alt.id === alternativeId
          ? { ...alt, isActive }
          : { ...alt, isActive }
      );

      // Add current message if it's not already there
      const currentExists = updatedAlternatives.some((alt) => alt.id === message.id);
      if (!currentExists) {
        updatedAlternatives.push(newAlternative);
      }

      // Update message with selected alternative
      updated[index] = {
        ...message,
        id,
        content: alternative.content,
        emotion: alternative.emotion,
        affection: alternative.affection,
        thinking: alternative.thinking,
        alternatives,
      };

      options.updateConversation(conversationId, {
        messages,
      });
    },
    [options]
  );

  /**
   * Toggle version display for a message
   */
  const toggleVersionDisplay = useCallback((index) => {
    setShowVersions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  }, []);

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(
    (currentCount, increment) => {
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

import { useState, useCallback, useMemo } from 'react';

const useStorage = (options) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  /**
   * Save data to storage
   * Uses IndexedDB and LocalStorage
   */
  const saveToStorage = useCallback(async () => {
    if (!options.autoSaveEnabled || !options.isInitialized) return;

    setSaveStatus('saving');
    try {
      const saveData = {
        characters: options.characters,
        characterGroups: options.characterGroups,
        conversations: options.conversations,
        currentConversationId: options.currentConversationId,
        selectedModel: options.selectedModel,
        thinkingEnabled: options.thinkingEnabled,
        thinkingBudget: options.thinkingBudget,
        usageStats: options.usageStats,
        timestamp: getTimestamp(),
        version: '1.0',
      };

      // Save to IndexedDB (async, non-blocking)
      await IndexedDBWrapper.setItem(STORAGE_KEY, saveData);

      // Save to LocalStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      } catch (localStorageErr) {
        // Ignore LocalStorage quota errors (IndexedDB is primary)
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
  }, [
    options.characters,
    options.characterGroups,
    options.conversations,
    options.currentConversationId,
    options.selectedModel,
    options.thinkingEnabled,
    options.thinkingBudget,
    options.usageStats,
    options.autoSaveEnabled,
    options.isInitialized,
  ]);

  /**
   * Debounced auto-save function
   * Delays save execution by 2 seconds to prevent frequent saves
   */
  const debouncedSave = useMemo(
    () =>
      debounce(() => {
        saveToStorage();
      }, AUTO_SAVE_DELAY),
    [saveToStorage]
  );

  /**
   * Load data from storage
   * Loads from IndexedDB, falls back to LocalStorage if needed
   * Includes automatic migration from LocalStorage to IndexedDB
   */
  const loadFromStorage = useCallback(async (): Promise => {
    try {
      let data= null;

      // Try loading from IndexedDB first
      try {
        data = await IndexedDBWrapper.getItem<StorageData>(STORAGE_KEY);
      } catch (indexedDBErr) {
        console.warn('IndexedDB load failed, trying LocalStorage:', indexedDBErr);
      }

      // If no data in IndexedDB, load from LocalStorage and migrate
      if (!data) {
        const dataString = localStorage.getItem(STORAGE_KEY);
        if (dataString) {
          data = JSON.parse(dataString);

          // Migrate from LocalStorage to IndexedDB
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
        // Migrate characters to add missing features
        if (data.characters && data.characters.length > 0) {
          const migratedCharacters = data.characters.map((char) => {
            const features = char.features ?? ({});
            const definition = char.definition ?? ({});
            return {
              ...char,
              baseCharacterId: char.baseCharacterId ?? null,
              overrides: char.overrides ?? {},
              definition: {
                ...definition,
                customPrompt: definition.customPrompt ?? '',
              },
              features: {
                emotionEnabled: features.emotionEnabled ?? true,
                affectionEnabled: features.affectionEnabled ?? false,
                autoManageEmotion: features.autoManageEmotion ?? true,
                autoManageAffection: features.autoManageAffection ?? true,
                currentEmotion: features.currentEmotion ?? 'neutral',
                affectionLevel: features.affectionLevel ?? 50,
                avatar: features.avatar ?? '😊',
                avatarType: features.avatarType ?? 'emoji',
                avatarImage: features.avatarImage ?? null,
              },
            };
          });
          data.characters = migratedCharacters;
        }

        // Migrate conversations to add missing fields
        if (data.conversations && data.conversations.length > 0) {
          const migratedConversations = data.conversations.map((conv) => ({
            ...conv,
            narrationEnabled: conv.narrationEnabled ?? true,
            autoGenerateNarration: conv.autoGenerateNarration ?? false,
            backgroundInfo: conv.backgroundInfo ?? '',
            relationships: conv.relationships ?? [],
            parentConversationId: conv.parentConversationId ?? null,
            forkPoint: conv.forkPoint ?? null,
          }));
          data.conversations = migratedConversations;
        }

        // Update last saved timestamp
        if (data.timestamp) {
          setLastSaved(new Date(data.timestamp));
        }

        // Call onLoad callback if provided
        if (options.onLoad) {
          options.onLoad(data);
        }

        return true;
      }

      return false;
    } catch (err) {
      console.error('Load failed:', err);
      return false;
    }
  }, [options.onLoad]);

  /**
   * Format last saved time for display
   */
  const formatLastSaved = useCallback(() => {
    if (!lastSaved) return '';

    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}秒前に保存`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分前に保存`;
    const hours = Math.floor(minutes / 60);
    return `${hours}時間前に保存`;
  }, [lastSaved]);

  return {
    saveStatus,
    lastSaved,
    saveToStorage,
    debouncedSave,
    loadFromStorage,
    formatLastSaved,
  };
};

import { useState, useCallback } from 'react';

;
  generateConversationTitle: (messages) => string;
}

const useClaudeAPI = (options) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [usageStats, setUsageStats] = useState<UsageStats>({
    inputTokens,
    outputTokens,
    thinkingTokens,
    totalCost,
  });

  /**
   * Generate response from Claude API
   */
  const generateResponse = useCallback(
    async (
      messages,
      conversation,
      currentConversationId,
      usePrefill = false,
      customPrefill= null,
      forcedNextSpeaker= null,
      prefillText = ''
    ): Promise => {
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
          .filter((c) => c)[];

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
              const tagsToAdd = [];

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
              content,
            };
          });

        // Merge consecutive messages with same role
        const mergedMessages = [];
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
        let prefillToUse = customPrefill !== null ? customPrefill  ? prefillText : '';
        prefillToUse = prefillToUse.trim() === '' ? '' : prefillToUse.trimEnd();

        if (prefillToUse) {
          finalMessages.push({
            role: 'assistant',
            content,
          });
        }

        const requestBody = {
          model: options.selectedModel,
          max_tokens,
          messages,
          system,
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

        const data = await response.json();

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

        const fullContent = prefillToUse ? prefillToUse + textContent ;

        // Generate unique group ID for this response
        const responseGroupId = generateId();

        // Parse response into messages
        const { messages, characterUpdates } =
          options.parseMultiCharacterResponse(fullContent, conversation, thinkingContent, responseGroupId);

        // Apply character updates
        if (Object.keys(characterUpdates).length > 0) {
          Object.entries(characterUpdates).forEach(([charId, updates]) => {
            const char = options.getCharacterById(charId);
            if (char) {
              const featureUpdates = { ...char.features };

              if ((updates).emotion && char.features.autoManageEmotion) {
                featureUpdates.currentEmotion = (updates).emotion;
              }

              if ((updates).affection !== undefined && char.features.autoManageAffection) {
                featureUpdates.affectionLevel = (updates).affection;
              }

              options.updateCharacter(charId, { features });
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
            messages,
            title,
          });
        }

        return true;
      } catch (err) {
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
    } catch (err) {
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

// ========================================
// UI Components
// ========================================

import React, { useState } from 'react';
import { X } from 'lucide-react';

const EmojiPicker <EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');

  const emojiCategories: Record<string, EmojiCategory> = {
    smileys: {
      name: '😊 顔',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍',
        '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
        '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤',
        '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳',
        '😎', '🤓', '🧐',
      ],
    },
    animals: {
      name: '🐶 動物',
      emojis: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
        '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
        '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐',
        '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧',
        '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙',
        '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️',
        '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
      ],
    },
    food: {
      name: '🍕 食べ物',
      emojis: [
        '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍',
        '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅',
        '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩',
        '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗',
        '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘',
        '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬',
        '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯',
      ],
    },
    activities: {
      name: '⚽ 活動',
      emojis: [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑',
        '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️',
        '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏊', '🚣',
        '🧗', '🚵', '🚴', '🏎️', '🏍️', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁',
        '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
      ],
    },
    travel: {
      name: '✈️ 旅行',
      emojis: [
        '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯',
        '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
        '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬',
        '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽',
        '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️',
        '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭',
        '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🛕',
        '🕍', '⛩️', '🕋',
      ],
    },
    objects: {
      name: '📱 物',
      emojis: [
        '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼',
        '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️',
        '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯',
        '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '🪪', '💎', '⚖️', '🪜', '🧰', '🪛',
        '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨',
        '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️',
        '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠',
        '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑',
        '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🎁', '🎈', '🎏',
        '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥',
        '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾',
        '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂',
        '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗',
        '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️',
        '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
      ],
    },
    symbols: {
      name: '❤️ 記号',
      emojis: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞',
        '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️',
        '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔',
        '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐',
        '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑',
        '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕',
        '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯',
        '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🛗', '🈳',
        '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣',
        'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣',
        '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️',
        '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️',
        '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶',
        '➕', '➖', '➗', '✖️', '🟰', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚',
        '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪',
        '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️',
        '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕',
        '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑',
        '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '🕜', '🕝', '🕞', '🕟', '🕠',
        '🕡', '🕢', '🕣', '🕤', '🕥', '🕦', '🕧',
      ],
    },
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
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

export default React.memo(EmojiPicker);

import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

const ImageCropper <ImageCropperProps> = ({ imageSrc, onCrop, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState({ x, y });
  const [zoom, setZoom] = useState(1.0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x, y });
  const [imageSize, setImageSize] = useState({ width, height });

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
    if (!ctx) return;

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
    ctx.drawImage(imageRef.current, crop.x, crop.y, imgWidth, imgHeight);

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

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setCrop({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
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
    if (!outputCtx) return;

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
    const mimeType =
      outputCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'image/webp' : 'image/jpeg';
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">ズーム: {zoom.toFixed(1)}x</label>
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

export default React.memo(ImageCropper);

import React from 'react';

const AvatarDisplay <AvatarDisplayProps> = ({ character, size = 'md' }) => {
  if (!character) return null;

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-10 h-10 text-2xl',
    lg: 'w-16 h-16 text-4xl',
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
};

// Memoize with custom comparison
export default React.memo(AvatarDisplay, (prevProps, nextProps) => {
  // Don't re-render if character ID and avatar settings are the same
  return (
    prevProps.character?.id === nextProps.character?.id &&
    prevProps.character?.features.avatar === nextProps.character?.features.avatar &&
    prevProps.character?.features.avatarImage === nextProps.character?.features.avatarImage &&
    prevProps.size === nextProps.size
  );
});

import React from 'react';

const ConfirmDialog <ConfirmDialogProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'キャンセル',
}) => {
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
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmDialog);

import React from 'react';
import {
  FileText,
  User,
  Heart,
  Copy,
  Edit2,
  Trash2,
  RotateCcw,
  SkipForward,
  Eye,
  EyeOff,
  History,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

const MessageBubble <MessageBubbleProps> = ({
  message,
  index,
  character,
  editingIndex,
  editingContent,
  setEditingContent,
  editingEmotion,
  setEditingEmotion,
  editingAffection,
  setEditingAffection,
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
  emotions,
}) => {
  const isUser = message.type === 'user';
  const isNarration = message.type === 'narration';
  const isCharacter = message.type === 'character';

  const toggleVersions = () => {
    setShowVersions((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div
      className={`flex ${
        isNarration ? 'justify-center'  ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`${
          isNarration
            ? 'max-w-3xl bg-gray-50 border border-gray-300 rounded shadow-sm'

            ? 'max-w-4xl bg-blue-100 rounded-2xl rounded-tr-none shadow-md'
            : 'max-w-4xl bg-white rounded-2xl rounded-tl-none shadow-md'
        } w-full p-4`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isNarration ? (
              <>
                <FileText size={18} className="text-gray-500" />
                <span className="font-medium text-sm text-gray-600">地の文</span>
              </>
            )  ? (
              <>
                <User size={20} className="text-blue-600" />
                <span className="font-semibold text-sm text-blue-600">あなた</span>
              </>
            ) : (
              <>
                <AvatarDisplay character={character!} size="sm" />
                <span className="font-semibold text-sm text-indigo-600">
                  {character?.name || '不明なキャラクター'}
                </span>
                {character?.features.emotionEnabled && message.emotion && (
                  <span className="text-lg" title={emotions[message.emotion]?.label}>
                    {emotions[message.emotion]?.emoji}
                  </span>
                )}
                {character?.features.affectionEnabled &&
                  message.affection !== undefined && (
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
                onClick={() =>
                  setShowRegeneratePrefill(showRegeneratePrefill === index ? null )
                }
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
                  ? '例: もっと緊張感のある描写で'
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
              onClick={() => {
                setShowRegeneratePrefill(null);
                setRegeneratePrefill('');
              }}
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
                onClick={() =>
                  setShowThinking((prev) => ({ ...prev, [index]: !(prev[index] ?? true) }))
                }
                className="text-yellow-600 hover:bg-yellow-100 p-1 rounded transition-colors cursor-pointer"
              >
                {showThinking[index] ?? true ? <EyeOff size={14} /> : <Eye size={14} />}
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
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm"
              rows={10}
            />
            {!isNarration &&
              !isUser &&
              character &&
              (character.features.emotionEnabled || character.features.affectionEnabled) && (
                <div
                  className={`gap-3 ${
                    character.features.emotionEnabled && character.features.affectionEnabled
                      ? 'grid grid-cols-2'
                      : 'flex flex-col'
                  }`}
                >
                  {character.features.emotionEnabled && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">感情</label>
                      <select
                        value={editingEmotion || ''}
                        onChange={(e) => setEditingEmotion(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">なし</option>
                        {Object.entries(emotions).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value.emoji} {value.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {character.features.affectionEnabled && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        好感度 (0-100)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={editingAffection !== null ? editingAffection : ''}
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? null
                              : Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                          setEditingAffection(val);
                        }}
                        placeholder="なし"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
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
                    {message.alternatives
                      .slice()
                      .reverse()
                      .map((alt, i) => {
                        const versionNumber = message.alternatives!.length - i;
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
                              ({new Date(alt.timestamp || '').toLocaleTimeString()})
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
};

export default React.memo(MessageBubble, (prevProps, nextProps) => {
  // カスタム比較関数: メッセージの内容とインデックスが同じなら再レンダリングしない
  return (
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.editingIndex === nextProps.editingIndex &&
    prevProps.editingContent === nextProps.editingContent &&
    prevProps.editingEmotion === nextProps.editingEmotion &&
    prevProps.editingAffection === nextProps.editingAffection &&
    prevProps.showRegeneratePrefill === nextProps.showRegeneratePrefill &&
    prevProps.regeneratePrefill === nextProps.regeneratePrefill &&
    prevProps.showVersions?.[nextProps.index] === nextProps.showVersions?.[nextProps.index] &&
    prevProps.character?.id === nextProps.character?.id
  );
});

import React from 'react';
import { Check, Edit2, Download, Trash2, Users } from 'lucide-react';

const ConversationCard <ConversationCardProps> = ({
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
  updateConversation,
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
        <button onClick={() => onSelect(conversation.id)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isActive && <Check size={12} className="text-indigo-600 flex-shrink-0" />}
            {editingConversationTitle === conversation.id ? (
              <input
                type="text"
                value={editingTitleText}
                onChange={(e) => setEditingTitleText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateConversation(conversation.id, { title });
                    setEditingConversationTitle(null);
                  } else if (e.key === 'Escape') {
                    setEditingConversationTitle(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onBlur={() => {
                  updateConversation(conversation.id, { title });
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
};

export default React.memo(ConversationCard, (prevProps, nextProps) => {
  // カスタム比較関数: 会話ID、タイトル、更新日時、アクティブ状態が同じなら再レンダリングしない
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.title === nextProps.conversation.title &&
    prevProps.conversation.updated === nextProps.conversation.updated &&
    prevProps.conversation.messages.length === nextProps.conversation.messages.length &&
    prevProps.conversation.participantIds.length === nextProps.conversation.participantIds.length &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.editingConversationTitle === nextProps.editingConversationTitle &&
    prevProps.editingTitleText === nextProps.editingTitleText
  );
});

import React, { useState } from 'react';
import { X, Users, Plus, Trash2 } from 'lucide-react';

const ConversationSettings <ConversationSettingsProps> = ({
  conversation,
  characters,
  onUpdate,
  onClose,
}) => {
  const [localTitle, setLocalTitle] = useState(conversation.title);
  const [localBackground, setLocalBackground] = useState(conversation.backgroundInfo);
  const [localNarration, setLocalNarration] = useState(conversation.narrationEnabled);
  const [localAutoNarration, setLocalAutoNarration] = useState(
    conversation.autoGenerateNarration || false
  );
  const [localParticipants, setLocalParticipants] = useState(conversation.participantIds);
  const [localRelationships, setLocalRelationships] = useState(conversation.relationships || []);

  const relationshipTypes = ['友人', '親友', '恋人', 'ライバル', '家族', '師弟', '同僚', 'その他'];

  const toggleParticipant = (charId) => {
    setLocalParticipants((prev) =>
      prev.includes(charId) ? prev.filter((id) => id !== charId) : [...prev, charId]
    );
  };

  const addRelationship = () => {
    if (localParticipants.length < 1) return;
    setLocalRelationships((prev) => [
      ...prev,
      {
        char1Id: localParticipants[0],
        char2Id: localParticipants.length >= 2 ? localParticipants[1] : '__user__',
        type: '友人',
        description: '',
      },
    ]);
  };

  const updateRelationship = (index, field Relationship, value) => {
    setLocalRelationships((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field] };
      return updated;
    });
  };

  const deleteRelationship = (index) => {
    setLocalRelationships((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onUpdate({
      title,
      backgroundInfo,
      narrationEnabled,
      autoGenerateNarration,
      participantIds,
      relationships,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex }}
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight }}>
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
                {characters.map((char) => (
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
                disabled={localParticipants.length < 1}
                className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition disabled:bg-gray-100 disabled:text-gray-400 flex items-center gap-1"
              >
                <Plus size={14} />
                追加
              </button>
            </div>
            {localParticipants.length < 1 ? (
              <p className="text-xs text-gray-500">
                1人以上のキャラクターを追加すると関係性を設定できます
              </p>
            ) : localRelationships.length === 0 ? (
              <p className="text-xs text-gray-500">
                関係性を追加して、キャラクター間の繋がりを定義できます
              </p>
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
                        <option value="__user__">あなた</option>
                        {localParticipants.map((charId) => {
                          const char = characters.find((c) => c.id === charId);
                          return char ? (
                            <option key={charId} value={charId}>
                              {char.name}
                            </option>
                          ) ;
                        })}
                      </select>
                      <span className="text-xs text-gray-500">と</span>
                      <select
                        value={rel.char2Id}
                        onChange={(e) => updateRelationship(idx, 'char2Id', e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border rounded"
                      >
                        <option value="__user__">あなた</option>
                        {localParticipants.map((charId) => {
                          const char = characters.find((c) => c.id === charId);
                          return char ? (
                            <option key={charId} value={charId}>
                              {char.name}
                            </option>
                          ) ;
                        })}
                      </select>
                    </div>
                    <select
                      value={rel.type}
                      onChange={(e) => updateRelationship(idx, 'type', e.target.value)}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      {relationshipTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
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
};

export default React.memo(ConversationSettings, (prevProps, nextProps) => {
  // カスタム比較関数: conversationとcharactersが変更された時のみ再レンダリング
  return (
    prevProps.conversation?.id === nextProps.conversation?.id &&
    prevProps.conversation?.updated === nextProps.conversation?.updated &&
    prevProps.characters.length === nextProps.characters.length
  );
});

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Copy,
  Users,
  Search,
  User,
  RefreshCw,
  Sparkles,
  FileText,
  Check,
} from 'lucide-react';

// Type for generated template from template mode

// Type for character preview from AI generation (flat structure)

const CharacterModal <CharacterModalProps> = ({
  characters,
  setCharacters,
  characterGroups,
  setCharacterGroups,
  getDefaultCharacter,
  exportCharacter,
  importCharacter,
  characterFileInputRef,
  emotions,
  onClose,
}) => {
  // ===== State Management =====
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isDerived, setIsDerived] = useState(false);
  const [viewTab, setViewTab] = useState<'characters' | 'groups'>('characters');
  const [editingGroup, setEditingGroup] = useState<CharacterGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastSavedCharacterId, setLastSavedCharacterId] = useState<string | null>(null);
  const avatarImageInputRef = useRef<HTMLInputElement>(null);

  // AI-assisted character creation
  const [showAutoSetupModal, setShowAutoSetupModal] = useState(false);
  const [autoSetupMode, setAutoSetupMode] = useState<'template' | 'simple'>('template');
  const [autoSetupCharName, setAutoSetupCharName] = useState('');
  const [autoSetupWorkName, setAutoSetupWorkName] = useState('');
  const [autoSetupAdditionalInfo, setAutoSetupAdditionalInfo] = useState('');
  const [simpleDescription, setSimpleDescription] = useState('');
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [generatedCharacterPreview, setGeneratedCharacterPreview] = useState<CharacterPreview | null>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState<GeneratedTemplate | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ===== Debounced Search =====
  const debouncedSearch = useMemo(
    () =>
      debounce((query) => {
        setDebouncedSearchQuery(query);
      }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // ===== Filtered Characters =====
  const filteredCharacters = useMemo(() => {
    return characters.filter((char) => {
      if (!debouncedSearchQuery) return true;
      const query = debouncedSearchQuery.toLowerCase();
      return (
        char.name.toLowerCase().includes(query) ||
        char.definition.personality?.toLowerCase().includes(query) ||
        char.definition.background?.toLowerCase().includes(query)
      );
    });
  }, [characters, debouncedSearchQuery]);

  // ===== Character CRUD Operations =====
  const handleCreate = useCallback(() => {
    const newChar = getDefaultCharacter();
    setEditingChar(newChar);
    setIsNew(true);
    setIsDerived(false);
  }, [getDefaultCharacter]);

  const handleCreateDerived = useCallback(
    (baseChar) => {
      const newChar = {
        ...getDefaultCharacter(),
        name: `${baseChar.name}（派生）`,
        baseCharacterId: baseChar.id,
        overrides: {},
      };
      setEditingChar(newChar);
      setIsNew(true);
      setIsDerived(true);
    },
    [getDefaultCharacter]
  );

  const handleEdit = useCallback((char) => {
    setEditingChar(JSON.parse(JSON.stringify(char)));
    setIsNew(false);
    setIsDerived(!!char.baseCharacterId);
  }, []);

  const toggleOverride = useCallback(
    (field) => {
      if (!editingChar) return;

      const newOverrides = { ...editingChar.overrides };
      if (newOverrides[field]) {
        delete newOverrides[field];
      } else {
        newOverrides[field] = true;
      }

      setEditingChar({
        ...editingChar,
        overrides,
      });
    },
    [editingChar]
  );

  const updateEditingField = useCallback(
    (path, value) => {
      setEditingChar((prev) => {
        if (!prev) return prev;
        const keys = path.split('.');
        const newChar = JSON.parse(JSON.stringify(prev));
        let current = newChar;
        for (let i = 0; i < keys.length - 1; i++) {
          current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        return newChar;
      });
    },
    []
  );

  const handleSave = useCallback(() => {
    if (!editingChar) return;

    if (isNew) {
      setCharacters((prev) => [...prev, editingChar]);
      setLastSavedCharacterId(editingChar.id);
      setTimeout(() => setLastSavedCharacterId(null), 3000);
    } else {
      setCharacters((prev) => prev.map((c) => (c.id === editingChar.id ? editingChar )));
    }

    setEditingChar(null);
    setIsNew(false);
    setIsDerived(false);
  }, [editingChar, isNew, setCharacters]);

  const handleDelete = useCallback(
    (charId) => {
      if (window.confirm('このキャラクターを削除しますか？この操作は取り消せません。')) {
        setCharacters((prev) => prev.filter((c) => c.id !== charId));
      }
    },
    [setCharacters]
  );

  const handleCancel = useCallback(() => {
    setEditingChar(null);
    setIsNew(false);
    setIsDerived(false);
  }, []);

  // ===== AI Assist Handling =====
  const handleStartAutoSetup = useCallback(() => {
    setShowAutoSetupModal(true);
    setAutoSetupMode('template');
    setAutoSetupCharName('');
    setAutoSetupWorkName('');
    setAutoSetupAdditionalInfo('');
    setSimpleDescription('');
    setGeneratedCharacterPreview(null);
    setGeneratedTemplate(null);
    setGenerationError(null);
  }, []);

  const handleCancelAutoSetup = useCallback(() => {
    setShowAutoSetupModal(false);
    setAutoSetupMode('template');
    setAutoSetupCharName('');
    setAutoSetupWorkName('');
    setAutoSetupAdditionalInfo('');
    setSimpleDescription('');
    setGeneratedCharacterPreview(null);
    setGeneratedTemplate(null);
    setGenerationError(null);
    setIsGeneratingCharacter(false);
  }, []);

  const handleGenerateTemplate = useCallback(() => {
    if (!autoSetupCharName.trim()) {
      alert('キャラクター名を入力してください');
      return;
    }

    const characterInfo = `キャラクター名: ${autoSetupCharName}${
      autoSetupWorkName ? `\n作品名: ${autoSetupWorkName}` : ''
    }${autoSetupAdditionalInfo ? `\n追加情報: ${autoSetupAdditionalInfo}` : ''}`;

    const prompt = `あなたはキャラクター設定の専門家です。以下のキャラクターについて、Web検索を使って正確な情報を収集し、会話アプリ用のキャラクター設定を生成してください。

${characterInfo}

**重要: Web検索を使用して、このキャラクターの正確な情報を収集してください。**

以下のJSON形式で出力してください。JSONのみを出力し、説明文やコードブロック記号は不要です。

{
  "id": "char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}",
  "name": "${autoSetupCharName}",
  "baseCharacterId",
  "overrides": {},
  "definition": {
    "personality": "性格を1文で簡潔に（例: 優しく真面目で責任感が強い）",
    "speakingStyle": "話し方を1文で簡潔に（例: 丁寧で誠実な口調）",
    "firstPerson": "一人称（原作で使用している一人称）",
    "secondPerson": "二人称（原作で使用している二人称）",
    "background": "背景やバックストーリー（3-5文程度、原作の設定に基づく）",
    "catchphrases": ["決め台詞1", "決め台詞2", "決め台詞3"],
    "customPrompt": "【重要】ここに詳細なキャラクター情報を記述してください：\\n\\n# 性格の詳細\\n- 基本的な性格特性（原作に基づく詳細な説明）\\n- 価値観や信念\\n- 行動パターンや癖\\n- 感情表現の特徴\\n\\n# 話し方の詳細\\n- 具体的な口調や語尾の使い方\\n- よく使うフレーズや言い回し\\n- 感情による話し方の変化\\n- 特定の相手への話し方の違い\\n\\n# 関係性と振る舞い\\n- 他者との接し方\\n- 親しい人への態度\\n- 初対面の人への態度\\n\\n# その他の特徴\\n- 趣味や好きなもの\\n- 苦手なことや嫌いなもの\\n- 特技や能力\\n- 原作での重要なエピソード\\n\\nこの情報を使ってキャラクターを演じてください。"
  },
  "features": {
    "emotionEnabled",
    "affectionEnabled",
    "autoManageEmotion",
    "autoManageAffection",
    "currentEmotion": "neutral",
    "affectionLevel",
    "avatar": "😊",
    "avatarType": "emoji",
    "avatarImage"
  },
  "created": "${new Date().toISOString()}",
  "updated": "${new Date().toISOString()}"
}

Web検索で得た情報を元に、原作に忠実で自然なキャラクター設定を作成してください。
特に **customPrompt** に詳細な情報を記述し、personality/speakingStyle は簡潔なラベルとして記入してください。`;

    const jsonTemplate = {
      id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      baseCharacterId,
      overrides: {},
      definition: {
        personality: '性格を1文で簡潔に',
        speakingStyle: '話し方を1文で簡潔に',
        firstPerson: '一人称',
        secondPerson: '二人称',
        background: '背景やバックストーリー（3-5文程度）',
        catchphrases: ['決め台詞1', '決め台詞2', '決め台詞3'],
        customPrompt: `【重要】ここに詳細なキャラクター情報を記述してください：

# 性格の詳細
- 基本的な性格特性（原作に基づく詳細な説明）
- 価値観や信念
- 行動パターンや癖
- 感情表現の特徴

# 話し方の詳細
- 具体的な口調や語尾の使い方
- よく使うフレーズや言い回し
- 感情による話し方の変化
- 特定の相手への話し方の違い

# 関係性と振る舞い
- 他者との接し方
- 親しい人への態度
- 初対面の人への態度

# その他の特徴
- 趣味や好きなもの
- 苦手なことや嫌いなもの
- 特技や能力
- 原作での重要なエピソード

この情報を使ってキャラクターを演じてください。`,
      },
      features: {
        emotionEnabled,
        affectionEnabled,
        autoManageEmotion,
        autoManageAffection,
        currentEmotion: 'neutral',
        affectionLevel,
        avatar: '😊',
        avatarType: 'emoji',
        avatarImage,
      },
      created Date().toISOString(),
      updated Date().toISOString(),
    };

    const fileName = `character_template_${autoSetupCharName}_${getTodayDate()}.json`;

    setGeneratedTemplate({
      prompt,
      jsonTemplate: JSON.stringify(jsonTemplate, null, 2),
      fileName,
    });
  }, [autoSetupCharName, autoSetupWorkName, autoSetupAdditionalInfo]);

  const handleCopyTemplate = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('クリップボードにコピーしました！');
    } catch (error) {
      console.error('Copy failed:', error);
      alert('コピーに失敗しました。手動でコピーしてください。');
    }
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    if (!generatedTemplate) return;

    const blob = new Blob([generatedTemplate.jsonTemplate], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = generatedTemplate.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedTemplate]);

  const handleGenerateFromSimple = useCallback(async () => {
    if (!simpleDescription.trim()) {
      alert('キャラクターの説明を入力してください');
      return;
    }

    setIsGeneratingCharacter(true);
    setGenerationError(null);

    try {
      const prompt = `以下の簡単な説明から、会話アプリ用の詳細なキャラクター設定を生成してください。

キャラクターの説明:
${simpleDescription}

以下のJSON形式で出力してください。JSONのみを出力し、説明文やコードブロック記号は不要です。
{
  "name": "キャラクター名（説明から適切な名前を考案、または「新しいキャラクター」）",
  "personality": "性格を1文で簡潔に（例: 明るく社交的で前向き）",
  "speakingStyle": "話し方を1文で簡潔に（例: フレンドリーで親しみやすい口調）",
  "firstPerson": "一人称（「私」「僕」「俺」など、性格に合ったもの）",
  "secondPerson": "二人称（「あなた」「君」「お前」など、性格に合ったもの）",
  "background": "背景やバックストーリー（3-5文程度、説明を元に具体的に）",
  "catchphrases": ["決め台詞1", "決め台詞2", "決め台詞3"],
  "customPrompt": "【重要】ここに詳細なキャラクター情報を記述してください：\\n\\n# 性格の詳細\\n- 基本的な性格特性（説明を元に詳細に）\\n- 価値観や信念\\n- 行動パターンや癖\\n- 感情表現の特徴\\n\\n# 話し方の詳細\\n- 具体的な口調や語尾の使い方（「〜だよ」「〜です」など）\\n- よく使うフレーズや言い回し\\n- 感情による話し方の変化\\n- 特定の相手への話し方の違い\\n\\n# 関係性と振る舞い\\n- 他者との接し方\\n- 親しい人への態度\\n- 初対面の人への態度\\n\\n# その他の特徴\\n- 趣味や好きなもの\\n- 苦手なことや嫌いなもの\\n- 特技や能力\\n\\nこの情報を使ってキャラクターを演じてください。"
}

説明から想像を膨らませて、魅力的で自然なキャラクター設定を作成してください。
特に **customPrompt** に詳細な情報を記述し、personality/speakingStyle は簡潔なラベルとして記入してください。`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens,
          messages: [
            {
              role: 'user',
              content,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.content[0].text;

      // JSONを抽出（コードブロックがある場合も考慮）
      let jsonText = content;
      const jsonMatch =
        content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const characterData = JSON.parse(jsonText.trim());

      // プレビューとして保存
      setGeneratedCharacterPreview(characterData);
    } catch (error) {
      console.error('Character generation error:', error);
      setGenerationError(error.message || 'キャラクター生成中にエラーが発生しました');
    } finally {
      setIsGeneratingCharacter(false);
    }
  }, [simpleDescription]);

  const handleApplyGeneratedCharacter = useCallback(() => {
    if (!generatedCharacterPreview) return;

    const newChar = {
      ...getDefaultCharacter(),
      name: generatedCharacterPreview.name || '新しいキャラクター',
      definition: {
        personality: generatedCharacterPreview.personality || '',
        speakingStyle: generatedCharacterPreview.speakingStyle || '',
        firstPerson: generatedCharacterPreview.firstPerson || '私',
        secondPerson: generatedCharacterPreview.secondPerson || 'あなた',
        background: generatedCharacterPreview.background || '',
        catchphrases: generatedCharacterPreview.catchphrases || [],
        customPrompt: generatedCharacterPreview.customPrompt || '',
      },
    };

    setEditingChar(newChar);
    setIsNew(true);
    setIsDerived(false);
    setShowAutoSetupModal(false);

    // 状態をリセット
    setAutoSetupCharName('');
    setAutoSetupWorkName('');
    setAutoSetupAdditionalInfo('');
    setSimpleDescription('');
    setGeneratedCharacterPreview(null);
    setGenerationError(null);
  }, [generatedCharacterPreview, getDefaultCharacter]);

  // ===== Avatar Handling =====
  const handleEmojiSelect = useCallback(
    (emoji) => {
      updateEditingField('features.avatar', emoji);
      updateEditingField('features.avatarType', 'emoji');
      setShowEmojiPicker(false);
    },
    [updateEditingField]
  );

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage(event.target?.result);
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageCrop = useCallback(
    (croppedImage) => {
      updateEditingField('features.avatarImage', croppedImage);
      updateEditingField('features.avatarType', 'image');
      setShowImageCropper(false);
      setUploadedImage(null);
    },
    [updateEditingField]
  );

  // ===== Render =====
  if (!editingChar) {
    // Character List View
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-indigo-600">キャラクター管理</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewTab('characters')}
                  className={`px-4 py-2 rounded-lg ${
                    viewTab === 'characters'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <User size={16} className="inline mr-2" />
                  キャラクター
                </button>
                <button
                  onClick={() => setViewTab('groups')}
                  className={`px-4 py-2 rounded-lg ${
                    viewTab === 'groups'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Users size={16} className="inline mr-2" />
                  グループ
                </button>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={24} />
            </button>
          </div>

          {/* Search and Actions */}
          <div className="p-4 border-b space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="キャラクターを検索..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Plus size={20} />
                新規作成
              </button>
              <button
                onClick={() => setShowAutoSetupModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
              >
                <Sparkles size={20} />
                AI作成
              </button>
            </div>
          </div>

          {/* Character List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCharacters.map((char) => (
                <div
                  key={char.id}
                  className={`border rounded-lg p-4 hover:shadow-lg transition ${
                    lastSavedCharacterId === char.id ? 'ring-2 ring-green-500 bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AvatarDisplay character={char} size="md" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate">{char.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{char.definition.personality}</p>
                      {char.baseCharacterId && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-2 inline-block">
                          派生キャラクター
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleEdit(char)}
                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      <Edit2 size={14} className="inline mr-1" />
                      編集
                    </button>
                    <button
                      onClick={() => handleCreateDerived(char)}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                    >
                      <Copy size={14} className="inline mr-1" />
                      派生
                    </button>
                    <button
                      onClick={() => exportCharacter(char.id)}
                      className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(char.id)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {filteredCharacters.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                {searchQuery ? '検索結果がありません' : 'キャラクターが登録されていません'}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-between items-center">
            <div className="text-sm text-gray-600">{characters.length}個のキャラクター</div>
            <div className="flex gap-2">
              <button
                onClick={() => characterFileInputRef.current?.click()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <Upload size={16} />
                インポート
              </button>
              <input
                ref={characterFileInputRef}
                type="file"
                accept=".json"
                onChange={importCharacter}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Emoji Picker Modal */}
        {showEmojiPicker && (
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
        )}

        {/* Image Cropper Modal */}
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
  }

  // Get base character for derived characters
  const getBaseCharacter = (charId) => {
    return characters.find((c) => c.id === charId);
  };

  const isOverridden = (char, field) => {
    if (!char.baseCharacterId) return false;
    return !!char.overrides?.[field];
  };

  // Character Edit View - Full Implementation
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 flex flex-col"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-indigo-600">キャラクター管理</h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">›</span>
              <span className="text-lg font-semibold text-gray-700">
                {isNew ? (isDerived ? '派生キャラクター作成' : '新規キャラクター作成') : 'キャラクター編集'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCancel();
              }}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              ← 一覧に戻る
            </button>
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
        </div>

        {/* Edit Form */}
        <div className="overflow-y-auto p-4 flex-1" style={{ minHeight }}>
          <div className="space-y-3">
            {/* Derived Character Notice */}
            {isDerived && editingChar.baseCharacterId && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-purple-800">
                  <Copy size={14} />
                  <span className="font-semibold">派生元:</span>
                  <span>{getBaseCharacter(editingChar.baseCharacterId)?.name || '不明'}</span>
                </div>
                <p className="text-xs text-purple-600 mt-1">
                  チェックを入れた項目のみカスタマイズできます。未チェックは派生元の値を継承します。
                </p>
              </div>
            )}

            {/* Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">名前 *</label>
                {isDerived && (
                  <label className="flex items-center gap-1 text-xs text-purple-600">
                    <input
                      type="checkbox"
                      checked={editingChar.overrides?.name || false}
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
                onChange={(e) => updateEditingField('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isDerived && !editingChar.overrides?.name}
              />
            </div>

            {/* Personality */}
            <div
              className={`${
                editingChar.baseCharacterId && isOverridden(editingChar, 'personality')
                  ? 'bg-yellow-50 border-yellow-200'
                  : ''
              } border rounded-lg p-3`}
            >
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
                      checked={editingChar.overrides?.personality || false}
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
                onChange={(e) => updateEditingField('definition.personality', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isDerived && !editingChar.overrides?.personality}
              />
            </div>

            {/* Speaking Style */}
            <div
              className={`${
                editingChar.baseCharacterId && isOverridden(editingChar, 'speakingStyle')
                  ? 'bg-yellow-50 border-yellow-200'
                  : ''
              } border rounded-lg p-3`}
            >
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
                      checked={editingChar.overrides?.speakingStyle || false}
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
                onChange={(e) => updateEditingField('definition.speakingStyle', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={isDerived && !editingChar.overrides?.speakingStyle}
              />
            </div>

            {/* First/Second Person */}
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`${
                  editingChar.baseCharacterId && isOverridden(editingChar, 'firstPerson')
                    ? 'bg-yellow-50 border-yellow-200'
                    : ''
                } border rounded-lg p-3`}
              >
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
                        checked={editingChar.overrides?.firstPerson || false}
                        onChange={() => toggleOverride('firstPerson')}
                        className="w-3 h-3"
                      />
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={editingChar.definition.firstPerson}
                  onChange={(e) => updateEditingField('definition.firstPerson', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={isDerived && !editingChar.overrides?.firstPerson}
                />
              </div>
              <div
                className={`${
                  editingChar.baseCharacterId && isOverridden(editingChar, 'secondPerson')
                    ? 'bg-yellow-50 border-yellow-200'
                    : ''
                } border rounded-lg p-3`}
              >
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
                        checked={editingChar.overrides?.secondPerson || false}
                        onChange={() => toggleOverride('secondPerson')}
                        className="w-3 h-3"
                      />
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  value={editingChar.definition.secondPerson}
                  onChange={(e) => updateEditingField('definition.secondPerson', e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  disabled={isDerived && !editingChar.overrides?.secondPerson}
                />
              </div>
            </div>

            {/* Catchphrases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">口癖・決まり文句</label>
                <button
                  onClick={() => {
                    const catchphrases = editingChar.definition.catchphrases || [];
                    updateEditingField('definition.catchphrases', [...catchphrases, '']);
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
                          const newCatchphrases = [...(editingChar.definition.catchphrases || [])];
                          newCatchphrases[index] = e.target.value;
                          updateEditingField('definition.catchphrases', newCatchphrases);
                        }}
                        placeholder="例: ～だよね！、～なのだ"
                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                      />
                      <button
                        onClick={() => {
                          const newCatchphrases = (editingChar.definition.catchphrases || []).filter(
                            (_, i) => i !== index
                          );
                          updateEditingField('definition.catchphrases', newCatchphrases);
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

            {/* Custom Prompt */}
            <div
              className={`${
                editingChar.baseCharacterId && isOverridden(editingChar, 'customPrompt')
                  ? 'bg-yellow-50 border-yellow-200'
                  : ''
              } border rounded-lg p-3`}
            >
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
                      checked={editingChar.overrides?.customPrompt || false}
                      onChange={() => toggleOverride('customPrompt')}
                      className="w-3 h-3"
                    />
                    カスタマイズ
                  </label>
                )}
              </div>
              <textarea
                value={editingChar.definition.customPrompt || ''}
                onChange={(e) => updateEditingField('definition.customPrompt', e.target.value)}
                placeholder="キャラクターに関する追加の指示や設定を記述できます。&#10;例: このキャラクターは特定の話題には強い意見を持っています。&#10;より詳細なロールプレイ設定や制約を記述できます。"
                className="w-full px-3 py-2 border rounded-lg text-sm min-h-[100px]"
                disabled={isDerived && !editingChar.overrides?.customPrompt}
              />
              <p className="text-xs text-gray-500 mt-1">
                キャラクター設定に追加したい詳細な指示を自由に記述できます
              </p>
            </div>

            {/* Avatar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium">アバター</label>
                {isDerived && (
                  <label className="flex items-center gap-1 text-xs text-purple-600">
                    <input
                      type="checkbox"
                      checked={editingChar.overrides?.avatar || false}
                      onChange={() => toggleOverride('avatar')}
                      className="w-3 h-3"
                    />
                    カスタマイズ
                  </label>
                )}
              </div>

              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => updateEditingField('features.avatarType', 'emoji')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    editingChar.features.avatarType === 'emoji'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  disabled={isDerived && !editingChar.overrides?.avatar}
                >
                  😊 絵文字
                </button>
                <button
                  onClick={() => updateEditingField('features.avatarType', 'image')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    editingChar.features.avatarType === 'image'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  disabled={isDerived && !editingChar.overrides?.avatar}
                >
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
                      disabled={isDerived && !editingChar.overrides?.avatar}
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
                            disabled={isDerived && !editingChar.overrides?.avatar}
                          >
                            変更
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateEditingField('features.avatarImage', null);
                            }}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 whitespace-nowrap"
                            disabled={isDerived && !editingChar.overrides?.avatar}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX;
                        const y = e.clientY;
                        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
                          setIsDragging(false);
                        }
                      }}
                      onDrop={(e) => {
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
                          setUploadedImage(event.target?.result);
                          setShowImageCropper(true);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
                        isDragging
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-300 bg-white hover:border-gray-400'
                      } ${isDerived && !editingChar.overrides?.avatar ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="text-4xl">{isDragging ? '📥' : '🖼️'}</div>
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
                            disabled={isDerived && !editingChar.overrides?.avatar}
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
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Feature Settings */}
            <div className="border-t pt-3 space-y-3">
              <h4 className="font-semibold text-sm">機能設定</h4>

              {/* Emotion Toggle */}
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          手動設定: 現在の感情
                        </label>
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
                        💡 現在の感情: {emotions[editingChar.features.currentEmotion]?.emoji}{' '}
                        {emotions[editingChar.features.currentEmotion]?.label}
                        <br />
                        会話の内容に応じてAIが自動的に感情を変化させます
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Affection Toggle */}
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
                        {editingChar.features.autoManageAffection !== false ? '初期好感度' : '現在の好感度'}:{' '}
                        {editingChar.features.affectionLevel}
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

            {/* Save/Cancel Buttons */}
            <div className="flex gap-2 pt-3 border-t">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                保存
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>

        {/* Emoji Picker Modal */}
        {showEmojiPicker && (
          <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />
        )}

        {/* Image Cropper Modal */}
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

        {/* AI Assist Character Creation Modal */}
        {showAutoSetupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <User size={24} className="text-purple-600" />
                  AIアシストキャラクター作成
                </h2>
                <button
                  onClick={handleCancelAutoSetup}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* タブ */}
              <div className="flex border-b bg-gray-50">
                <button
                  onClick={() => {
                    setAutoSetupMode('template');
                    setGeneratedCharacterPreview(null);
                    setGeneratedTemplate(null);
                    setGenerationError(null);
                  }}
                  className={`flex-1 px-6 py-3 font-medium transition-colors ${
                    autoSetupMode === 'template'
                      ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  既存キャラクター（テンプレート）
                </button>
                <button
                  onClick={() => {
                    setAutoSetupMode('simple');
                    setGeneratedCharacterPreview(null);
                    setGeneratedTemplate(null);
                    setGenerationError(null);
                  }}
                  className={`flex-1 px-6 py-3 font-medium transition-colors ${
                    autoSetupMode === 'simple'
                      ? 'text-purple-600 border-b-2 border-purple-600 bg-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  オリジナルキャラクター（AI生成）
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {autoSetupMode === 'template' ? (
                  // テンプレート生成モード
                  !generatedTemplate ? (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-900">
                          📋 テンプレート生成:</strong> キャラクター名と作品名を入力すると、WebSearch対応AIで使用するプロンプトとテンプレートを生成します。
                          生成されたプロンプトを Claude.ai などのWebSearch対応AIに入力して、正確なキャラクター設定を作成してください。
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          キャラクター名 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={autoSetupCharName}
                          onChange={(e) => setAutoSetupCharName(e.target.value)}
                          placeholder="例: 竈門炭治郎、初音ミク、etc..."
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          作品名（任意）
                        </label>
                        <input
                          type="text"
                          value={autoSetupWorkName}
                          onChange={(e) => setAutoSetupWorkName(e.target.value)}
                          placeholder="例: 鬼滅の刃、VOCALOID、etc..."
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          追加情報（任意）
                        </label>
                        <textarea
                          value={autoSetupAdditionalInfo}
                          onChange={(e) => setAutoSetupAdditionalInfo(e.target.value)}
                          placeholder="キャラクターの特徴や設定について追加情報があれば入力してください&#10;例: 明るく前向きな性格、剣術が得意、家族思い、etc..."
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleGenerateTemplate}
                          disabled={!autoSetupCharName.trim()}
                          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        >
                          <FileText size={16} />
                          プロンプト&テンプレート生成
                        </button>
                        <button
                          onClick={handleCancelAutoSetup}
                          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                          キャンセル
                        </button>
                      </div>
                    </>
                  ) : (
                    // テンプレート表示画面
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-900">
                          ✅ プロンプト生成完了:</strong> 以下のプロンプトをコピーして、Claude.ai などのWebSearch対応AIに入力してください。
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">プロンプト</label>
                          <button
                            onClick={() => handleCopyTemplate(generatedTemplate.prompt)}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Copy size={14} />
                            コピー
                          </button>
                        </div>
                        <textarea
                          value={generatedTemplate.prompt}
                          readOnly
                          className="w-full px-4 py-2 border rounded-lg bg-gray-50 h-48 text-sm font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">テンプレートJSON</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleCopyTemplate(generatedTemplate.jsonTemplate)}
                              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                            >
                              <Copy size={14} />
                              コピー
                            </button>
                            <button
                              onClick={handleDownloadTemplate}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                            >
                              <Download size={14} />
                              ダウンロード
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={generatedTemplate.jsonTemplate}
                          readOnly
                          className="w-full px-4 py-2 border rounded-lg bg-gray-50 h-48 text-sm font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          ファイル名: {generatedTemplate.fileName}
                        </p>
                      </div>

                      <div className="border-t pt-4">
                        <h3 className="font-medium text-gray-900 mb-3">📝 次の手順:</h3>
                        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                          <li>上記のプロンプトを コピー</strong> してください</li>
                          <li>Claude.ai</strong> を新しいタブで開く（WebSearch機能が利用可能）</li>
                          <li>新しいチャットでプロンプトを貼り付けて送信</li>
                          <li>AIが生成したJSON形式の設定をコピー</li>
                          <li>このアプリの「インポート</strong>」機能でJSONを読み込む</li>
                        </ol>
                        <div className="mt-3 text-xs text-gray-600 bg-blue-50 p-2 rounded">
                          💡 ヒント:</strong> テンプレートJSONをダウンロードして手動編集してからインポートすることもできます
                        </div>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => setGeneratedTemplate(null)}
                          className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                          やり直す
                        </button>
                        <button
                          onClick={handleCancelAutoSetup}
                          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          完了
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  // シンプル説明モード
                  !generatedCharacterPreview ? (
                    <>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <p className="text-sm text-purple-900">
                          ✨ AI生成:</strong> 簡単な説明を入力すると、AIが詳細なキャラクター設定を自動生成します。
                          オリジナルキャラクターの作成に最適です。
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          キャラクターの説明 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={simpleDescription}
                          onChange={(e) => setSimpleDescription(e.target.value)}
                          placeholder="例: 明るくて元気な女子高生、料理が得意で家族思い。いつも笑顔で周りを元気にする。&#10;&#10;例: クールで無口な剣士、黒髪に青い瞳。実は優しい性格で仲間思い。"
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent h-40 resize-none"
                          disabled={isGeneratingCharacter}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          性格、外見、特技、背景などを自由に記述してください
                        </p>
                      </div>

                      {generationError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm text-red-900">
                            エラー:</strong> {generationError}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleGenerateFromSimple}
                          disabled={isGeneratingCharacter || !simpleDescription.trim()}
                          className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        >
                          {isGeneratingCharacter ? (
                            <>
                              <RefreshCw size={16} className="animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <User size={16} />
                              キャラクター設定を生成
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelAutoSetup}
                          disabled={isGeneratingCharacter}
                          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-300"
                        >
                          キャンセル
                        </button>
                      </div>
                    </>
                  ) : (
                    // プレビュー画面
                    <>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm text-green-900">
                          ✅ 生成完了:</strong> キャラクター設定が生成されました。内容を確認して、必要に応じて編集画面で調整してください。
                        </p>
                      </div>

                      <div className="space-y-3 border rounded-lg p-4 bg-gray-50">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                          <p className="text-base font-semibold">{generatedCharacterPreview.name}</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">性格</label>
                          <p className="text-sm text-gray-800">{generatedCharacterPreview.personality}</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">話し方</label>
                          <p className="text-sm text-gray-800">{generatedCharacterPreview.speakingStyle}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">一人称</label>
                            <p className="text-sm text-gray-800">{generatedCharacterPreview.firstPerson}</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">二人称</label>
                            <p className="text-sm text-gray-800">{generatedCharacterPreview.secondPerson}</p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">背景</label>
                          <p className="text-sm text-gray-800">{generatedCharacterPreview.background}</p>
                        </div>

                        {generatedCharacterPreview.catchphrases && generatedCharacterPreview.catchphrases.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">決め台詞</label>
                            <ul className="list-disc list-inside space-y-1">
                              {generatedCharacterPreview.catchphrases.map((phrase, idx) => (
                                <li key={idx} className="text-sm text-gray-800">{phrase}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {generatedCharacterPreview.customPrompt && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">詳細設定（カスタムプロンプト）</label>
                            <div className="text-xs text-gray-800 bg-white p-3 rounded border whitespace-pre-wrap max-h-64 overflow-y-auto">
                              {generatedCharacterPreview.customPrompt}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={handleApplyGeneratedCharacter}
                          className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 font-medium"
                        >
                          <Check size={16} />
                          この設定で作成
                        </button>
                        <button
                          onClick={() => {
                            setGeneratedCharacterPreview(null);
                            setGenerationError(null);
                          }}
                          className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                        >
                          やり直す
                        </button>
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(CharacterModal);

// ========================================
// Main Application Component
// ========================================

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// UI Components

const MultiCharacterChat = () => {
  // ===== State管理 =====
  const [isInitialized, setIsInitialized] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showConversationSettings, setShowConversationSettings] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title;
    message;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // Message input state
  const [userPrompt, setUserPrompt] = useState('');
  const [messageType, setMessageType] = useState<'user' | 'narration'>('user');
  const [nextSpeaker, setNextSpeaker] = useState<string | null>(null);
  const [prefillText, setPrefillText] = useState('');

  // Model settings
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingBudget, setThinkingBudget] = useState(2000);

  // UI state
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({});
  const [showVersions, setShowVersions] = useState<Record<number, boolean>>({});
  const [showRegeneratePrefill, setShowRegeneratePrefill] = useState<number | null>(null);
  const [regeneratePrefill, setRegeneratePrefill] = useState('');

  // Refs
  const characterFileInputRef = useRef<HTMLInputElement>(null);
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
      responseText,
      conversation,
      thinkingContent?,
      responseGroupId?): { messages; characterUpdates: Record<string, any> } => {
      const messages = [];
      const characterUpdates: Record<string, any> = {};
      const lines = responseText.split('\n');
      let currentType= null;
      let currentCharacterId= null;
      let currentContent = [];
      let thinkingAdded = false;

      const finishCurrentMessage = () => {
        if (currentContent.length > 0) {
          let content = currentContent.join('\n').trim();
          let emotion;
          let affection;

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
              id,
              role: 'assistant',
              type: (currentType) || 'character',
              characterId,
              content,
              emotion,
              affection,
              thinking: !thinkingAdded && thinkingContent ? thinkingContent ,
              timestamp,
              responseGroupId,
              alternatives: [
                {
                  id: generateId(),
                  content,
                  emotion,
                  affection,
                  thinking: !thinkingAdded && thinkingContent ? thinkingContent ,
                  timestamp,
                  isActive,
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

      // If no messages were parsed (no tags found), treat entire response message
      if (messages.length === 0) {
        const anyCharMatch = responseText.match(/\[CHARACTER:([^\]]+)\]/);
        let characterId;
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
          id,
          role: 'assistant',
          type,
          characterId,
          content,
          thinking,
          timestamp,
          responseGroupId,
          alternatives: [
            {
              id: generateId(),
              content,
              emotion,
              affection,
              thinking,
              timestamp,
              isActive,
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
    (conversation, forcedNextSpeaker?, messages?) => {
      if (!conversation) return '';

      const participants = conversation.participantIds
        .map((id) => characterManager.getCharacterById(id))
        .map((c) => characterManager.getEffectiveCharacter(c))
        .filter((c) => c)[];

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
  const generateConversationTitle = useCallback((messages) => {
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
    autoSaveEnabled,
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

    const newMessage = {
      id: generateId(),
      role: 'user',
      type,
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
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setShowCharacterModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                キャラクター管理
              </button>
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
                  ? (characterManager.getCharacterById(msg.characterId) || null)
                  ;
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
      {showCharacterModal && (
        <CharacterModal
          characters={characterManager.characters}
          setCharacters={characterManager.setAllCharacters}
          characterGroups={[]}
          setCharacterGroups={() => {}}
          getDefaultCharacter={() => characterManager.createCharacter({})}
          exportCharacter={characterManager.exportCharacter}
          importCharacter={characterManager.importCharacter}
          characterFileInputRef={characterFileInputRef}
          emotions={EMOTIONS}
          onClose={() => setShowCharacterModal(false)}
        />
      )}

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

