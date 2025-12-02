/**
 * Avatar Display Component
 * Displays character avatar (emoji or image)
 */

import React from 'react';
import type { Character } from '../types';

interface AvatarDisplayProps {
  character: Character | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ character, size = 'md' }) => {
  if (!character) return null;

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-10 h-10 text-2xl',
    lg: 'w-16 h-16 text-4xl',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;

  if (character.features.avatarType === 'image' && character.features.avatarImage) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 bg-gray-100`}>
        <img
          src={character.features.avatarImage}
          alt={character.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <span className={`${sizeClass} flex items-center justify-center flex-shrink-0`}>
      {character.features.avatar || '😊'}
    </span>
  );
};

// Memoize with custom comparison
export default React.memo(AvatarDisplay, (prevProps, nextProps) => {
  // Don't re-render if character ID and avatar settings are the same
  return (
    prevProps.character?.id === nextProps.character?.id &&
    prevProps.character?.features.avatar === nextProps.character?.features.avatar &&
    prevProps.character?.features.avatarImage === nextProps.character?.features.avatarImage &&
    prevProps.size === nextProps.size
  );
});
