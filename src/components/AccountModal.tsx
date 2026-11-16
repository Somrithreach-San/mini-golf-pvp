import React, { useState } from 'react';
import {
  Dice5,
  LogOut,
  AlertCircle,
  Loader2,
  Star,
  Trophy,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { generateRandomAvatarSeed } from '../data/userProfile';
import { firebaseSync, CloudSyncStatus, CloudUserProfile } from '../services/firebaseSync';
import { soundEngine } from '../audio/soundEngine';
import { GameModal } from './GameModals';
import '../ui-kit.css';

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
    onClose();
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
      if (isAuthGate) {
        onClose();
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
    <GameModal
      title={isRegistered ? 'Profile' : 'Sign In'}
      onClose={onClose}
      showClose={!isAuthGate}
      maxWidth="380px"
      footer={
        isRegistered ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="kit-btn kit-btn--md kit-btn--purple flex-1 cursor-pointer"
            >
              <span className="kit-btn-label">
                <LogOut className="w-4 h-4 mr-1" />
                Sign Out
              </span>
            </button>
            <button
              type="button"
              onClick={handleSaveProfileChanges}
              className="kit-btn kit-btn--md kit-btn--gold flex-1 cursor-pointer"
            >
              <span className="kit-btn-label">Save</span>
            </button>
          </div>
        ) : !isAuthGate ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="kit-btn kit-btn--md kit-btn--purple w-full cursor-pointer"
            >
              <span className="kit-btn-label">Close</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4 py-1 text-[#54317c]">
        {/* Status Alerts */}
        {error && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
            <span>{successMsg}</span>
          </div>
        )}

        {isRegistered ? (
          /* Profile Details */
          <div className="space-y-4">
            {/* User Identity & Avatar Customizer */}
            <div className="p-3.5 rounded-2xl bg-white/80 border border-[#d5c1ee] flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <UserAvatar seed={localAvatarSeed} size={50} />
                <div className="leading-tight">
                  <div className="text-xs font-bold text-[#8a68a8]">Signed In</div>
                  <div className="text-sm font-extrabold text-[#54317c] truncate max-w-[150px]">
                    {syncStatus.email || nameInput}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleShuffleAvatar}
                className="kit-btn kit-btn--sm kit-btn--purple !p-0 !w-10 !h-10 cursor-pointer"
                title="Randomize Avatar"
              >
                <span className="kit-btn-label">
                  <Dice5 className="w-5 h-5" />
                </span>
              </button>
            </div>

            {/* Display Name Input */}
            <div>
              <label className="block text-xs font-black text-[#7d35cd] mb-1.5 uppercase tracking-wider">
                Golfer Name
              </label>
              <input
                type="text"
                maxLength={18}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="kit-input"
                placeholder="Enter player nickname..."
              />
            </div>

            {/* Stats Card */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] flex items-center gap-2.5 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <Star className="w-4 h-4 fill-amber-500" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold text-[#8a68a8] uppercase">Stars</div>
                  <div className="text-sm font-black text-[#54317c]">{totalStars} / 90</div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white/80 border border-[#d5c1ee] flex items-center gap-2.5 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center text-[#7d35cd]">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="text-left leading-tight">
                  <div className="text-[10px] font-bold text-[#8a68a8] uppercase">Highest Hole</div>
                  <div className="text-sm font-black text-[#54317c]">Hole {currentHole}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Google-Only Login Form (No Guest, No Fake Email/Password) */
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#ebdff6] to-[#f4ecfb] border-2 border-[#d5c2ee] flex items-center justify-center shadow-inner">
              <span className="text-3xl select-none">⛳</span>
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-black text-xl text-[#54317c]">
                Sign In to Play
              </h3>
              <p className="text-xs font-bold text-[#8a68a8] max-w-[270px] leading-relaxed">
                Guest mode is disabled. Please sign in with your Google account to play, sync your stars, and compete on leaderboards.
              </p>
            </div>

            {/* Prominent 3D Google Sign-In Button */}
            <div className="w-full pt-1">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="kit-btn kit-btn--lg kit-btn--gold w-full cursor-pointer !h-[58px]"
              >
                <span className="kit-btn-label gap-3">
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <>
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-xs shrink-0">
                        <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                          <path d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
                          <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.313 0-9.823-3.418-11.421-8.183l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
                          <path d="M43.611 20.083H42V20H24v8h11.303a11.966 11.966 0 01-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                        </svg>
                      </div>
                      <span className="font-display font-extrabold text-base tracking-wide">
                        Sign in with Google
                      </span>
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </GameModal>
  );
};
