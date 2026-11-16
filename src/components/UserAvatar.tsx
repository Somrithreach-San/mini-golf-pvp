import React, { useState } from 'react';
import { getGazeAvatarUrl } from '../data/userProfile';

interface UserAvatarProps {
  seed: string;
  size?: number | string;
  className?: string;
  alt?: string;
  showBorder?: boolean;
}

export function UserAvatar({
  seed,
  size = 36,
  className = '',
  alt = 'Golfer Avatar',
  showBorder = true,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const avatarUrl = getGazeAvatarUrl(seed);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-100 via-sky-50 to-emerald-100 ${
        showBorder ? 'border-2 border-white shadow-sm ring-1 ring-slate-200' : ''
      } ${className}`}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }}
      title={alt}
    >
      {!hasError ? (
        <img
          src={avatarUrl}
          alt={alt}
          onError={() => setHasError(true)}
          className="w-full h-full object-contain p-0.5 select-none pointer-events-none"
          loading="lazy"
        />
      ) : (
        <span className="font-black text-xs text-indigo-700">
          {(seed || 'G')[0].toUpperCase()}
        </span>
      )}
    </div>
  );
}
