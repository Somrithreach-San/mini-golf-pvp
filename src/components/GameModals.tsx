import React, { useState, type CSSProperties, type ReactNode } from 'react';
import { Home, Music, Volume2, RotateCcw, Play, Grid, Star, Sparkles, Check, Lock } from 'lucide-react';
import { GOLF_BALL_SKINS, GolfBallSkin } from '../data/balls';
import { Language, TRANSLATIONS } from '../data/i18n';
import { soundEngine } from '../audio/soundEngine';
import { CornerHalftoneBackground, GoldStarSvg } from './UIKitShowcase';
import '../ui-kit.css';

// ==========================================
// 0. REUSABLE CARTOON MODAL SHELL (Vector Multi-Layer Kit)
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
  maxWidth = '420px',
  showClose = true,
}: GameModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/55 backdrop-blur-[3px] select-none"
      onClick={onClose}
    >
      <div
        className="kit-window"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Overlapping Purple Header Ribbon */}
        <div className={`kit-header-ribbon ${!showClose ? 'kit-header-ribbon--solo' : ''}`}>
          <span className="kit-header-title">{title}</span>
        </div>

        {/* Overlapping Close Button */}
        {showClose && (
          <button
            type="button"
            className="kit-close-btn"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 1 }}>
              <path
                d="M5 5l14 14M19 5L5 19"
                stroke="#f5edff"
                strokeWidth="5"
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 2.5px 0 #481487)' }}
              />
            </svg>
          </button>
        )}

        {/* Inner Canvas with Corner Halftone Bubbles */}
        <div className="kit-canvas">
          <CornerHalftoneBackground />
          <div className="kit-content">
            <div className="max-h-[75vh] max-h-[75dvh] overflow-y-auto overscroll-contain pr-1">
              {children}
            </div>
            {footer && <div className="mt-2">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 0.5 PAUSED MODAL
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
    <GameModal title="Paused" onClose={onResume} maxWidth="350px">
      <div className="flex items-center justify-center gap-4 py-4">
        {/* Coin 1: Home */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onHome();
          }}
          className="kit-round-btn kit-round-btn--gold"
          title="Home"
        >
          <Home className="w-7 h-7 relative z-10 stroke-[2.75]" />
        </button>

        {/* Coin 2: Retry */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onRetry();
          }}
          className="kit-round-btn kit-round-btn--gold"
          title="Restart Hole"
        >
          <RotateCcw className="w-7 h-7 relative z-10 stroke-[2.75]" />
        </button>

        {/* Coin 3: Play / Resume */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onResume();
          }}
          className="kit-round-btn kit-round-btn--gold"
          title="Resume"
        >
          <Play className="w-7 h-7 relative z-10 fill-current ml-0.5" />
        </button>
      </div>
    </GameModal>
  );
};

// ==========================================
// 1. SETTINGS MODAL
// ==========================================
interface SettingsModalProps {
  isOpen: boolean;
  language?: Language;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  onChangeLanguage?: (lang: Language) => void;
  onToggleMusic: (val: boolean) => void;
  onToggleSfx: (val: boolean) => void;
  onResetProgress?: () => void;
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
  language = 'en',
  musicEnabled,
  sfxEnabled,
  onChangeLanguage: _onChangeLanguage,
  onToggleMusic,
  onToggleSfx,
  onResetProgress: _onResetProgress,
  onClose,
}) => {
  const [musicVol, setMusicVol] = useState(80);
  const [sfxVol, setSfxVol] = useState(90);

  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  return (
    <GameModal
      title={t.settings}
      onClose={onClose}
    >
      <div className="space-y-4 py-1 text-[#54317c]">
        {/* Audio settings */}
        <div>
          <h3 className="font-display font-black text-sm text-[#7d35cd] mb-2 uppercase tracking-wider">
            Audio Settings
          </h3>
          <div className="space-y-3">
            {/* Music */}
            <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm">Sound music</span>
                <button
                  type="button"
                  className={`kit-toggle ${musicEnabled ? 'kit-toggle--amber' : 'kit-toggle--lavender'}`}
                  onClick={() => {
                    soundEngine.playClick();
                    onToggleMusic(!musicEnabled);
                  }}
                  role="switch"
                  aria-checked={musicEnabled}
                >
                  <span
                    className="kit-toggle-thumb"
                    style={{ left: musicEnabled ? '22px' : '0px' }}
                  />
                </button>
              </div>

              {/* Music Volume Slider */}
              <div className="kit-slider-wrap">
                <div className="kit-slider-groove">
                  <div className="kit-slider-track">
                    <div
                      className="kit-slider-fill"
                      style={{
                        width: musicEnabled && musicVol > 0 ? `calc(${musicVol}% * (100% - 32px) / 100 + 16px)` : '0%',
                      }}
                    />
                  </div>
                  <div
                    className="kit-slider-thumb"
                    style={{
                      left: musicEnabled ? `calc(${musicVol}% * (100% - 32px) / 100)` : '0px',
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={musicEnabled ? musicVol : 0}
                  disabled={!musicEnabled}
                  onChange={(e) => setMusicVol(Number(e.target.value))}
                  className="kit-slider-input"
                />
              </div>
            </div>

            {/* SFX */}
            <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm">Sound effect</span>
                <button
                  type="button"
                  className={`kit-toggle ${sfxEnabled ? 'kit-toggle--amber' : 'kit-toggle--lavender'}`}
                  onClick={() => {
                    soundEngine.playClick();
                    onToggleSfx(!sfxEnabled);
                  }}
                  role="switch"
                  aria-checked={sfxEnabled}
                >
                  <span
                    className="kit-toggle-thumb"
                    style={{ left: sfxEnabled ? '22px' : '0px' }}
                  />
                </button>
              </div>

              {/* SFX Volume Slider */}
              <div className="kit-slider-wrap">
                <div className="kit-slider-groove">
                  <div className="kit-slider-track">
                    <div
                      className="kit-slider-fill"
                      style={{
                        width: sfxEnabled && sfxVol > 0 ? `calc(${sfxVol}% * (100% - 32px) / 100 + 16px)` : '0%',
                      }}
                    />
                  </div>
                  <div
                    className="kit-slider-thumb"
                    style={{
                      left: sfxEnabled ? `calc(${sfxVol}% * (100% - 32px) / 100)` : '0px',
                    }}
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={sfxEnabled ? sfxVol : 0}
                  disabled={!sfxEnabled}
                  onChange={(e) => setSfxVol(Number(e.target.value))}
                  className="kit-slider-input"
                />
              </div>
            </div>
          </div>
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
      title={t.golfBalls}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3 py-1">
        {GOLF_BALL_SKINS.map((skin) => {
          const isSelected = skin.id === selectedBallId;
          const isUnlocked = totalStars >= skin.requiredStars;
          const localized = t.ballSkins[skin.id] || { name: skin.name, subtitle: skin.description };

          return (
            <div
              key={skin.id}
              onClick={() => {
                if (isUnlocked) {
                  soundEngine.playClick();
                  onSelectBall(skin);
                }
              }}
              className={`p-3 rounded-2xl bg-white/80 border-2 transition-all flex flex-col items-center text-center ${
                isSelected
                  ? 'border-[#fba919] shadow-[0_0_0_3px_rgba(251,169,25,0.35)]'
                  : 'border-[#d5c1ee]'
              } ${isUnlocked ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-60 cursor-not-allowed'}`}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-inner border-2 border-white mb-2"
                style={{ backgroundColor: skin.color }}
              >
                {skin.icon}
              </div>

              <div className="font-display font-black text-sm text-[#54317c] leading-tight">
                {localized.name}
              </div>

              <div className="text-[11px] font-semibold text-[#8a68a8] mt-1 line-clamp-1">
                {localized.subtitle || skin.description}
              </div>

              <div className="mt-2.5 w-full">
                {isSelected ? (
                  <div className="w-full py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-black flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Equipped</span>
                  </div>
                ) : isUnlocked ? (
                  <button
                    type="button"
                    className="kit-btn kit-btn--sm kit-btn--purple !h-8 w-full text-xs"
                  >
                    <span className="kit-btn-label">Select</span>
                  </button>
                ) : (
                  <div className="w-full py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center gap-1">
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
    >
      <div className="space-y-3 py-1">
        <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] flex items-start gap-3 shadow-xs">
          <span className="w-7 h-7 rounded-full bg-[#7d35cd] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-sm">
            1
          </span>
          <p className="text-xs text-[#54317c] font-semibold leading-relaxed">
            <strong className="text-[#7d35cd] font-bold">{t.helpStep1Bold}</strong> {t.helpStep1Text}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] flex items-start gap-3 shadow-xs">
          <span className="w-7 h-7 rounded-full bg-[#2ed13c] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-sm">
            2
          </span>
          <p className="text-xs text-[#54317c] font-semibold leading-relaxed">
            <strong className="text-[#2ed13c] font-bold">{t.helpStep2Bold}</strong> {t.helpStep2Text}
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] flex items-start gap-3 shadow-xs">
          <span className="w-7 h-7 rounded-full bg-[#fba919] text-white font-black flex items-center justify-center shrink-0 text-sm shadow-sm">
            3
          </span>
          <p className="text-xs text-[#54317c] font-semibold leading-relaxed">
            <strong className="text-[#fba919] font-bold">{t.helpStep3Bold}</strong> {t.helpStep3Text}
          </p>
        </div>
      </div>
    </GameModal>
  );
};

// ==========================================
// 4. HOLE COMPLETE VICTORY MODAL (Preserves all user data & logic)
// ==========================================
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

  let bannerTitle = t.holeComplete;
  if (strokes === 1) bannerTitle = t.holeInOne;
  else if (strokes < par) bannerTitle = t.birdie;
  else if (strokes === par) bannerTitle = t.parBanner;

  const totalSeconds = Math.max(1, Math.floor(Math.max(0, timeMs) / 1000));
  const formattedSecs = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(
    totalSeconds % 60
  ).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/55 backdrop-blur-[3px] select-none">
      <div
        className="kit-window text-center"
        style={{ maxWidth: '420px' }}
        role="dialog"
        aria-modal="true"
        aria-label={bannerTitle}
      >
        {/* Overlapping Title Ribbon */}
        <div className="kit-header-ribbon">
          <span className="kit-header-title">{bannerTitle}</span>
        </div>

        {/* Close Button '✕' */}
        <button
          type="button"
          className="kit-close-btn"
          aria-label="Close"
          onClick={onHome}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" style={{ position: 'relative', zIndex: 1 }}>
            <path
              d="M5 5l14 14M19 5L5 19"
              stroke="#f5edff"
              strokeWidth="5"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 2.5px 0 #481487)' }}
            />
          </svg>
        </button>

        <div className="kit-canvas">
          <CornerHalftoneBackground />
          <div className="kit-content items-center">
            {/* Hole Label */}
            <div className="text-xs font-black uppercase tracking-wider text-[#7d35cd] mt-1">
              {t.holeLabel(holeNumber)}
            </div>

            {/* Top 10 Record Badge if achieved */}
            {bestRank !== null && (
              <div className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black px-3.5 py-1 rounded-full shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>{t.top10Record(bestRank)}</span>
              </div>
            )}

            {/* 3 Plump 3D Golden Stars */}
            <div className="flex items-center justify-center gap-2.5 my-2 h-[80px]">
              <div style={{ transform: 'translateY(6px) rotate(-12deg)' }}>
                <GoldStarSvg size={64} unearned={starsEarned < 1} />
              </div>
              <div style={{ transform: 'translateY(-6px) scale(1.2)' }}>
                <GoldStarSvg size={68} unearned={starsEarned < 2} />
              </div>
              <div style={{ transform: 'translateY(6px) rotate(12deg)' }}>
                <GoldStarSvg size={64} unearned={starsEarned < 3} />
              </div>
            </div>

            {/* Player Performance Stats Row */}
            <div className="grid grid-cols-3 gap-2 w-full my-1">
              <div className="p-2 rounded-2xl bg-white/80 border border-[#d5c1ee] flex flex-col items-center">
                <span className="text-[10px] font-bold text-[#8a68a8] uppercase">{t.strokes}</span>
                <span className="text-xl font-black text-[#54317c]">{strokes}</span>
              </div>
              <div className="p-2 rounded-2xl bg-white/80 border border-[#d5c1ee] flex flex-col items-center">
                <span className="text-[10px] font-bold text-[#8a68a8] uppercase">{t.par}</span>
                <span className="text-xl font-black text-[#2ed13c]">{par}</span>
              </div>
              <div className="p-2 rounded-2xl bg-white/80 border border-[#d5c1ee] flex flex-col items-center">
                <span className="text-[10px] font-bold text-[#8a68a8] uppercase">{t.time}</span>
                <span className="text-lg font-black text-[#ee8406]">{formattedSecs}</span>
              </div>
            </div>

            {/* Next Hole Locked Notice */}
            {!isNextHoleUnlocked && (
              <div className="w-full p-2 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center justify-center gap-2 text-amber-900 text-xs font-black text-center">
                <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                <span>
                  {starsEarned < 2
                    ? 'Get at least 2★ to unlock the next level!'
                    : (nextHoleLockReason || 'Chapter locked: Max out 3★ on all holes!')}
                </span>
              </div>
            )}

            {/* Action Buttons: Home | Holes Menu | Retry | Next Hole */}
            <div className="flex items-center justify-center gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onHome();
                }}
                className="kit-btn kit-btn--md kit-btn--blue !w-13 !h-13 !p-0"
                title={t.homeTooltip}
              >
                <span className="kit-btn-label">
                  <Home className="w-5 h-5 stroke-[2.5]" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onHolesMenu();
                }}
                className="kit-btn kit-btn--md kit-btn--purple !w-13 !h-13 !p-0"
                title={t.holesMenuTooltip}
              >
                <span className="kit-btn-label">
                  <Grid className="w-5 h-5 stroke-[2.5]" />
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onRetry();
                }}
                className="kit-btn kit-btn--md kit-btn--red !w-13 !h-13 !p-0"
                title={t.retryTooltip}
              >
                <span className="kit-btn-label">
                  <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                </span>
              </button>

              {isNextHoleUnlocked ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onNextHole();
                  }}
                  className="kit-btn kit-btn--md kit-btn--gold flex-1 !h-13"
                >
                  <span className="kit-btn-label">
                    <span>{t.nextHole}</span>
                    <Play className="w-4 h-4 fill-white shrink-0" />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    if (starsEarned < 2) {
                      onRetry();
                    } else {
                      onHolesMenu();
                    }
                  }}
                  className="kit-btn kit-btn--md kit-btn--gold flex-1 !h-13"
                >
                  <span className="kit-btn-label">
                    {starsEarned < 2 ? (
                      <>
                        <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                        <span>Retry for 2★</span>
                      </>
                    ) : (
                      <>
                        <Grid className="w-4 h-4 stroke-[2.5]" />
                        <span>Select Holes</span>
                      </>
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
