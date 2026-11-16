import React from 'react';

interface CardTimerBorderProps {
  timeRemaining: number;
  totalTime?: number;
  player: 'p1' | 'p2';
  isActive: boolean;
}

export const CardTimerBorder: React.FC<CardTimerBorderProps> = ({
  timeRemaining,
  totalTime = 35,
  player,
  isActive,
}) => {
  if (!isActive) return null;

  const ratio = Math.max(0, Math.min(1, timeRemaining / totalTime));
  // strokeDashoffset goes from 0 (100% full perimeter) to 100 (depleted)
  const dashOffset = (1 - ratio) * 100;

  // Color transitions as time runs out:
  // > 15s: Player Theme Color (Cyan #00e5ff for P1, Orange #ff5722 for P2)
  // 7s - 15s: Warning Amber #f59e0b
  // <= 7s: Critical Pulsing Red #ef4444
  let strokeColor = player === 'p1' ? '#00e5ff' : '#ff5722';
  let trackColor = player === 'p1' ? 'rgba(0, 229, 255, 0.20)' : 'rgba(255, 87, 34, 0.20)';
  let glowColor = player === 'p1' ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 87, 34, 0.35)';

  if (timeRemaining <= 7) {
    strokeColor = '#ef4444';
    trackColor = 'rgba(239, 68, 68, 0.25)';
    glowColor = 'rgba(239, 68, 68, 0.55)';
  } else if (timeRemaining <= 15) {
    strokeColor = '#f59e0b';
    trackColor = 'rgba(245, 158, 11, 0.22)';
    glowColor = 'rgba(245, 158, 11, 0.45)';
  }

  const isCritical = timeRemaining <= 7;

  return (
    <div
      className={`absolute -inset-[2px] pointer-events-none rounded-2xl z-20 ${
        isCritical ? 'animate-pulse' : ''
      }`}
      style={{
        boxShadow: `0 0 12px ${glowColor}`,
        borderRadius: '16px',
      }}
    >
      <svg
        className="w-full h-full overflow-visible"
        style={{ borderRadius: '16px' }}
      >
        {/* Depleted background track around the card perimeter */}
        <rect
          x="1.6"
          y="1.6"
          width="calc(100% - 3.2px)"
          height="calc(100% - 3.2px)"
          rx="15"
          ry="15"
          fill="none"
          stroke={trackColor}
          strokeWidth="3.2"
        />
        {/* Animated countdown timer border draining around the card */}
        <rect
          x="1.6"
          y="1.6"
          width="calc(100% - 3.2px)"
          height="calc(100% - 3.2px)"
          rx="15"
          ry="15"
          fill="none"
          stroke={strokeColor}
          strokeWidth="3.2"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 120ms linear, stroke 200ms ease',
          }}
        />
      </svg>
    </div>
  );
};
