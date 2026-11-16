import React, { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Home, Music, Volume2, Globe, RotateCcw, Play, Grid, Star, Sparkles, Check, Lock, X } from 'lucide-react';
import { GOLF_BALL_SKINS, GolfBallSkin } from '../data/balls';
import { Language, TRANSLATIONS } from '../data/i18n';
import { soundEngine } from '../audio/soundEngine';

// ==========================================
// 0. REUSABLE CARTOON MODAL SHELL (Lavender / Purple Skin)
// ==========================================
export type GameModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: CSSProperties['maxWidth'];
  showClose?: boolean;
};

export function GameModal({
  title,
  onClose,
  children,
  footer,
  maxWidth = '430px',
  showClose = true,
}: GameModalProps) {
  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <section
        className="ui-panel ui-modal-panel"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={`ui-panel-title ${!showClose ? 'ui-panel-title--solo' : ''}`}>{title}</h2>

        {showClose && (
          <button
            type="button"
            className="ui-panel-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            ✕
          </button>
        )}

        <div className="ui-modal-body">{children}</div>

        {footer && <div className="ui-modal-footer">{footer}</div>}
      </section>
    </div>
  );
}

// ==========================================
// 0.5 PAUSED MODAL (Exact match to Reference Mockup)
// ==========================================
interface PausedModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export const PausedModal: React.FC<PausedModalProps> = ({
  isOpen,
  onResume,
  onRetry,
  onHome,
}) => {
  if (!isOpen) return null;

  return (
    <GameModal title="Paused" onClose={onResume} maxWidth="340px">
      <div className="flex items-center justify-center gap-4 py-4">
        {/* Coin 1: Home */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onHome();
          }}
          className="btn-round-gold"
          title="Home"
        >
          <Home className="w-6 h-6 stroke-[2.75]" />
        </button>

        {/* Coin 2: Retry */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onRetry();
          }}
          className="btn-round-gold"
          title="Restart Hole"
        >
          <RotateCcw className="w-6 h-6 stroke-[2.75]" />
        </button>

        {/* Coin 3: Play / Resume */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onResume();
          }}
          className="btn-round-gold"
          title="Resume"
        >
          <Play className="w-6 h-6 fill-current ml-0.5" />
        </button>
      </div>
    </GameModal>
  );
};

// ==========================================
// 1. SETTINGS MODAL (Exact match to Reference Mockup)
// ==========================================
interface SettingsModalProps {
  isOpen: boolean;
  language: Language;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  onChangeLanguage: (lang: Language) => void;
  onToggleMusic: (val: boolean) => void;
  onToggleSfx: (val: boolean) => void;
  onResetProgress: () => void;
  onClose: () => void;
  syncStatus?: {
    configured: boolean;
    connected: boolean;
    uid: string | null;
    mode: 'firebase' | 'local';
    isAnonymous?: boolean;
    email?: string | null;
  };
  onManualSync?: () => void;
  onOpenAccount?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  language,
  musicEnabled,
  sfxEnabled,
  onChangeLanguage,
  onToggleMusic,
  onToggleSfx,
  onResetProgress,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const [musicVol, setMusicVol] = useState(80);
  const [sfxVol, setSfxVol] = useState(90);

  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  return (
    <GameModal
      title={t.settings}
      onClose={onClose}
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="btn-3d-purple flex-1 h-12 rounded-2xl text-lg text-white font-display font-bold cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="btn-3d-orange flex-1 h-12 rounded-2xl text-lg text-white font-display font-bold cursor-pointer"
          >
            Save
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-2 px-1 text-[#4e2978]">
        {/* Section: Audio Settings */}
        <div>
          <h3 className="font-display font-black text-base text-[#7d36c8] mb-2.5">
            Audio settings
          </h3>

          <div className="space-y-3">
            {/* Music Toggle & Slider */}
            <div className="ui-card p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-[#4e2978]">
                  Sound music
                </span>
                <div
                  className={`ui-toggle-track ${musicEnabled ? 'is-checked' : ''}`}
                  onClick={() => {
                    soundEngine.playClick();
                    onToggleMusic(!musicEnabled);
                  }}
                  role="switch"
                  aria-checked={musicEnabled}
                >
                  <div className="ui-toggle-thumb" />
                </div>
              </div>

              {/* Music Volume Slider */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-bold text-[#8a68a8] w-12">Volume</span>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={musicEnabled ? musicVol : 0}
                    disabled={!musicEnabled}
                    onChange={(e) => setMusicVol(Number(e.target.value))}
                    className="w-full h-3 rounded-full appearance-none bg-[#ded0ea] accent-[#ffa500] cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            {/* Sound Effect Toggle & Slider */}
            <div className="ui-card p-3.5 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-[#4e2978]">
                  Sound effect
                </span>
                <div
                  className={`ui-toggle-track ${sfxEnabled ? 'is-checked' : ''}`}
                  onClick={() => {
                    soundEngine.playClick();
                    onToggleSfx(!sfxEnabled);
                  }}
                  role="switch"
                  aria-checked={sfxEnabled}
                >
                  <div className="ui-toggle-thumb" />
                </div>
              </div>

              {/* SFX Volume Slider */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-bold text-[#8a68a8] w-12">Volume</span>
                <div className="flex-1 relative flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sfxEnabled ? sfxVol : 0}
                    disabled={!sfxEnabled}
                    onChange={(e) => setSfxVol(Number(e.target.value))}
                    className="w-full h-3 rounded-full appearance-none bg-[#ded0ea] accent-[#ffa500] cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Language Selection */}
        <div>
          <h3 className="font-display font-black text-base text-[#7d36c8] mb-2">
            Language
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'en', label: 'English', flag: '🇺🇸' },
                { id: 'es', label: 'Español', flag: '🇪🇸' },
                { id: 'fr', label: 'Français', flag: '🇫🇷' },
                { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
                { id: 'ja', label: '日本語', flag: '🇯🇵' },
                { id: 'zh', label: '中文', flag: '🇨🇳' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onChangeLanguage(item.id);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  language === item.id
                    ? 'btn-3d-orange text-white shadow-sm'
                    : 'ui-card text-[#51336d] hover:bg-white'
                }`}
              >
                <span>{item.flag}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section: Reset Progress */}
        <div className="pt-1">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setConfirmReset(true);
              }}
              className="btn-3d-red w-full h-10 rounded-xl text-xs font-display font-bold text-white cursor-pointer"
            >
              {t.resetProgress}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onResetProgress();
                  setConfirmReset(false);
                  onClose();
                }}
                className="btn-3d-red flex-1 h-10 rounded-xl text-xs font-display font-bold text-white cursor-pointer"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="btn-3d-purple flex-1 h-10 rounded-xl text-xs font-display font-bold text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </GameModal>
  );
};

// ==========================================
// 2. BALLS / SHOP MODAL
// ==========================================
interface BallsModalProps {
  isOpen: boolean;
  language: Language;
  selectedBallId: string;
  totalStars: number;
  onSelectBall: (skin: GolfBallSkin) => void;
  onClose: () => void;
}

export const BallsModal: React.FC<BallsModalProps> = ({
  isOpen,
  language,
  selectedBallId,
  totalStars,
  onSelectBall,
  onClose,
}) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  return (
    <GameModal
      title={t.chooseBallTitle}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          className="btn-3d-green w-full h-12 rounded-2xl text-white font-display font-bold text-base cursor-pointer"
        >
          {t.done}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 py-1">
        {GOLF_BALL_SKINS.map((skin) => {
          const isSelected = skin.id === selectedBallId;
          const isUnlocked = totalStars >= skin.requiredStars;
          const localized = t.balls[skin.id] || { name: skin.name, desc: skin.description };

          return (
            <div
              key={skin.id}
              onClick={() => {
                if (isUnlocked) {
                  soundEngine.playClick();
                  onSelectBall(skin);
                }
              }}
              className={`ui-card p-3 rounded-2xl flex flex-col items-center text-center transition-all ${
                isSelected
                  ? 'border-[#ffaa00] shadow-[0_0_0_3px_rgba(255,170,0,0.35)]'
                  : 'hover:scale-[1.02]'
              } ${isUnlocked ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-inner border-2 border-white mb-2"
                style={{ backgroundColor: skin.color }}
              >
                {skin.icon}
              </div>

              <div className="font-display font-black text-sm text-[#4e2978] leading-tight">
                {localized.name}
              </div>

              <div className="text-[11px] font-semibold text-[#8a68a8] mt-1 line-clamp-1">
                {localized.desc}
              </div>

              <div className="mt-2.5 w-full">
                {isSelected ? (
                  <div className="w-full py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Equipped</span>
                  </div>
                ) : isUnlocked ? (
                  <button
                    type="button"
                    className="btn-3d-purple w-full py-1 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Select
                  </button>
                ) : (
                  <div className="w-full py-1 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{skin.requiredStars} ★</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GameModal>
  );
};

// ==========================================
// 3. HELP / HOW TO PLAY MODAL
// ==========================================
interface HelpModalProps {
  isOpen: boolean;
  language: Language;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, language, onClose }) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  return (
    <GameModal
      title={t.howToPlay}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          className="btn-3d-green w-full h-12 rounded-2xl text-white font-display font-bold text-base cursor-pointer"
        >
          {t.gotIt}
        </button>
      }
    >
      <div className="space-y-3 py-1">
        <div className="ui-card p-3 rounded-2xl flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-[#7d36c8] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-sm">
            1
          </span>
          <p className="text-xs text-[#51336d] font-semibold leading-relaxed">
            <strong className="text-[#7d36c8] font-bold">{t.helpStep1Bold}</strong> {t.helpStep1Text}
          </p>
        </div>
        <div className="ui-card p-3 rounded-2xl flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-[#2ba93c] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-sm">
            2
          </span>
          <p className="text-xs text-[#51336d] font-semibold leading-relaxed">
            <strong className="text-[#2ba93c] font-bold">{t.helpStep2Bold}</strong> {t.helpStep2Text}
          </p>
        </div>
        <div className="ui-card p-3 rounded-2xl flex items-start gap-3">
          <span className="w-7 h-7 rounded-full bg-[#f2930a] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-sm">
            3
          </span>
          <p className="text-xs text-[#51336d] font-semibold leading-relaxed">
            <strong className="text-[#f2930a] font-bold">{t.helpStep3Bold}</strong> {t.helpStep3Text}
          </p>
        </div>
      </div>
    </GameModal>
  );
};

// ==========================================
// 4. CARTOON 3D GOLDEN STARS & VICTORY MODAL (Exact match to Reference Level 01 Mockup)
// ==========================================

const Cartoon3DStar: React.FC<{
  earned: boolean;
  size: number;
  rotationDeg: number;
  translateY: number;
  delayMs: number;
}> = ({ earned, size, rotationDeg, translateY, delayMs }) => {
  const [visible, setVisible] = useState(!earned);

  useEffect(() => {
    if (earned) {
      const timer = window.setTimeout(() => {
        setVisible(true);
        soundEngine.playClick();
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }, [earned, delayMs]);

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        transform: `translateY(${translateY}px) rotate(${rotationDeg}deg)`,
        transition: 'transform 0.3s ease',
      }}
      className={`relative flex items-center justify-center ${
        earned && visible ? 'animate-cartoon-star' : ''
      }`}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full overflow-visible ${
          earned ? 'animate-star-glow' : 'opacity-55'
        }`}
      >
        <defs>
          {/* Gold Star Face Gradient */}
          <linearGradient id="goldStarFace" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffef7a" />
            <stop offset="42%" stopColor="#ffc01e" />
            <stop offset="100%" stopColor="#f58800" />
          </linearGradient>

          {/* Gold Star Highlight Emboss */}
          <linearGradient id="goldStarHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#ffe66b" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffa000" stopOpacity="0.1" />
          </linearGradient>

          {/* Silver/Gray Star Face Gradient */}
          <linearGradient id="silverStarFace" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e4e7eb" />
            <stop offset="50%" stopColor="#b4bac2" />
            <stop offset="100%" stopColor="#8d949e" />
          </linearGradient>
        </defs>

        {/* 1. 3D Bottom Depth Shelf (Orange or Dark Gray) */}
        <path
          d="M 50,7 L 62,33 L 90,36 L 69,56 L 75,84 L 50,70 L 25,84 L 31,56 L 10,36 L 38,33 Z"
          fill={earned ? '#b85400' : '#555b63'}
          transform="translate(0, 6)"
        />

        {/* 2. Main 3D Cartoon Star Face with crisp outline */}
        <path
          d="M 50,7 L 62,33 L 90,36 L 69,56 L 75,84 L 50,70 L 25,84 L 31,56 L 10,36 L 38,33 Z"
          fill={earned ? 'url(#goldStarFace)' : 'url(#silverStarFace)'}
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* 3. Embossed Inner Star Core with warm glow */}
        {earned && (
          <path
            d="M 50,18 L 58,37 L 78,39 L 63,54 L 67,74 L 50,64 L 33,74 L 37,54 L 22,39 L 42,37 Z"
            fill="url(#goldStarHighlight)"
            stroke="#ffda44"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};

interface HoleCompleteModalProps {
  isOpen: boolean;
  language: Language;
  holeNumber: number;
  strokes: number;
  par: number;
  timeMs: number;
  starsEarned: number;
  bestRank: number | null;
  onHome: () => void;
  onRetry: () => void;
  onHolesMenu: () => void;
  onNextHole: () => void;
  isNextHoleUnlocked?: boolean;
  nextHoleLockReason?: string | null;
}

export const HoleCompleteModal: React.FC<HoleCompleteModalProps> = ({
  isOpen,
  language,
  holeNumber,
  strokes,
  par,
  timeMs,
  starsEarned,
  bestRank,
  onHome,
  onRetry,
  onHolesMenu,
  onNextHole,
  isNextHoleUnlocked = true,
  nextHoleLockReason,
}) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS[language];
  const levelTitle = `Level ${holeNumber < 10 ? '0' + holeNumber : holeNumber}`;

  // Authentic casual game calculated score: 120,000 baseline!
  const strokeBonus = Math.max(0, (par - strokes) * 15000);
  const timeDeduction = Math.min(25000, Math.floor(timeMs / 1000) * 120);
  const calculatedScore = Math.max(10000, 120000 + strokeBonus - timeDeduction);

  const totalSeconds = Math.max(1, Math.floor(Math.max(0, timeMs) / 1000));
  const formattedSecs = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(
    totalSeconds % 60
  ).padStart(2, '0')}`;

  return (
    <div className="ui-modal-backdrop">
      <section
        className="ui-panel ui-modal-panel text-center"
        style={{ maxWidth: '400px' }}
        role="dialog"
        aria-modal="true"
        aria-label={levelTitle}
      >
        {/* Title tab: "Level 01" */}
        <h2 className="ui-panel-title">{levelTitle}</h2>

        {/* Close Button '✕' */}
        <button
          type="button"
          className="ui-panel-close"
          aria-label="Close"
          onClick={onHome}
        >
          ✕
        </button>

        <div className="ui-modal-body flex flex-col items-center">
          {/* 3 Arched Cartoon 3D Golden Stars (Exact match to Level 01 mockup!) */}
          <div className="w-full flex items-center justify-center gap-2 my-2 h-[105px]">
            {/* Left Star: tilted -12° */}
            <Cartoon3DStar
              earned={starsEarned >= 1}
              size={68}
              rotationDeg={-12}
              translateY={6}
              delayMs={150}
            />

            {/* Center Star: larger (88px), elevated */}
            <Cartoon3DStar
              earned={starsEarned >= 2}
              size={88}
              rotationDeg={0}
              translateY={-8}
              delayMs={400}
            />

            {/* Right Star: tilted +12° */}
            <Cartoon3DStar
              earned={starsEarned >= 3}
              size={68}
              rotationDeg={12}
              translateY={6}
              delayMs={650}
            />
          </div>

          {/* Stadium Score Container ("120000 Score" from mockup!) */}
          <div className="ui-score-pill w-full max-w-[280px] my-3">
            <span className="font-display font-black text-3xl md:text-4xl text-[#512185] tracking-tight leading-none">
              {calculatedScore.toLocaleString()}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#7e53a3] mt-1">
              Score
            </span>
          </div>

          {/* Golf Stats Details (Strokes, Par, Time) */}
          <div className="w-full grid grid-cols-3 gap-2 my-2">
            <div className="ui-chip py-1.5 px-2 rounded-2xl flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#8a68a8] uppercase">Strokes</span>
              <span className="text-base font-black text-[#512185]">{strokes}</span>
            </div>
            <div className="ui-chip py-1.5 px-2 rounded-2xl flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#8a68a8] uppercase">Par</span>
              <span className="text-base font-black text-[#2ba93c]">{par}</span>
            </div>
            <div className="ui-chip py-1.5 px-2 rounded-2xl flex flex-col items-center">
              <span className="text-[10px] font-bold text-[#8a68a8] uppercase">Time</span>
              <span className="text-base font-black text-[#ed7c08]">{formattedSecs}</span>
            </div>
          </div>

          {/* Locked warning if level not unlocked */}
          {!isNextHoleUnlocked && (
            <div className="w-full mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold text-center">
              {starsEarned < 2
                ? 'Get at least 2★ to unlock the next level!'
                : (nextHoleLockReason || 'Need 3★ on all holes to unlock next chapter!')}
            </div>
          )}
        </div>

        {/* Footer: Side-by-Side "Retry" (Purple 3D) and "Next" (Orange 3D) */}
        <div className="ui-modal-footer w-full flex items-center justify-between gap-3 mt-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onRetry();
            }}
            className="btn-3d-purple flex-1 h-13 rounded-2xl text-xl text-white font-display font-bold cursor-pointer"
          >
            Retry
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              if (isNextHoleUnlocked) {
                onNextHole();
              } else if (starsEarned < 2) {
                onRetry();
              } else {
                onHolesMenu();
              }
            }}
            className="btn-3d-orange flex-1 h-13 rounded-2xl text-xl text-white font-display font-bold cursor-pointer"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
};
