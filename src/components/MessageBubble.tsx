/**
 * Message Bubble Component
 * Individual message display with editing, regeneration, and version switching
 */

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
import type { Message, Character, EmotionInfo } from '../types';
import AvatarDisplay from './AvatarDisplay';

interface MessageBubbleProps {
  message: Message;
  index: number;
  character: Character | null;
  editingIndex: number | null;
  editingContent: string;
  setEditingContent: (content: string) => void;
  editingEmotion: string | null;
  setEditingEmotion: (emotion: string | null) => void;
  editingAffection: number | null;
  setEditingAffection: (affection: number | null) => void;
  handleEdit: (index: number) => void;
  handleSaveEdit: (index: number) => void;
  handleCancelEdit: () => void;
  handleDelete: (index: number) => void;
  handleFork: (index: number) => void;
  showRegeneratePrefill: number | null;
  setShowRegeneratePrefill: (index: number | null) => void;
  regeneratePrefill: string;
  setRegeneratePrefill: (prefill: string) => void;
  handleRegenerateGroup: (index: number) => void;
  handleRegenerateFrom: (index: number) => void;
  handleSwitchVersion: (index: number, alternativeId: string) => void;
  showVersions: Record<number, boolean>;
  setShowVersions: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  isLoading: boolean;
  showThinking: Record<number, boolean>;
  setShowThinking: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  emotions: Record<string, EmotionInfo>;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
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
        isNarration ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      <div
        className={`${
          isNarration
            ? 'max-w-3xl bg-gray-50 border border-gray-300 rounded shadow-sm'
            : isUser
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
            ) : isUser ? (
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
                  setShowRegeneratePrefill(showRegeneratePrefill === index ? null : index)
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
