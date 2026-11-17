import React, { useState } from 'react';
import {
  X,
  User,
  Dice5,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Star,
  Trophy,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { generateRandomAvatarSeed } from '../data/userProfile';
import { firebaseSync, CloudSyncStatus, CloudUserProfile } from '../services/firebaseSync';
import { soundEngine } from '../audio/soundEngine';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onUpdatePlayerName: (name: string) => void;
  avatarSeed: string;
  onUpdateAvatarSeed: (seed: string) => void;
  totalStars: number;
  currentHole: number;
  selectedBallId: string;
  holeStars: Record<number, number>;
  syncStatus: CloudSyncStatus;
  onCloudProfileLoaded: (profile: CloudUserProfile) => void;
  /** When true, renders without backdrop/close button (auth gate splash) */
  isAuthGate?: boolean;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  playerName,
  onUpdatePlayerName,
  avatarSeed,
  onUpdateAvatarSeed,
  totalStars,
  currentHole,
  selectedBallId,
  holeStars,
  syncStatus,
  onCloudProfileLoaded,
  isAuthGate = false,
}) => {
  const [nameInput, setNameInput] = useState(playerName);
  const [localAvatarSeed, setLocalAvatarSeed] = useState(avatarSeed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isRegistered = !syncStatus.isAnonymous && syncStatus.email;

  const handleShuffleAvatar = () => {
    soundEngine.playClick();
    const newSeed = generateRandomAvatarSeed();
    setLocalAvatarSeed(newSeed);
    onUpdateAvatarSeed(newSeed);
  };

  const handleLogout = async () => {
    soundEngine.playClick();
    setLoading(true);
    await firebaseSync.logout();
    setLoading(false);
    setSuccessMsg('Signed out successfully.');
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    soundEngine.playClick();
    const res = await firebaseSync.loginWithGoogle();
    setLoading(false);
    if (res.success) {
      soundEngine.playClick();
      setSuccessMsg('Signed in with Google!');
      if (res.profile) {
        onCloudProfileLoaded(res.profile);
        if (res.profile.displayName) setNameInput(res.profile.displayName);
        if (res.profile.avatarSeed) setLocalAvatarSeed(res.profile.avatarSeed);
        onUpdatePlayerName(res.profile.displayName || 'Golfer');
      }
    } else if (res.error) {
      setError(res.error);
    }
  };

  const handleSaveProfileChanges = () => {
    soundEngine.playClick();
    const cleanName = nameInput.trim() || 'Golfer';
    onUpdatePlayerName(cleanName);
    onUpdateAvatarSeed(localAvatarSeed);
    firebaseSync.syncUserProfile({
      displayName: cleanName,
      avatarSeed: localAvatarSeed,
      currentHole,
      selectedBallId,
      holeStars,
      totalStars,
      preferences: { music: true, sfx: true, language: 'en' },
    });
    setSuccessMsg('Profile updated!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div
      className={isAuthGate ? 'w-full' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3.5'}
      onClick={isAuthGate ? undefined : onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-[420px] p-5 md:p-6 shadow-[0_16px_0_rgba(0,0,0,0.14),0_24px_48px_rgba(0,0,0,0.32)] border-2 border-white relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button — hidden when used as auth gate */}
        {!isAuthGate && (
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="relative mb-2">
            <UserAvatar seed={localAvatarSeed} size={76} className="border-4 border-white shadow-lg" />
            <button
              type="button"
              onClick={handleShuffleAvatar}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-110 active:scale-95"
              title="Shuffle DiceBear Avatar"
            >
              <Dice5 className="w-4 h-4" />
            </button>
          </div>

          <h2 className="font-display text-[26px] font-bold text-[#163a5f] leading-tight">
            {isRegistered ? 'Golfer Account' : 'Welcome to Mini Golf PvP'}
          </h2>

          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                isRegistered ? 'bg-emerald-500 animate-pulse' : 'bg-purple-500'
              }`}
            />
            <span className="text-xs font-extrabold text-slate-500">
              {isRegistered ? `Signed in as ${syncStatus.email}` : 'Google Account Sign-In'}
            </span>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {error && (
          <div className="mb-3.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-bold leading-snug">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-3.5 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-emerald-800 text-xs font-bold leading-snug">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">{successMsg}</div>
          </div>
        )}

        {/* LOGGED IN VIEW */}
        {isRegistered ? (
          <div className="space-y-4">
            {/* Stats Card */}
            <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Star className="w-4 h-4 fill-amber-500" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stars</div>
                  <div className="text-sm font-black text-slate-800">{totalStars} / 90</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Highest Hole</div>
                  <div className="text-sm font-black text-slate-800">Hole {currentHole}</div>
                </div>
              </div>
            </div>

            {/* Display Name Edit */}
            <div>
              <label className="block text-xs font-extrabold text-slate-600 mb-1">Display Name</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    maxLength={18}
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-[#7c3aed]"
                    placeholder="Enter golfer name..."
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveProfileChanges}
                  className="px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Logout Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="w-full py-2.5 rounded-full border-2 border-rose-200 text-rose-600 hover:bg-rose-50 font-display font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          /* GOOGLE ONLY SIGN-IN VIEW */
          <div className="space-y-4 pt-1">
            <p className="text-center text-xs text-slate-600 font-medium leading-relaxed px-2">
              Sign in with your Google account to play, sync your progress, unlock balls, and challenge players in PvP matches!
            </p>

            {/* Prominent Google Sign-In Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-display font-bold text-base shadow-md cursor-pointer transition-all disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#7c3aed]" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                    <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
                    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.313 0-9.823-3.418-11.421-8.183l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
                    <path d="M43.611 20.083H42V20H24v8h11.303a11.966 11.966 0 01-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 text-center">
              <span>⚡ One-click sign in • Instant cloud sync</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
