/**
 * Constants for Multi Character Chat Application
 */

import type { EmotionInfo, Model } from '../types';

// ========================================
// Display Settings
// ========================================

export const MESSAGE_LOAD_INCREMENT = 50; // Number of messages to load when clicking "Load More"

// ========================================
// Storage Settings
// ========================================

export const STORAGE_KEY = 'multi-character-chat-data-v1';
export const AUTO_SAVE_DELAY = 2000; // milliseconds

// ========================================
// File Settings
// ========================================

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

// ========================================
// Model Definitions
// ========================================

export const FALLBACK_MODELS: Array<Model & { icon: string; name: string }> = [
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

export const EMOTIONS: Record<string, EmotionInfo> = {
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

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';
export const ANTHROPIC_VERSION = '2023-06-01';
export const DEFAULT_MAX_TOKENS = 4000;

// ========================================
// Default Thinking Settings
// ========================================

export const DEFAULT_THINKING_BUDGET = 2000; // tokens
export const MIN_THINKING_BUDGET = 1000;
export const MAX_THINKING_BUDGET = 10000;
