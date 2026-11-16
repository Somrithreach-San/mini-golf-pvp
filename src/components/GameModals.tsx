import React, { useEffect, useRef } from 'react';
import { Home, Music, Volume2, Globe, RotateCcw, Play, Grid, Star, Sparkles, Check, Lock, Database, Cloud } from 'lucide-react';
import { GOLF_BALL_SKINS, GolfBallSkin } from '../data/balls';
import { TOTAL_GAME_STARS } from '../data/courses';
import { Language, TRANSLATIONS } from '../data/i18n';
import { soundEngine } from '../audio/soundEngine';

// ==========================================
// 1. SETTINGS MODAL (Mobile Optimized)
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
  syncStatus,
  onManualSync,
  onOpenAccount,
}) => {
  const [confirmReset, setConfirmReset] = React.useState(false);

  if (!isOpen) return null;

  const t = TRANSLATIONS[language];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3.5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-[385px] px-6 pt-5 pb-5 shadow-[0_12px_0_rgba(0,0,0,0.14),0_20px_40px_rgba(0,0,0,0.28)] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[30px] font-bold text-[#2ecc71] text-center mb-3.5 tracking-tight">
          {t.settings}
        </h2>

        {/* Music Row */}
        <div className="flex items-center justify-between py-3 border-b-2 border-dashed border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7c3aed] flex items-center justify-center text-white shadow-xs">
              <Music className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[18px] font-extrabold text-[#163a5f]">{t.music}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onToggleMusic(!musicEnabled);
            }}
            className={`w-[62px] h-[34px] rounded-full p-1 transition-colors duration-200 flex items-center cursor-pointer ${
              musicEnabled ? 'bg-[#37d062]' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-[26px] h-[26px] rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                musicEnabled ? 'translate-x-[28px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Sound Effects Row */}
        <div className="flex items-center justify-between py-3 border-b-2 border-dashed border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7c3aed] flex items-center justify-center text-white shadow-xs">
              <Volume2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[18px] font-extrabold text-[#163a5f]">{t.soundEffects}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onToggleSfx(!sfxEnabled);
              soundEngine.playClick();
            }}
            className={`w-[62px] h-[34px] rounded-full p-1 transition-colors duration-200 flex items-center cursor-pointer ${
              sfxEnabled ? 'bg-[#37d062]' : 'bg-slate-300'
            }`}
          >
            <div
              className={`w-[26px] h-[26px] rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                sfxEnabled ? 'translate-x-[28px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Language Row (English | 中文) */}
        <div className="flex items-center justify-between py-3 border-b-2 border-dashed border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7c3aed] flex items-center justify-center text-white shadow-xs">
              <Globe className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="text-[18px] font-extrabold text-[#163a5f]">{t.language}</span>
          </div>
          <div className="inline-flex bg-slate-100 p-1 rounded-full border border-slate-200">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onChangeLanguage('en');
              }}
              className={`px-3 py-1 rounded-full text-[13px] font-extrabold transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-[#37d062] text-white shadow-xs'
                  : 'text-[#163a5f] hover:text-[#2ecc71]'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onChangeLanguage('zh');
              }}
              className={`px-3 py-1 rounded-full text-[13px] font-extrabold transition-all cursor-pointer ${
                language === 'zh'
                  ? 'bg-[#37d062] text-white shadow-xs'
                  : 'text-[#163a5f] hover:text-[#2ecc71]'
              }`}
            >
              中文
            </button>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-center gap-3 mt-5 mb-3">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setConfirmReset(true);
              }}
              className="btn-3d-red rounded-full px-5 py-2.5 text-white font-display font-bold text-[16px] tracking-wide whitespace-nowrap cursor-pointer"
            >
              {t.resetProgress}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onResetProgress();
                setConfirmReset(false);
                onClose();
              }}
              className="btn-3d-red rounded-full px-5 py-2.5 text-white font-display font-bold text-[15px] tracking-wide whitespace-nowrap cursor-pointer"
            >
              {t.confirmReset}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              setConfirmReset(false);
              onClose();
            }}
            className="btn-3d-green rounded-full px-7 py-2.5 text-white font-display font-bold text-[18px] tracking-wide whitespace-nowrap cursor-pointer"
          >
            {t.done}
          </button>
        </div>

        <div className="w-full flex items-center justify-center mt-2">
          <span className="text-center text-[#70889e] font-semibold text-[13px] tracking-wide">
            v1.0.1
          </span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. BALL SKIN PREVIEW ICON & BALLS MODAL (Authentic 3D Rendered Badges)
// ==========================================
const BallPreviewBadge: React.FC<{ skin: GolfBallSkin }> = ({ skin }) => {
  return (
    <div className="w-12 h-12 relative flex items-center justify-center filter drop-shadow-[0_4px_7px_rgba(0,0,0,0.22)]">
      <img
        src={skin.iconUrl}
        alt={skin.name}
        className="w-12 h-12 object-contain transition-transform duration-200 group-hover:scale-105 select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
};

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-[395px] p-5 shadow-[0_12px_0_rgba(0,0,0,0.14),0_20px_40px_rgba(0,0,0,0.28)] max-h-[86dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="font-display text-[26px] font-bold text-[#14b8a6]">
            {t.golfBalls}
          </h2>
          <div className="flex items-center gap-1.5 bg-amber-50 border-2 border-amber-200 px-3 py-1 rounded-full">
            <Star className="w-4 h-4 fill-[#ffb800] text-[#d97706]" />
            <span className="font-extrabold text-[#163a5f] text-sm tabular-nums">
              {totalStars} / {TOTAL_GAME_STARS}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 overflow-y-auto pr-0.5 py-1">
          {GOLF_BALL_SKINS.map((skin) => {
            const unlocked = totalStars >= skin.requiredStars;
            const isSelected = skin.id === selectedBallId;
            const skinLoc = t.ballSkins[skin.id] || { name: skin.name, subtitle: skin.subtitle };
            return (
              <button
                key={skin.id}
                type="button"
                disabled={!unlocked}
                onClick={() => {
                  if (unlocked) {
                    soundEngine.playClick();
                    onSelectBall(skin);
                  }
                }}
                className={`relative rounded-2xl p-2.5 border-2 flex flex-col items-center text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#2ecc71] bg-[#f0fdf4] shadow-sm'
                    : unlocked
                    ? 'border-slate-200 bg-slate-50/70 active:scale-95'
                    : 'border-slate-200 bg-slate-100 opacity-65 cursor-not-allowed'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2ecc71] text-white flex items-center justify-center shadow-xs">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
                {!unlocked && (
                  <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" /> {skin.requiredStars}★
                  </span>
                )}
                <BallPreviewBadge skin={skin} />
                <span className="font-display font-bold text-[#163a5f] text-xs sm:text-[13px] mt-1.5 leading-tight">
                  {skinLoc.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center mt-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="btn-3d-green rounded-full px-9 py-2.5 text-white font-display font-bold text-[18px] cursor-pointer"
          >
            {t.done}
          </button>
        </div>
      </div>
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3.5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-[385px] p-5 shadow-[0_12px_0_rgba(0,0,0,0.14),0_20px_40px_rgba(0,0,0,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-[28px] font-bold text-[#2f80ed] text-center mb-3.5">
          {t.howToPlay}
        </h2>

        <div className="space-y-2.5 text-[#163a5f] text-[13px] font-semibold">
          <div className="flex items-start gap-2.5 bg-sky-50 p-3 rounded-2xl">
            <span className="w-6 h-6 rounded-full bg-[#2f80ed] text-white font-bold flex items-center justify-center shrink-0 text-xs">
              1
            </span>
            <p>
              <strong>{t.helpStep1Bold}</strong> {t.helpStep1Text}
            </p>
          </div>
          <div className="flex items-start gap-2.5 bg-emerald-50 p-3 rounded-2xl">
            <span className="w-6 h-6 rounded-full bg-[#2ecc71] text-white font-bold flex items-center justify-center shrink-0 text-xs">
              2
            </span>
            <p>
              <strong>{t.helpStep2Bold}</strong> {t.helpStep2Text}
            </p>
          </div>
          <div className="flex items-start gap-2.5 bg-amber-50 p-3 rounded-2xl">
            <span className="w-6 h-6 rounded-full bg-[#f59f00] text-white font-bold flex items-center justify-center shrink-0 text-xs">
              3
            </span>
            <p>
              <strong>{t.helpStep3Bold}</strong> {t.helpStep3Text}
            </p>
          </div>
        </div>

        <div className="flex justify-center mt-5">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="btn-3d-green rounded-full px-9 py-2.5 text-white font-display font-bold text-[18px] cursor-pointer"
          >
            {t.gotIt}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 5. HOLE COMPLETE VICTORY MODAL & MAGICAL STAR ANIMATION
// ==========================================

/**
 * Generates a smooth, rounded chubby 5-point star SVG path using quadratic bezier corner rounding
 */
function buildRoundedStarPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  roundness = 0.34
): string {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }

  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];

    const startX = curr.x + (prev.x - curr.x) * roundness;
    const startY = curr.y + (prev.y - curr.y) * roundness;
    const endX = curr.x + (next.x - curr.x) * roundness;
    const endY = curr.y + (next.y - curr.y) * roundness;

    if (i === 0) {
      d += `M ${startX.toFixed(2)} ${startY.toFixed(2)} `;
    } else {
      d += `L ${startX.toFixed(2)} ${startY.toFixed(2)} `;
    }
    d += `Q ${curr.x.toFixed(2)} ${curr.y.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)} `;
  }
  d += 'Z';
  return d;
}

const OUTER_CRYSTAL_STAR_PATH = buildRoundedStarPath(60, 60, 52, 33, 0.36);
const MID_CRYSTAL_BEVEL_PATH = buildRoundedStarPath(60, 60, 46, 29, 0.35);
const INNER_STAR_PATH = buildRoundedStarPath(60, 60, 35, 22, 0.36);
const SWIRL_STAR_PATH = buildRoundedStarPath(60, 60, 17, 10, 0.38);

const SPARKLE_RAYS: { tx: string; ty: string; color: string; size: number }[] = [
  { tx: '0px', ty: '-46px', color: '#ff85e4', size: 6 },
  { tx: '42px', ty: '-22px', color: '#72efdd', size: 5.5 },
  { tx: '36px', ty: '32px', color: '#ffd43b', size: 6 },
  { tx: '-36px', ty: '32px', color: '#72efdd', size: 5.5 },
  { tx: '-42px', ty: '-22px', color: '#ff85e4', size: 6 },
  { tx: '22px', ty: '-40px', color: '#ffffff', size: 4.5 },
  { tx: '-22px', ty: '-40px', color: '#ffd43b', size: 4.5 },
];

const AnimatedVictoryStars: React.FC<{ starsEarned: number }> = ({ starsEarned }) => {
  // ignitedCount tracks how many earned stars have popped their crystal outer halo (0..starsEarned)
  const [ignitedCount, setIgnitedCount] = React.useState(0);

  useEffect(() => {
    setIgnitedCount(0);
    const timers: number[] = [];

    for (let i = 0; i < starsEarned; i++) {
      const t = window.setTimeout(() => {
        setIgnitedCount(i + 1);
        soundEngine.playStarPop(i);
      }, 420 + i * 270);
      timers.push(t);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [starsEarned]);

  const archConfigs = [
    { idx: 0, wrapperClass: 'translate-y-2 -rotate-[9deg]', riseDelay: '40ms', idleDelay: '0s' },
    { idx: 1, wrapperClass: '-translate-y-2 scale-110 rotate-0', riseDelay: '135ms', idleDelay: '0.35s' },
    { idx: 2, wrapperClass: 'translate-y-2 rotate-[9deg]', riseDelay: '230ms', idleDelay: '0.7s' },
  ];

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 my-3.5 h-[98px] select-none">
      {archConfigs.map(({ idx, wrapperClass, riseDelay, idleDelay }) => {
        const isEarned = idx < starsEarned;
        const isIgnited = isEarned && idx < ignitedCount;
        const gradSuffix = `star-${idx}`;

        return (
          <div key={idx} className={`relative w-[86px] h-[86px] flex items-center justify-center ${wrapperClass}`}>
            {/* Stage 1: Base Star Elastic Rise */}
            <div
              className="relative w-full h-full flex items-center justify-center animate-star-base-rise"
              style={{ animationDelay: riseDelay }}
            >
              {/* Stage 3: Gentle Continuous Idle Bob once ignited */}
              <div
                className={`relative w-full h-full flex items-center justify-center ${
                  isIgnited ? 'animate-star-idle' : ''
                }`}
                style={{ animationDelay: idleDelay }}
              >
                {/* Radial Sparkle Burst when Crystal Halo ignites */}
                {isIgnited &&
                  SPARKLE_RAYS.map((sp, sIdx) => (
                    <span
                      key={sIdx}
                      className="pointer-events-none absolute rounded-full"
                      style={
                        {
                          width: `${sp.size}px`,
                          height: `${sp.size}px`,
                          backgroundColor: sp.color,
                          boxShadow: `0 0 8px ${sp.color}`,
                          '--tx': sp.tx,
                          '--ty': sp.ty,
                          animation: 'starSparkleRay 0.62s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                        } as React.CSSProperties
                      }
                    />
                  ))}

                <svg
                  viewBox="0 0 120 120"
                  className="w-full h-full overflow-visible"
                  style={{
                    filter: isIgnited
                      ? 'drop-shadow(0 6px 14px rgba(108, 62, 232, 0.45))'
                      : 'drop-shadow(0 4px 8px rgba(230, 140, 20, 0.25))',
                  }}
                >
                  <defs>
                    {/* Outer Iridescent Crystal Halo Gradient (Deep Cosmic Indigo -> Violet -> Cyan -> Magenta) */}
                    <linearGradient id={`crystal-body-${gradSuffix}`} x1="15%" y1="10%" x2="85%" y2="92%">
                      <stop offset="0%" stopColor="#6ee7f9" />
                      <stop offset="28%" stopColor="#5e43d8" />
                      <stop offset="68%" stopColor="#2e186a" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>

                    <linearGradient id={`crystal-bevel-${gradSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.88" />
                      <stop offset="50%" stopColor="#3b1d8f" stopOpacity="0.92" />
                      <stop offset="100%" stopColor="#e879f9" stopOpacity="0.88" />
                    </linearGradient>

                    {/* Ignited Inner Star Gradient (Creamy Yellow -> Warm Peach -> Candy Pink, matching Sarah Carmody reference) */}
                    <linearGradient id={`inner-ignited-${gradSuffix}`} x1="25%" y1="8%" x2="82%" y2="95%">
                      <stop offset="0%" stopColor="#fff7ad" />
                      <stop offset="48%" stopColor="#ffca4b" />
                      <stop offset="82%" stopColor="#ff85a1" />
                      <stop offset="100%" stopColor="#ff5ce1" />
                    </linearGradient>

                    {/* Base / Pre-Ignited Chubby Golden Star Gradient */}
                    <linearGradient id={`inner-base-${gradSuffix}`} x1="25%" y1="8%" x2="80%" y2="95%">
                      <stop offset="0%" stopColor="#ffef8a" />
                      <stop offset="55%" stopColor="#ffba3b" />
                      <stop offset="100%" stopColor="#f27a24" />
                    </linearGradient>

                    {/* Unearned Soft Golden-Lavender Slot Gradient */}
                    <linearGradient id={`inner-unearned-${gradSuffix}`} x1="25%" y1="8%" x2="80%" y2="95%">
                      <stop offset="0%" stopColor="#e8f0fa" />
                      <stop offset="100%" stopColor="#c3d5eb" />
                    </linearGradient>
                  </defs>

                  {/* ==========================================================
                      OUTER MAGICAL CRYSTAL STAR HALO (Pops on Earned Stars!)
                  ========================================================== */}
                  {isIgnited && (
                    <g
                      className=" origin-[60px_60px] animate-star-crystal-pop"
                      style={{ transformOrigin: '60px 60px' }}
                    >
                      {/* Outer Crystal Body with Soft Lavender-White Rim */}
                      <path
                        d={OUTER_CRYSTAL_STAR_PATH}
                        fill={`url(#crystal-body-${gradSuffix})`}
                        stroke="#c4b5fd"
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                      />

                      {/* Inner Faceted Crystal Bevel */}
                      <path
                        d={MID_CRYSTAL_BEVEL_PATH}
                        fill={`url(#crystal-bevel-${gradSuffix})`}
                        stroke="#7dd3fc"
                        strokeWidth="1.2"
                        strokeOpacity="0.7"
                        strokeLinejoin="round"
                      />

                      {/* Glossy Pink & Cyan Light Bubbles inside the 5 Crystal Tips (Exact match to reference!) */}
                      {/* Top tip pink & white bubbles */}
                      <ellipse
                        cx="59"
                        cy="18.5"
                        rx="4.6"
                        ry="3.6"
                        transform="rotate(-12 59 18.5)"
                        fill="#ff85e4"
                        opacity="0.92"
                      />
                      <circle cx="53.5" cy="24" r="2.1" fill="#a5f3fc" opacity="0.9" />
                      <circle cx="65" cy="24" r="1.5" fill="#ffffff" opacity="0.85" />

                      {/* Left tip cyan highlight arc & bubble */}
                      <ellipse
                        cx="20.5"
                        cy="46.5"
                        rx="4.5"
                        ry="2.6"
                        transform="rotate(-35 20.5 46.5)"
                        fill="#67e8f9"
                        opacity="0.88"
                      />
                      <circle cx="24" cy="53" r="1.8" fill="#f472b6" opacity="0.85" />

                      {/* Right tip magenta & cyan bubbles */}
                      <circle cx="99.5" cy="46.5" r="2.8" fill="#e879f9" opacity="0.85" />
                      <circle cx="95.5" cy="52.5" r="1.7" fill="#ffffff" opacity="0.85" />

                      {/* Bottom-Right tip glowing pink & white droplets */}
                      <ellipse
                        cx="84.5"
                        cy="92"
                        rx="4.4"
                        ry="3.4"
                        transform="rotate(28 84.5 92)"
                        fill="#ff99e8"
                        opacity="0.92"
                      />
                      <circle cx="88" cy="84.5" r="2.0" fill="#ffffff" opacity="0.9" />

                      {/* Bottom-Left tip cyan sheen */}
                      <ellipse
                        cx="35"
                        cy="91.5"
                        rx="4.2"
                        ry="2.5"
                        transform="rotate(-28 35 91.5)"
                        fill="#7dd3fc"
                        opacity="0.82"
                      />
                    </g>
                  )}

                  {/* ==========================================================
                      INNER CHUBBY 5-POINT STAR (Golden -> Sunset Pink-Gold)
                  ========================================================== */}
                  <g
                    key={isIgnited ? 'ignited-core' : 'base-core'}
                    className={isIgnited ? 'animate-star-inner-pop' : ''}
                    style={{ transformOrigin: '60px 60px' }}
                  >
                    <path
                      d={INNER_STAR_PATH}
                      fill={
                        isIgnited
                          ? `url(#inner-ignited-${gradSuffix})`
                          : isEarned
                          ? `url(#inner-base-${gradSuffix})`
                          : `url(#inner-unearned-${gradSuffix})`
                      }
                      stroke="#ffffff"
                      strokeWidth="3.2"
                      strokeLinejoin="round"
                    />

                    {/* Glossy Top-Left Specular Shine Droplets on the Inner Star */}
                    <ellipse
                      cx="56.5"
                      cy="35.5"
                      rx="2.8"
                      ry="1.9"
                      transform="rotate(-32 56.5 35.5)"
                      fill="#ffffff"
                      opacity="0.95"
                    />
                    <circle cx="52.5" cy="40.2" r="1.4" fill="#ffffff" opacity="0.9" />

                    {/* Pink Swirl Flash at the moment of Ignition */}
                    {isIgnited && (
                      <path
                        d={SWIRL_STAR_PATH}
                        fill="#ff78d4"
                        opacity="0.85"
                        className="animate-star-swirl"
                        style={{ transformOrigin: '60px 60px' }}
                      />
                    )}
                  </g>
                </svg>
              </div>
            </div>
          </div>
        );
      })}
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

  let bannerTitle = t.holeComplete;
  if (strokes === 1) bannerTitle = t.holeInOne;
  else if (strokes < par) bannerTitle = t.birdie;
  else if (strokes === par) bannerTitle = t.parBanner;

  const totalSeconds = Math.max(1, Math.floor(Math.max(0, timeMs) / 1000));
  const formattedSecs = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(
    totalSeconds % 60
  ).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3.5">
      <div className="bg-white rounded-[28px] w-full max-w-[390px] p-5 text-center shadow-[0_12px_0_rgba(0,0,0,0.14),0_20px_40px_rgba(0,0,0,0.28)] animate-in fade-in zoom-in-95 duration-150">
        <div className="text-xs font-extrabold uppercase tracking-wider text-[#2ecc71]">
          {t.holeLabel(holeNumber)}
        </div>
        <h2 className="font-display text-[32px] font-bold text-[#163a5f] mt-0.5 leading-tight">
          {bannerTitle}
        </h2>

        {bestRank !== null && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-extrabold px-3 py-0.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            {t.top10Record(bestRank)}
          </div>
        )}

        {/* 3 Animated Magical Crystal & Sunset-Gold Victory Stars */}
        <AnimatedVictoryStars starsEarned={starsEarned} />

        {/* Strokes, Par & Time Pills */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl px-2 py-2">
            <div className="text-[11px] font-bold text-slate-500">{t.strokes}</div>
            <div className="text-xl font-black text-[#163a5f] tabular-nums">{strokes}</div>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-2 py-2">
            <div className="text-[11px] font-bold text-slate-500">{t.par}</div>
            <div className="text-xl font-black text-[#2ecc71] tabular-nums">{par}</div>
          </div>
          <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl px-2 py-2">
            <div className="text-[11px] font-bold text-slate-500">{t.time}</div>
            <div className="text-lg font-black text-[#d97706] tabular-nums leading-7">
              {formattedSecs}
            </div>
          </div>
        </div>

        {/* Next Hole Locked Notice */}
        {!isNextHoleUnlocked && (
          <div className="mt-3.5 py-2 px-3 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-center justify-center gap-2 text-amber-800 text-xs font-extrabold text-center">
            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>
              {starsEarned < 2
                ? 'Get at least 2★ to unlock the next level!'
                : (nextHoleLockReason || 'Chapter locked: Max out 3★ on all holes!')}
            </span>
          </div>
        )}

        {/* Action Buttons: Home | Holes Menu | Retry | Next Hole */}
        <div className="flex items-center justify-center gap-2 w-full mt-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onHome();
            }}
            className="btn-3d-blue w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 cursor-pointer"
            title={t.homeTooltip}
          >
            <Home className="w-5 h-5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onHolesMenu();
            }}
            className="btn-3d-orange w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 cursor-pointer"
            title={t.holesMenuTooltip}
          >
            <Grid className="w-5 h-5 stroke-[2.5]" />
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onRetry();
            }}
            className="btn-3d-red w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 cursor-pointer"
            title={t.retryTooltip}
          >
            <RotateCcw className="w-5 h-5 stroke-[2.5]" />
          </button>

          {isNextHoleUnlocked ? (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onNextHole();
              }}
              className="btn-3d-green flex-1 h-12 rounded-full px-5 text-white font-display font-bold text-[17px] flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.nextHole}</span>
              <Play className="w-4 h-4 fill-white shrink-0" />
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
              className="btn-3d-yellow flex-1 h-12 rounded-full px-3 text-white font-display font-bold text-[14px] md:text-[15px] flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-md"
            >
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
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
