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
  exportCharacter: (characterId: string) => void;
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
  const getBaseCharacter = (charId: string) => {
    return characters.find((c) => c.id === charId);
  };

  const isOverridden = (char: Character, field: string) => {
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
        <div className="overflow-y-auto p-4 flex-1" style={{ minHeight: 0 }}>
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
                          setUploadedImage(event.target?.result as string);
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
      </div>
    </div>
  );
};

export default React.memo(CharacterModal);
