import React, { useState } from 'react';
import { Home, ChevronLeft, ChevronRight, Star, Trophy, Lock } from 'lucide-react';
import {
  ALL_HOLES,
  GOLF_WORLDS,
  HoleCourse,
  isWorldUnlocked,
  isHoleUnlocked,
  getHoleLockReason,
} from '../data/courses';
import { CourseMiniPreview } from './CourseMiniPreview';
import { soundEngine } from '../audio/soundEngine';
import { Language, TRANSLATIONS } from '../data/i18n';

interface HolesSelectScreenProps {
  language: Language;
  selectedWorldIndex: number;
  holeStars: Record<number, number>;
  totalStars: number;
  onChangeWorld: (worldIndex: number) => void;
  onSelectHole: (hole: HoleCourse) => void;
  onOpenLeaderboard: (holeNumber: number) => void;
  onBackHome: () => void;
}

export const HolesSelectScreen: React.FC<HolesSelectScreenProps> = ({
  language,
  selectedWorldIndex,
  holeStars,
  totalStars,
  onChangeWorld,
  onSelectHole,
  onOpenLeaderboard,
  onBackHome,
}) => {
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);

  const t = TRANSLATIONS[language];
  const world = GOLF_WORLDS[selectedWorldIndex] || GOLF_WORLDS[0];
  const localizedWorld = t.worlds[world.index] || {
    name: world.name,
    subtitle: world.subtitle,
  };
  const worldHoles = ALL_HOLES.filter((h) => h.worldIndex === selectedWorldIndex);

  const worldUnlocked = isWorldUnlocked(selectedWorldIndex, holeStars);
  const finishedInWorld = worldHoles.filter((h) => (holeStars[h.holeNumber] || 0) > 0).length;
  const starsInWorld = worldHoles.reduce((acc, h) => acc + (holeStars[h.holeNumber] || 0), 0);
  const maxWorldStars = worldHoles.length * 3;

  const showLockedToast = (msg: string) => {
    soundEngine.playClick();
    setLockedNotice(msg);
    setTimeout(() => {
      setLockedNotice(null);
    }, 2800);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-between py-3 px-3.5 md:py-5 md:px-6 lg:py-6 lg:px-8 overflow-y-auto overflow-x-hidden relative">
      {/* Locked Notice Floating Toast */}
      {lockedNotice && (
        <div className="fixed top-20 z-50 px-4 py-2 bg-slate-900/95 text-white rounded-full text-xs md:text-sm font-extrabold shadow-2xl border-2 border-amber-400/60 animate-bounce flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{lockedNotice}</span>
        </div>
      )}

      {/* Top Navigation Header:
          - Mobile (< md): Compact 2-tier header
          - Tablet (md:) & PC (lg:): Single wide inline header matching Screenshot 4 */}
      <div className="w-full max-w-[430px] md:max-w-[680px] lg:max-w-[780px] flex flex-col items-center gap-2.5 shrink-0">
        {/* Header Bar */}
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-2.5 md:gap-3.5 lg:gap-4">
          {/* Mobile Top Row (Home | Stars | Trophy) - Hidden on Tablet & PC where they sit inline */}
          <div className="w-full flex md:hidden items-center justify-between">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onBackHome();
              }}
              className="btn-3d-blue w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 cursor-pointer"
              title={t.homeTooltip}
            >
              <Home className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="bg-white rounded-full px-4 py-1.5 flex items-center gap-1.5 shadow-[0_4px_0_rgba(143,192,235,0.65)]">
              <Star className="w-4 h-4 fill-[#ffc82c] text-[#d97706]" />
              <span className="font-extrabold text-[16px] text-[#163a5f] tabular-nums">
                {totalStars}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenLeaderboard(worldHoles[0]?.holeNumber || 1);
              }}
              className="btn-3d-yellow w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 cursor-pointer"
              title={t.top10LeaderboardsTitle}
            >
              <Trophy className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Tablet & PC Left Home Button */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onBackHome();
            }}
            className="hidden md:flex btn-3d-blue w-11 h-11 lg:w-12 lg:h-12 rounded-full items-center justify-center text-white shrink-0 cursor-pointer"
            title={t.homeTooltip}
          >
            <Home className="w-5 h-5 lg:w-6 lg:h-6 stroke-[2.5]" />
          </button>

          {/* World Selector Pill Bar (Full width on Mobile, Flex-1 Center on Tablet & PC) */}
          <div className="w-full md:flex-1 bg-white rounded-full px-2.5 py-1.5 md:px-3 md:py-1.5 lg:py-2 flex items-center justify-between shadow-[0_4px_0_rgba(143,192,235,0.65)] border-2 border-white">
            <button
              type="button"
              disabled={selectedWorldIndex === 0}
              onClick={() => {
                if (selectedWorldIndex > 0) {
                  soundEngine.playClick();
                  onChangeWorld(selectedWorldIndex - 1);
                }
              }}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                selectedWorldIndex === 0
                  ? 'bg-[#d8f3dc] text-white cursor-default'
                  : 'bg-[#37c84c] hover:bg-[#2eb842] active:scale-95 text-white shadow-xs'
              }`}
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />
            </button>

            <div className="text-center px-2 min-w-0">
              <div className="font-display font-bold text-[18px] md:text-[20px] lg:text-[21px] flex items-center justify-center gap-1.5 leading-tight truncate">
                {!worldUnlocked && <Lock className="w-4 h-4 text-amber-500 shrink-0" />}
                <span className={worldUnlocked ? 'text-[#2ecc71]' : 'text-slate-600'}>
                  {localizedWorld.name}
                </span>
              </div>
              <div className="text-[11px] md:text-[12px] font-bold text-[#3c5a78] leading-tight truncate">
                {worldUnlocked
                  ? `${starsInWorld}/${maxWorldStars}★ • ${localizedWorld.subtitle}`
                  : `🔒 Max out 3★ on all holes in previous chapter to unlock`}
              </div>
            </div>

            <button
              type="button"
              disabled={selectedWorldIndex === GOLF_WORLDS.length - 1}
              onClick={() => {
                if (selectedWorldIndex < GOLF_WORLDS.length - 1) {
                  soundEngine.playClick();
                  onChangeWorld(selectedWorldIndex + 1);
                }
              }}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                selectedWorldIndex === GOLF_WORLDS.length - 1
                  ? 'bg-[#d8f3dc] text-white cursor-default'
                  : 'bg-[#37c84c] hover:bg-[#2eb842] active:scale-95 text-white shadow-xs'
              }`}
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" />
            </button>
          </div>

          {/* Tablet & PC Right Stars Badge + Leaderboard Button */}
          <div className="hidden md:flex items-center gap-2 lg:gap-2.5 shrink-0">
            <div className="bg-white rounded-full px-3.5 py-1.5 lg:px-4 lg:py-2 flex items-center gap-1.5 shadow-[0_4px_0_rgba(143,192,235,0.65)]">
              <Star className="w-4 h-4 lg:w-5 lg:h-5 fill-[#ffc82c] text-[#d97706]" />
              <span className="font-extrabold text-[17px] lg:text-[18px] text-[#163a5f] tabular-nums">
                {totalStars}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenLeaderboard(worldHoles[0]?.holeNumber || 1);
              }}
              className="btn-3d-yellow w-11 h-11 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-white shrink-0 cursor-pointer"
              title={t.top10LeaderboardsTitle}
            >
              <Trophy className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* World Pagination Dots */}
        <div className="flex items-center justify-center gap-2 mt-0.5">
          {GOLF_WORLDS.map((w) => {
            const active = w.index === selectedWorldIndex;
            const wUnlocked = isWorldUnlocked(w.index, holeStars);
            const locW = t.worlds[w.index] || { name: w.name };
            return (
              <button
                key={w.index}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onChangeWorld(w.index);
                }}
                className={`h-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                  active
                    ? 'w-5 bg-[#37c84c]'
                    : wUnlocked
                    ? 'w-2.5 bg-[#8fc0eb] hover:bg-[#6faee5]'
                    : 'w-2.5 bg-slate-300 hover:bg-slate-400'
                }`}
                title={wUnlocked ? locW.name : `🔒 ${locW.name} (Locked)`}
                aria-label={locW.name}
              />
            );
          })}
        </div>
      </div>

      {/* Responsive Course Cards Grid:
          - Mobile (< md): 2x3 Grid (max-w-[430px])
          - Tablet (md:): 3x2 Grid (max-w-[680px])
          - PC (lg:): 3x2 Grid (max-w-[780px]) matching Screenshot 4 */}
      <div className="w-full max-w-[430px] md:max-w-[680px] lg:max-w-[780px] grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 lg:gap-5 my-auto py-2 md:py-3 lg:py-4">
        {worldHoles.map((hole) => {
          const stars = holeStars[hole.holeNumber] || 0;
          const displayIndex = ((hole.holeNumber - 1) % 6) + 1;
          const unlocked = isHoleUnlocked(hole.holeNumber, holeStars);
          const lockReason = getHoleLockReason(hole.holeNumber, holeStars);

          return (
            <div
              key={hole.holeNumber}
              onClick={() => {
                if (!unlocked) {
                  showLockedToast(lockReason || 'Locked');
                  return;
                }
                soundEngine.playClick();
                onSelectHole(hole);
              }}
              className={`group relative rounded-[18px] md:rounded-[20px] lg:rounded-[22px] p-2 pb-2.5 md:p-2.5 md:pb-3 transition-transform flex flex-col items-center ${
                unlocked
                  ? 'bg-white shadow-[0_5px_0_rgba(143,192,235,0.75)] hover:-translate-y-1 active:translate-y-0.5 cursor-pointer'
                  : 'bg-slate-100/95 shadow-[0_4px_0_rgba(180,195,210,0.5)] cursor-not-allowed border border-slate-200'
              }`}
            >
              {/* Top-Left Circular Hole Badge */}
              <div
                className={`absolute -top-2 -left-2 md:-top-2.5 md:-left-2.5 z-20 w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-white shadow-md flex items-center justify-center font-display font-bold text-white text-[15px] md:text-[16px] ${
                  unlocked ? 'bg-[#40c952]' : 'bg-slate-400'
                }`}
              >
                {unlocked ? displayIndex : <Lock className="w-3.5 h-3.5 stroke-[2.5]" />}
              </div>

              {/* Top-Down Course Preview Container */}
              <div
                className={`relative w-full aspect-[1/0.92] md:aspect-[1/1.02] lg:aspect-[1/1.05] rounded-xl md:rounded-2xl overflow-hidden ${
                  unlocked ? 'bg-[#6be33d]' : 'bg-[#5da341] grayscale-[50%]'
                }`}
              >
                {/* Top-Right Par Pill */}
                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 z-10 bg-white/95 rounded-full px-2 md:px-2.5 py-0.5 text-[11px] md:text-[12px] font-extrabold text-[#163a5f] shadow-xs">
                  {t.parNum(hole.par)}
                </div>

                <CourseMiniPreview course={hole} />

                {/* Locked Padlock Overlay */}
                {!unlocked && (
                  <div className="absolute inset-0 z-15 bg-slate-900/45 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center">
                    <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-900/85 border border-white/20 flex items-center justify-center text-amber-300 shadow-md mb-1">
                      <Lock className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] md:text-[11px] font-black text-white leading-tight drop-shadow px-1 max-w-[120px]">
                      {displayIndex === 1 && hole.holeNumber > 1
                        ? 'Max 3★ in prev chapter'
                        : `Need 2★ on Hole ${hole.holeNumber - 1}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Bar: 3 Stars Row + Mini Leaderboard Trophy Button */}
              <div className="w-full flex items-center justify-between px-1 mt-2 md:mt-2.5">
                <div className="w-5 md:w-6" />
                <div className="flex items-center justify-center gap-1 md:gap-1.5">
                  {[1, 2, 3].map((sIdx) => {
                    const earned = sIdx <= stars;
                    return (
                      <Star
                        key={sIdx}
                        className={`w-4 h-4 md:w-5 md:h-5 ${
                          earned
                            ? 'fill-[#ffc82c] text-[#d97706]'
                            : 'fill-[#ebf3fa] text-[#9ebede]'
                        }`}
                      />
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!unlocked) return;
                    soundEngine.playClick();
                    onOpenLeaderboard(hole.holeNumber);
                  }}
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border flex items-center justify-center ${
                    unlocked
                      ? 'bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-amber-200 text-[#d97706] cursor-pointer'
                      : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                  }`}
                  title={unlocked ? `${t.holeLabel(hole.holeNumber)} — ${t.top10LeaderboardsTitle}` : 'Locked'}
                >
                  <Trophy className="w-3 h-3 md:w-3.5 md:h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Progress Text */}
      <div className="text-[12px] md:text-[13px] lg:text-[14px] font-extrabold text-[#2c4c6b] shrink-0 pb-1 text-center">
        {worldUnlocked ? (
          <span>
            {t.holesFinishedInWorld(finishedInWorld, worldHoles.length)} •{' '}
            <span className={starsInWorld === maxWorldStars ? 'text-emerald-600' : 'text-[#2c4c6b]'}>
              {starsInWorld}/{maxWorldStars}★
            </span>
            {selectedWorldIndex < GOLF_WORLDS.length - 1 && starsInWorld < maxWorldStars && (
              <span className="text-amber-700 font-bold ml-1.5">
                (Max out {maxWorldStars}★ to unlock {GOLF_WORLDS[selectedWorldIndex + 1]?.name})
              </span>
            )}
          </span>
        ) : (
          <span className="text-rose-600 font-bold">
            🔒 Chapter Locked: Complete previous chapter with 3★ on all holes
          </span>
        )}
      </div>
    </div>
  );
};
