/**
 * Storage Management Hook
 * Handles data persistence with IndexedDB and LocalStorage fallback
 */

import { useState, useCallback, useMemo } from 'react';
import type { Character, CharacterGroup, Conversation, UsageStats, StorageData } from '../types';
import { IndexedDBWrapper } from '../lib/indexedDB';
import { getTimestamp, debounce } from '../lib/utils';
import { STORAGE_KEY, AUTO_SAVE_DELAY } from '../constants';

interface UseStorageOptions {
  characters: Character[];
  characterGroups: CharacterGroup[];
  conversations: Conversation[];
  currentConversationId: string | null;
  selectedModel: string;
  thinkingEnabled: boolean;
  thinkingBudget: number;
  usageStats: UsageStats;
  autoSaveEnabled: boolean;
  isInitialized: boolean;
  onLoad?: (data: Partial<StorageData>) => void;
}

type SaveStatus = '' | 'saving' | 'saved' | 'error';

export const useStorage = (options: UseStorageOptions) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  /**
   * Save data to storage
   * Uses IndexedDB as primary and LocalStorage as fallback
   */
  const saveToStorage = useCallback(async () => {
    if (!options.autoSaveEnabled || !options.isInitialized) return;

    setSaveStatus('saving');
    try {
      const saveData: StorageData = {
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

      // Save to LocalStorage as fallback
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
  const loadFromStorage = useCallback(async (): Promise<boolean> => {
    try {
      let data: StorageData | null = null;

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
          data = JSON.parse(dataString) as StorageData;

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
            const features = char.features ?? ({} as any);
            const definition = char.definition ?? ({} as any);
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
  const formatLastSaved = useCallback((): string => {
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
