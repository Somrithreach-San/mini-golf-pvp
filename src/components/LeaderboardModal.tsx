import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Star,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { LeaderboardEntry } from '../data/leaderboard';
import { soundEngine } from '../audio/soundEngine';
import { Language, TRANSLATIONS } from '../data/i18n';
import { UserAvatar } from './UserAvatar';
import { getSavedAvatarSeed } from '../data/userProfile';
import { firebaseSync, GlobalStarRankingUser } from '../services/firebaseSync';
import { GameModal } from './GameModals';

export interface LeaderboardModalProps {
  isOpen: boolean;
  language: Language;
  initialHoleNumber?: number;
  leaderboards?: Record<number, LeaderboardEntry[]>;
  playerName: string;
  avatarSeed?: string;
  totalStars?: number;
  highlightEntryId?: string | null;
  onChangePlayerName: (name: string) => void;
  onPlayHole?: (holeNumber: number) => void;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  language,
  playerName,
  avatarSeed,
  totalStars = 0,
  onChangePlayerName,
  onClose,
}) => {
  const t = TRANSLATIONS[language];
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(playerName);
  const [globalRankings, setGlobalRankings] = useState<GlobalStarRankingUser[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);

  useEffect(() => {
    setNameDraft(playerName);
  }, [playerName]);

  // Fetch registered players ranked by total stars
  useEffect(() => {
    if (isOpen) {
      setIsLoadingGlobal(true);
      firebaseSync.fetchGlobalStarRankings().then((users) => {
        setIsLoadingGlobal(false);
        const effectiveAvatar = avatarSeed || getSavedAvatarSeed();

        // Ensure current player is included in the ranking
        const hasCurrent = users.some((u) => u.isCurrentUser);
        if (!hasCurrent) {
          const currentEntry: GlobalStarRankingUser = {
            uid: 'current_user',
            displayName: playerName || 'You',
            avatarSeed: effectiveAvatar,
            totalStars: totalStars,
            currentHole: 1,
            isCurrentUser: true,
          };
          const merged = [...users, currentEntry];
          merged.sort((a, b) => b.totalStars - a.totalStars);
          setGlobalRankings(merged);
        } else {
          setGlobalRankings(users);
        }
      });
    }
  }, [isOpen, playerName, avatarSeed, totalStars]);

  if (!isOpen) return null;

  const commitName = () => {
    const trimmed = nameDraft.trim() || 'Golfer';
    setNameDraft(trimmed);
    onChangePlayerName(trimmed);
    setEditingName(false);
  };

  return (
    <GameModal
      title="Leaderboards"
      onClose={onClose}
      maxWidth="480px"
    >
      {/* Subheader info & Golfer Name Pill */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[12px] font-extrabold text-amber-600 flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 inline" /> Ranked by Most Stars
        </p>

        {/* Golfer Name Pill */}
        <div className="ui-chip rounded-full pl-1.5 pr-2.5 py-0.5 flex items-center gap-1.5 shrink-0">
          <UserAvatar seed={avatarSeed || getSavedAvatarSeed()} size={20} showBorder={false} />
          {editingName ? (
            <input
              type="text"
              value={nameDraft}
              maxLength={14}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName();
              }}
              className="w-20 text-[11px] font-extrabold text-[#51336d] bg-white px-1.5 py-0.5 rounded border border-purple-300 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-[11px] font-extrabold text-[#51336d] cursor-pointer max-w-[85px] truncate"
              title={t.editGolferNameTooltip}
            >
              {playerName} ✎
            </button>
          )}
        </div>
      </div>

      {/* Global Rankings Table */}
      <div className="overflow-y-auto border-2 border-[#e6d9f0] rounded-2xl bg-white/70">
        {isLoadingGlobal ? (
          <div className="h-56 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs font-bold text-[#51336d]">Loading Star Rankings…</span>
          </div>
        ) : globalRankings.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-1 text-slate-400">
            <Star className="w-8 h-8 text-amber-300" />
            <span className="text-xs font-bold text-[#51336d]">No star rankings recorded yet</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#f7f1fc] text-[10px] font-extrabold uppercase tracking-wider text-[#7d36c8] border-b-2 border-[#e6d9f0] z-10">
              <tr>
                <th className="py-2.5 pl-3 pr-1 w-12 text-center">#</th>
                <th className="py-2.5 px-2">Golfer</th>
                <th className="py-2.5 px-2 text-center">Progress</th>
                <th className="py-2.5 pl-1 pr-3 text-right">Stars</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6d9f0]/70 text-xs font-bold text-[#51336d]">
              {globalRankings.map((user, idx) => {
                const rank = idx + 1;
                return (
                  <tr
                    key={user.uid}
                    className={`transition-colors ${
                      user.isCurrentUser ? 'bg-amber-100/70 font-extrabold' : 'hover:bg-purple-50/50'
                    }`}
                  >
                    {/* Rank Badge */}
                    <td className="py-2.5 pl-3 pr-1 text-center">
                      {rank <= 3 ? (
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white font-display font-bold text-xs shadow-xs ${
                            rank === 1
                              ? 'bg-gradient-to-b from-[#ffe066] to-[#f59f00]'
                              : rank === 2
                              ? 'bg-gradient-to-b from-[#cbd5e1] to-[#64748b]'
                              : 'bg-gradient-to-b from-[#f6ad55] to-[#c05621]'
                          }`}
                        >
                          {rank}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-6 h-6 text-slate-500 font-extrabold text-[11px] tabular-nums">
                          {rank}
                        </span>
                      )}
                    </td>

                    {/* Golfer Avatar & Name */}
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar seed={user.avatarSeed} size={24} showBorder={false} />
                        <span className="truncate max-w-[120px] md:max-w-[150px] text-[#51336d]">
                          {user.displayName}
                        </span>
                        {user.isCurrentUser && (
                          <span className="bg-[#2ba93c] text-white text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full shrink-0">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Current Hole Progress */}
                    <td className="py-2.5 px-2 text-center">
                      <span className="text-[11px] font-bold text-slate-500 bg-white border border-[#e6d9f0] rounded-full px-2 py-0.5">
                        Hole {user.currentHole || 1}
                      </span>
                    </td>

                    {/* Total Stars Pill */}
                    <td className="py-2.5 pl-1 pr-3 text-right">
                      <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-full px-2.5 py-0.5 text-amber-700 font-display font-bold text-xs">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                        <span>{user.totalStars}</span>
                        <span className="text-[10px] text-amber-500/80 font-normal">/ 90</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </GameModal>
  );
};
