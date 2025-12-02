/**
 * Type Definitions for Multi Character Chat Application
 */

// ========================================
// Character Types
// ========================================

export interface CharacterDefinition {
  personality: string;
  speakingStyle: string;
  firstPerson: string;
  secondPerson: string;
  background: string;
  catchphrases: string[];
  customPrompt: string;
}

export interface CharacterFeatures {
  emotionEnabled: boolean;
  affectionEnabled: boolean;
  autoManageEmotion: boolean;
  autoManageAffection: boolean;
  currentEmotion: string;
  affectionLevel: number;
  avatar: string;
  avatarType: 'emoji' | 'image';
  avatarImage: string | null;
}

export interface Character {
  id: string;
  name: string;
  baseCharacterId: string | null;
  overrides: Record<string, boolean>;
  definition: CharacterDefinition;
  features: CharacterFeatures;
  created: string;
  updated: string;
}

export interface CharacterGroup {
  id: string;
  name: string;
  characterIds: string[];
  created: string;
  updated: string;
}

// ========================================
// Message Types
// ========================================

export interface MessageAlternative {
  id: string;
  content: string;
  emotion?: string;
  affection?: number;
  thinking?: string;
  isActive: boolean;
}

export interface Message {
  id: string;
  type: 'user' | 'character' | 'narration';
  characterId?: string;
  content: string;
  emotion?: string;
  affection?: number;
  thinking?: string;
  timestamp: string;
  alternatives?: MessageAlternative[];
  responseGroupId?: string;
}

// ========================================
// Conversation Types
// ========================================

export interface Relationship {
  char1Id: string;
  char2Id: string;
  type: string;
  description: string;
}

export interface Conversation {
  id: string;
  title: string;
  participantIds: string[];
  backgroundInfo: string;
  narrationEnabled: boolean;
  autoGenerateNarration: boolean;
  relationships: Relationship[];
  parentConversationId?: string | null;
  forkPoint?: number | null;
  messages: Message[];
  created: string;
  updated: string;
}

// ========================================
// API Types
// ========================================

export interface Model {
  id: string;
  display_name: string;
  created_at?: string;
  type?: string;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalCost: number;
}

export interface APIMessage {
  role: 'user' | 'assistant';
  content: string | Array<{type: string; text?: string; thinking?: string}>;
}

export interface ThinkingConfig {
  type: 'enabled';
  budget_tokens: number;
}

export interface APIRequestBody {
  model: string;
  max_tokens: number;
  messages: APIMessage[];
  system?: string;
  thinking?: ThinkingConfig;
}

export interface APIResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{type: string; text?: string; thinking?: string}>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ========================================
// UI State Types
// ========================================

export interface ConfirmDialogState {
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
}

export interface EmotionInfo {
  label: string;
  emoji: string;
  color: string;
}

export interface ConversationStats {
  totalMessages: number;
  userMessages: number;
  characterMessages: Record<string, number>;
  narrationMessages: number;
  affectionHistory: Array<{
    characterId: string;
    characterName: string;
    history: Array<{
      messageIndex: number;
      affection: number;
    }>;
  }>;
}

// ========================================
// Storage Types
// ========================================

export interface StorageData {
  characters: Character[];
  characterGroups: CharacterGroup[];
  conversations: Conversation[];
  currentConversationId: string | null;
  selectedModel: string;
  thinkingEnabled: boolean;
  thinkingBudget: number;
  usageStats: UsageStats;
  timestamp: string;
  version: string;
}

// ========================================
// Utility Types
// ========================================

export interface Timestamps {
  created: string;
  updated: string;
}

export type MessageType = 'user' | 'character' | 'narration';
export type AvatarType = 'emoji' | 'image';
export type EmotionType = 'neutral' | 'joy' | 'sadness' | 'anger' | 'fun' | 'embarrassed' | 'surprised';
export type SidebarView = 'conversations' | 'messages' | 'stats';
export type SaveStatus = '' | 'saving' | 'saved' | 'error';
