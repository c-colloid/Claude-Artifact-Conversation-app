/**
 * Utility Functions for Multi Character Chat Application
 */

import type { Timestamps } from '../types';

// ========================================
// Function Utilities
// ========================================

/**
 * Debounce function
 * Delays function execution and only executes the last call
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
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
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
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
 * - Exports as WebP format (70% quality)
 * - Reduces file size by 60-80%
 */
export const compressImage = async (
  file: File,
  maxSize: number = 200,
  quality: number = 0.7
): Promise<string> => {
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

        // Export as WebP (fallback to JPEG if browser doesn't support WebP)
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

      img.src = e.target?.result as string;
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
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Get current ISO timestamp
 */
export const getTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDate = (): string => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * Create timestamp object for created/updated fields
 */
export const createTimestamps = (): Timestamps => {
  const now = getTimestamp();
  return {
    created: now,
    updated: now
  };
};

// ========================================
// File Utilities
// ========================================

/**
 * Generate filename for export
 */
export const generateFileName = (prefix: string, name: string): string => {
  return `${prefix}_${name}_${getTodayDate()}.json`;
};

// ========================================
// Model Utilities
// ========================================

/**
 * Get icon for model based on name
 */
export const getIconForModel = (displayName: string, modelId: string): string => {
  const name = (displayName || modelId).toLowerCase();
  if (name.includes('opus')) return '👑';
  if (name.includes('sonnet')) return '⭐';
  if (name.includes('haiku')) return '⚡';
  return '🤖';
};

/**
 * Get short display name for model
 */
export const getShortName = (displayName: string | undefined, modelId: string): string => {
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
