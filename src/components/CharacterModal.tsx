/**
 * Character Modal Component
 * Large modal for creating, editing, and managing characters and groups
 */

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
} from 'lucide-react';
import type { Character, CharacterGroup, EmotionInfo } from '../types';
import { debounce } from '../lib/utils';
import AvatarDisplay from './AvatarDisplay';
import EmojiPicker from './EmojiPicker';
import ImageCropper from './ImageCropper';

interface CharacterModalProps {
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  characterGroups: CharacterGroup[];
  setCharacterGroups: React.Dispatch<React.SetStateAction<CharacterGroup[]>>;
  getDefaultCharacter: () => Character;
  exportCharacter: (character: Character) => void;
  importCharacter: (event: React.ChangeEvent<HTMLInputElement>) => void;
  characterFileInputRef: React.RefObject<HTMLInputElement>;
  emotions: Record<string, EmotionInfo>;
  onClose: () => void;
}

const CharacterModal: React.FC<CharacterModalProps> = ({
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
  const [generatedCharacterPreview, setGeneratedCharacterPreview] = useState<Character | null>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // ===== Debounced Search =====
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
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
    (baseChar: Character) => {
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

  const handleEdit = useCallback((char: Character) => {
    setEditingChar(JSON.parse(JSON.stringify(char)));
    setIsNew(false);
    setIsDerived(!!char.baseCharacterId);
  }, []);

  const toggleOverride = useCallback(
    (field: string) => {
      if (!editingChar) return;

      const newOverrides = { ...editingChar.overrides };
      if (newOverrides[field]) {
        delete newOverrides[field];
      } else {
        newOverrides[field] = true;
      }

      setEditingChar({
        ...editingChar,
        overrides: newOverrides,
      });
    },
    [editingChar]
  );

  const updateEditingField = useCallback(
    (path: string, value: any) => {
      setEditingChar((prev) => {
        if (!prev) return prev;
        const keys = path.split('.');
        const newChar = JSON.parse(JSON.stringify(prev));
        let current: any = newChar;
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
      setCharacters((prev) => prev.map((c) => (c.id === editingChar.id ? editingChar : c)));
    }

    setEditingChar(null);
    setIsNew(false);
    setIsDerived(false);
  }, [editingChar, isNew, setCharacters]);

  const handleDelete = useCallback(
    (charId: string) => {
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

  // ===== Avatar Handling =====
  const handleEmojiSelect = useCallback(
    (emoji: string) => {
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
      setUploadedImage(event.target?.result as string);
      setShowImageCropper(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImageCrop = useCallback(
    (croppedImage: string) => {
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
                      onClick={() => exportCharacter(char)}
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

  // Character Edit View - Placeholder for now
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">{isNew ? '新規キャラクター作成' : 'キャラクター編集'}</h2>
          <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded">
            <X size={24} />
          </button>
        </div>
        <div className="text-center text-gray-500 py-8">
          キャラクター編集フォーム実装中...
          <br />
          <button onClick={handleSave} className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg">
            保存（仮）
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(CharacterModal);
