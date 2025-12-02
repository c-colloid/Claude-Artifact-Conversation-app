/**
 * Conversation Settings Panel Component
 * Modal for editing conversation settings including participants and relationships
 */

import React, { useState } from 'react';
import { X, Users, Plus, Trash2 } from 'lucide-react';
import type { Conversation, Character, Relationship } from '../types';
import AvatarDisplay from './AvatarDisplay';

interface ConversationSettingsProps {
  conversation: Conversation;
  characters: Character[];
  onUpdate: (updates: Partial<Conversation>) => void;
  onClose: () => void;
}

const ConversationSettings: React.FC<ConversationSettingsProps> = ({
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

  const toggleParticipant = (charId: string) => {
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

  const updateRelationship = (index: number, field: keyof Relationship, value: string) => {
    setLocalRelationships((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const deleteRelationship = (index: number) => {
    setLocalRelationships((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onUpdate({
      title: localTitle,
      backgroundInfo: localBackground,
      narrationEnabled: localNarration,
      autoGenerateNarration: localAutoNarration,
      participantIds: localParticipants,
      relationships: localRelationships,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ zIndex: 50 }}
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
                          ) : null;
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
                          ) : null;
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
