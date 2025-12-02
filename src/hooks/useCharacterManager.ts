/**
 * Character Management Hook
 * Handles character CRUD operations and derived character inheritance
 */

import { useState, useCallback } from 'react';
import type { Character } from '../types';
import { generateId, createTimestamps, getTimestamp } from '../lib/utils';
import { generateFileName } from '../lib/helpers';

export const useCharacterManager = () => {
  const [characters, setCharacters] = useState<Character[]>([]);

  /**
   * Get character by ID
   */
  const getCharacterById = useCallback(
    (id: string): Character | undefined => {
      return characters.find((c) => c.id === id);
    },
    [characters]
  );

  /**
   * Get effective character (resolves derived character inheritance)
   * Supports multi-level inheritance recursively
   */
  const getEffectiveCharacter = useCallback(
    (character: Character | null | undefined): Character | null => {
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
      const merged: Character = {
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
  const createCharacter = useCallback((data: Partial<Character>): Character => {
    const newCharacter: Character = {
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
  const updateCharacter = useCallback((characterId: string, updates: Partial<Character>) => {
    setCharacters((chars) =>
      chars.map((c) =>
        c.id === characterId ? { ...c, ...updates, updated: getTimestamp() } : c
      )
    );
  }, []);

  /**
   * Delete character
   */
  const deleteCharacter = useCallback((characterId: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== characterId));
  }, []);

  /**
   * Duplicate character
   */
  const duplicateCharacter = useCallback(
    (characterId: string): Character | null => {
      const original = getCharacterById(characterId);
      if (!original) return null;

      const duplicate: Character = {
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
    (characterId: string) => {
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
          const char = JSON.parse(e.target?.result as string);
          const newChar: Character = {
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
