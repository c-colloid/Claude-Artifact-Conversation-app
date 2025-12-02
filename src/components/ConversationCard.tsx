/**
 * Conversation Card Component
 * Individual conversation list item with title editing
 */

import React from 'react';
import { Check, Edit2, Download, Trash2, Users } from 'lucide-react';
import type { Conversation } from '../types';

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (id: string) => void;
  onEditTitle: (id: string, title: string) => void;
  onExport: (id: string) => void;
  onDelete: (id: string) => void;
  editingConversationTitle: string | null;
  editingTitleText: string;
  setEditingTitleText: (text: string) => void;
  setEditingConversationTitle: (id: string | null) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
}

const ConversationCard: React.FC<ConversationCardProps> = ({
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
