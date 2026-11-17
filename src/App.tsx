import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Settings,
  Play,
  Grid,
  Camera,
  Lightbulb,
  RotateCcw,
  Star,
  Trophy,
  Users,
  User,
  Radio,
  Swords,
  Smile,
  LogOut,
  Sparkles,
  Loader2,
  Flag,
  Clock,
  ShoppingBag,
  Pause,
} from 'lucide-react';
import {
  ALL_HOLES,
  GOLF_WORLDS,
  HoleCourse,
  isHoleUnlocked,
  getHoleLockReason,
  getHighestUnlockedHole,
} from './data/courses';
import { GOLF_BALL_SKINS, GolfBallSkin } from './data/balls';
import {
  LeaderboardEntry,
  loadAllLeaderboards,
  recordHoleScore,
  resetAllLeaderboards,
  getSavedPlayerName,
  savePlayerName,
  formatGolfTime,
} from './data/leaderboard';
import { Language, TRANSLATIONS, getSavedLanguage, saveLanguage } from './data/i18n';
import { GolfSceneCanvas } from './three/GolfSceneCanvas';
import { HolesSelectScreen } from './components/HolesSelectScreen';
import { LeaderboardModal } from './components/LeaderboardModal';
import {
  SettingsModal,
  BallsModal,
  HelpModal,
  HoleCompleteModal,
  PausedModal,
  GameModal,
} from './components/GameModals';
import { MultiplayerModal } from './components/MultiplayerModal';
import { AccountModal } from './components/AccountModal';
import { UserAvatar } from './components/UserAvatar';
import { CardTimerBorder } from './components/CardTimerBorder';
import { getSavedAvatarSeed, saveAvatarSeed, generateRandomAvatarSeed } from './data/userProfile';
import { multiplayerManager, MultiplayerState } from './multiplayer/MultiplayerManager';
import { soundEngine } from './audio/soundEngine';
import { firebaseSync, CloudSyncStatus } from './services/firebaseSync';

// Initial progress is completely empty for a clean slate
const INITIAL_STARS: Record<number, number> = {};

// Feature toggle: Chat emoji reactions system (disabled for now)
const ENABLE_EMOTES = false;

export default function App() {
  // Game Screen State: 'menu' | 'holes' | 'play'
  const [screen, setScreen] = useState<'menu' | 'holes' | 'play'>('menu');

  // Language State: 'en' | 'zh'
  const [language, setLanguage] = useState<Language>(() => getSavedLanguage());
  const t = TRANSLATIONS[language];

  // Persistent Hole Stars (1..30 -> 0..3)
  const [holeStars, setHoleStars] = useState<Record<number, number>>(() => {
    try {
      // Clear out legacy mock progress (8 holes / 21 stars)
      if (!localStorage.getItem('minigolf_clean_v1')) {
        localStorage.removeItem('minigolf_hole_stars');
        localStorage.removeItem('minigolf_current_hole_v2');
        localStorage.removeItem('minigolf_leaderboards_v1');
        localStorage.setItem('minigolf_clean_v1', 'true');
        return {};
      }
      const saved = localStorage.getItem('minigolf_hole_stars');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_STARS;
  });

  // Current active hole (defaults to Hole 1)
  const [currentHoleNumber, setCurrentHoleNumber] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('minigolf_current_hole_v2');
      if (saved) return Number(saved) || 1;
    } catch {}
    return 1;
  });
  const currentHoleNumberRef = useRef(currentHoleNumber);
  currentHoleNumberRef.current = currentHoleNumber;

  // Selected World in Holes Select Screen (defaults to World 0: Sunny Meadow)
  const [selectedWorldIndex, setSelectedWorldIndex] = useState<number>(0);

  // Selected Golf Ball Model (defaults to 3D Pro Tour Golf)
  const [selectedBallId, setSelectedBallId] = useState<string>(() => {
    try {
      return localStorage.getItem('minigolf_ball_id') || 'golf';
    } catch {
      return 'golf';
    }
  });

  // Persistent Leaderboards & Golfer Name
  const [leaderboards, setLeaderboards] = useState<Record<number, LeaderboardEntry[]>>(() =>
    loadAllLeaderboards()
  );
  const [playerName, setPlayerName] = useState<string>(() => getSavedPlayerName());
  const [avatarSeed, setAvatarSeed] = useState<string>(() => getSavedAvatarSeed());
  const [leaderboardHoleTarget, setLeaderboardHoleTarget] = useState<number>(1);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(null);
  const [lastBestRank, setLastBestRank] = useState<number | null>(null);

  // Audio Settings
  const [musicEnabled, setMusicEnabled] = useState<boolean>(soundEngine.musicEnabled);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(soundEngine.sfxEnabled);

  // Active Modals
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ballsOpen, setBallsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [victoryOpen, setVictoryOpen] = useState(false);
  const [pausedOpen, setPausedOpen] = useState(false);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [surrenderConfirmOpen, setSurrenderConfirmOpen] = useState(false);
  const [mpTimeoutNotice, setMpTimeoutNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() => firebaseSync.getStatus());

  // Auth Gate: true once Firebase has resolved the initial auth state
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 2-Player Real-Time Online Multiplayer State
  const [mpState, setMpState] = useState<MultiplayerState>(multiplayerManager.getState());
  const [mpHoleResult, setMpHoleResult] = useState<{
    winner: 'p1' | 'p2' | 'tie';
    p1Strokes: number;
    p2Strokes: number;
  } | null>(null);
  const [floatingEmotes, setFloatingEmotes] = useState<Array<{ id: number; emoji: string; from: 'local' | 'remote' }>>([]);

  useEffect(() => {
    return multiplayerManager.subscribe((state) => {
      setMpState(state);
      if (state.matchWinner) {
        try {
          confetti({ particleCount: 75, spread: 80, origin: { y: 0.5 } });
        } catch {}
      }
      // Synchronize course map across network for both players
      if (state.isMultiplayer && (state.status === 'connected' || state.status === 'hosting')) {
        if (state.holeNumber && state.holeNumber !== currentHoleNumberRef.current) {
          currentHoleNumberRef.current = state.holeNumber;
          setCurrentHoleNumber(state.holeNumber);
          setRetryTrigger((t) => t + 1);
        }
      }
    });
  }, []);

  useEffect(() => {
    return multiplayerManager.onHoleComplete((payload) => {
      soundEngine.playHoleSink();
      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch {}
      setMpHoleResult({
        winner: payload.winner,
        p1Strokes: payload.p1Strokes,
        p2Strokes: payload.p2Strokes,
      });
    });
  }, []);

  useEffect(() => {
    return multiplayerManager.onNextHole((payload) => {
      setMpHoleResult(null);
      currentHoleNumberRef.current = payload.holeNumber;
      setCurrentHoleNumber(payload.holeNumber);
      setRetryTrigger((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    return multiplayerManager.onTimeout((timedOutPlayer) => {
      const isMe = (mpState.isHost && timedOutPlayer === 'p1') || (!mpState.isHost && timedOutPlayer === 'p2');
      setMpTimeoutNotice(isMe ? "⏱️ Time's Up! Turn skipped (+1 Stroke)" : "⏱️ Opponent Timed Out! Your Turn");
      setTimeout(() => setMpTimeoutNotice(null), 3200);
    });
  }, [mpState.isHost]);

  useEffect(() => {
    if (!ENABLE_EMOTES) return;
    return multiplayerManager.onRemoteEmote((emoji) => {
      soundEngine.playClick();
      const newEmote = { id: Date.now() + Math.random(), emoji, from: 'remote' as const };
      setFloatingEmotes((prev) => [...prev.slice(-3), newEmote]);
      setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
      }, 2400);
    });
  }, []);

  const handleSendEmote = useCallback((emoji: string) => {
    soundEngine.playClick();
    multiplayerManager.sendEmote(emoji);
    const newEmote = { id: Date.now() + Math.random(), emoji, from: 'local' as const };
    setFloatingEmotes((prev) => [...prev.slice(-3), newEmote]);
    setTimeout(() => {
      setFloatingEmotes((prev) => prev.filter((e) => e.id !== newEmote.id));
    }, 2400);
  }, []);

  const handleMultiplayerHoleFinish = useCallback((winner: 'p1' | 'p2' | 'tie', p1Strokes: number, p2Strokes: number) => {
    soundEngine.playHoleSink();
    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch {}

    setMpHoleResult({ winner, p1Strokes, p2Strokes });
    const outcome = multiplayerManager.finishHole(winner);

    if (!outcome.isMatchOver) {
      setTimeout(() => {
        if (!multiplayerManager.getState().isMultiplayer) return;
        setMpHoleResult(null);
        multiplayerManager.advanceHole(outcome.nextHoleNumber);
        currentHoleNumberRef.current = outcome.nextHoleNumber;
        setCurrentHoleNumber(outcome.nextHoleNumber);
        setRetryTrigger((t) => t + 1);
      }, 3500);
    }
  }, []);

  // Gameplay HUD State & Synchronous Refs
  const [strokes, setStrokes] = useState(0);
  const strokesRef = useRef(0);

  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedMsRef = useRef(0);
  const isHoleFinishedRef = useRef(false);
  const victoryTimeoutRef = useRef<number | null>(null);

  const [powerPercent, setPowerPercent] = useState(0);
  const [hintInfo, setHintInfo] = useState<{ powerPercent: number; isHoleInOne: boolean } | null>(null);
  const [lastEarnedStars, setLastEarnedStars] = useState(3);
  const [completedTimeMs, setCompletedTimeMs] = useState(0);

  // Action Triggers for 3D Canvas
  const [rotateTrigger, setRotateTrigger] = useState(0);
  const [hintTrigger, setHintTrigger] = useState(0);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const activeCourse: HoleCourse = useMemo(() => {
    return ALL_HOLES.find((h) => h.holeNumber === currentHoleNumber) || ALL_HOLES[0];
  }, [currentHoleNumber]);

  const activeWorld = useMemo(() => {
    return GOLF_WORLDS[activeCourse.worldIndex] || GOLF_WORLDS[0];
  }, [activeCourse]);

  const localizedActiveWorldName = t.worlds[activeWorld.index]?.name || activeWorld.name;

  const activeBallSkin: GolfBallSkin = useMemo(() => {
    return GOLF_BALL_SKINS.find((b) => b.id === selectedBallId) || GOLF_BALL_SKINS[0];
  }, [selectedBallId]);

  // Compute progress metrics
  const totalStars = useMemo(() => {
    return Object.values(holeStars).reduce((acc, s) => acc + s, 0);
  }, [holeStars]);

  // Firebase Auth & Cloud State Sync Initialization
  useEffect(() => {
    const unsubStatus = firebaseSync.subscribeStatus((status) => {
      setSyncStatus(status);
      // Auth gate: once Firebase resolves auth state (authResolved flag), update gate
      if (status.authResolved) {
        setAuthReady(true);
        setIsAuthenticated(Boolean(status.email));
      }
    });
    firebaseSync.initSession((cloudProfile) => {
      if (cloudProfile) {
        const isLegacyMock =
          cloudProfile.currentHole === 9 &&
          Object.values(cloudProfile.holeStars || {}).reduce((a, b) => a + b, 0) === 21;

        if (isLegacyMock && !localStorage.getItem('minigolf_cloud_reset_done')) {
          localStorage.setItem('minigolf_cloud_reset_done', 'true');
          // Clear legacy mock progress in Cloud Firestore
          firebaseSync.syncUserProfile({
            displayName: playerName,
            avatarSeed,
            currentHole: 1,
            selectedBallId: 'golf',
            holeStars: {},
            totalStars: 0,
            preferences: {
              music: musicEnabled,
              sfx: sfxEnabled,
              language,
            },
          });
          return;
        }

        if (cloudProfile.displayName && cloudProfile.displayName !== 'Golf Pro') {
          setPlayerName(cloudProfile.displayName);
          savePlayerName(cloudProfile.displayName);
        }
        if (cloudProfile.avatarSeed) {
          setAvatarSeed(cloudProfile.avatarSeed);
          saveAvatarSeed(cloudProfile.avatarSeed);
        }
        if (!isLegacyMock && cloudProfile.currentHole && cloudProfile.currentHole > 1) {
          setCurrentHoleNumber((prev) => Math.max(prev, cloudProfile.currentHole));
        }
        if (cloudProfile.selectedBallId) {
          setSelectedBallId(cloudProfile.selectedBallId);
        }
        if (!isLegacyMock && cloudProfile.holeStars && Object.keys(cloudProfile.holeStars).length > 0) {
          setHoleStars((prev) => {
            const merged = { ...prev };
            Object.entries(cloudProfile.holeStars).forEach(([h, s]) => {
              const hNum = Number(h);
              merged[hNum] = Math.max(merged[hNum] || 0, s);
            });
            try {
              localStorage.setItem('minigolf_hole_stars', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }
    });

    return () => unsubStatus();
  }, [playerName, avatarSeed, musicEnabled, sfxEnabled, language]);

  const handleManualSync = useCallback(() => {
    firebaseSync.syncUserProfile({
      displayName: playerName,
      avatarSeed,
      currentHole: currentHoleNumber,
      selectedBallId,
      holeStars,
      totalStars,
      preferences: {
        music: musicEnabled,
        sfx: sfxEnabled,
        language,
      },
    });
  }, [playerName, avatarSeed, currentHoleNumber, selectedBallId, holeStars, totalStars, musicEnabled, sfxEnabled, language]);

  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);

  const handleDirectGoogleLogin = useCallback(async () => {
    soundEngine.playClick();
    setGoogleAuthLoading(true);
    setGoogleAuthError(null);
    const res = await firebaseSync.loginWithGoogle();
    setGoogleAuthLoading(false);
    if (res.success && res.profile) {
      soundEngine.playClick();
      if (res.profile.displayName && res.profile.displayName !== 'Golf Pro') {
        setPlayerName(res.profile.displayName);
        savePlayerName(res.profile.displayName);
      }
      if (res.profile.avatarSeed) {
        setAvatarSeed(res.profile.avatarSeed);
        saveAvatarSeed(res.profile.avatarSeed);
      }
    } else if (res.error) {
      setGoogleAuthError(res.error);
    }
  }, []);

  const clearVictoryTimeout = useCallback(() => {
    if (victoryTimeoutRef.current !== null) {
      clearTimeout(victoryTimeoutRef.current);
      victoryTimeoutRef.current = null;
    }
  }, []);

  // Live Hole Stopwatch during active gameplay
  const anyModalOpen =
    settingsOpen || ballsOpen || helpOpen || leaderboardOpen || victoryOpen || pausedOpen || multiplayerOpen || !!mpHoleResult || !!mpState.matchWinner;

  useEffect(() => {
    if (screen !== 'play' || anyModalOpen || isHoleFinishedRef.current) return;

    let lastTick = performance.now();
    let lastSec = Math.floor(elapsedMsRef.current / 1000);
    const interval = window.setInterval(() => {
      if (isHoleFinishedRef.current) return;
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      elapsedMsRef.current += delta;
      const curSec = Math.floor(elapsedMsRef.current / 1000);
      if (curSec !== lastSec) {
        lastSec = curSec;
        setElapsedMs(curSec * 1000);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [screen, anyModalOpen]);

  useEffect(() => {
    return () => clearVictoryTimeout();
  }, [clearVictoryTimeout]);

  const saveHoleStars = (nextStars: Record<number, number>) => {
    setHoleStars(nextStars);
    try {
      localStorage.setItem('minigolf_hole_stars', JSON.stringify(nextStars));
    } catch {}
  };

  const resetHoleCounters = useCallback(() => {
    clearVictoryTimeout();
    isHoleFinishedRef.current = false;
    strokesRef.current = 0;
    elapsedMsRef.current = 0;
    setStrokes(0);
    setElapsedMs(0);
    setPowerPercent(0);
    setHintInfo(null);
    setVictoryOpen(false);
    setHighlightEntryId(null);
  }, [clearVictoryTimeout]);

  const startHole = useCallback(
    (holeNum: number) => {
      // Ensure the target hole is unlocked, otherwise fallback to highest unlocked
      const targetHole = isHoleUnlocked(holeNum, holeStars)
        ? holeNum
        : getHighestUnlockedHole(holeStars);
      resetHoleCounters();
      setCurrentHoleNumber(targetHole);
      try {
        localStorage.setItem('minigolf_current_hole_v2', String(targetHole));
      } catch {}
      setScreen('play');
      setRetryTrigger((t) => t + 1);
    },
    [resetHoleCounters, holeStars]
  );

  const handleStrokeIncrement = useCallback(() => {
    strokesRef.current += 1;
    setStrokes(strokesRef.current);
  }, []);

  const handleHoleComplete = useCallback(() => {
    if (isHoleFinishedRef.current) return;
    isHoleFinishedRef.current = true;

    const finalStrokes = Math.max(1, strokesRef.current);
    const finalTimeMs = Math.max(250, Math.round(elapsedMsRef.current));
    setStrokes(finalStrokes);
    setCompletedTimeMs(finalTimeMs);

    const diff = finalStrokes - activeCourse.par;
    let earned = 1;
    if (diff <= 0) earned = 3;
    else if (diff === 1) earned = 2;

    setLastEarnedStars(earned);

    setHoleStars((prev) => {
      const best = Math.max(prev[activeCourse.holeNumber] || 0, earned);
      const updated = { ...prev, [activeCourse.holeNumber]: best };
      try {
        localStorage.setItem('minigolf_hole_stars', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Record score in persistent Top 10 Leaderboard for this hole
    const result = recordHoleScore({
      holeNumber: activeCourse.holeNumber,
      playerName,
      strokes: finalStrokes,
      timeMs: finalTimeMs,
      stars: earned,
      ballId: selectedBallId,
    });

    setLeaderboards(result.updatedBoard);
    setHighlightEntryId(result.newEntry.id);

    // Sync score & profile to Firebase Firestore (if configured)
    firebaseSync.submitScore({
      holeNumber: activeCourse.holeNumber,
      playerName,
      avatarSeed,
      strokes: finalStrokes,
      timeMs: finalTimeMs,
      stars: earned,
      ballId: selectedBallId,
    });
    const updatedStarsMap = { ...holeStars, [activeCourse.holeNumber]: Math.max(holeStars[activeCourse.holeNumber] || 0, earned) };
    firebaseSync.syncUserProfile({
      displayName: playerName,
      avatarSeed,
      currentHole: Math.max(currentHoleNumber, activeCourse.holeNumber < 30 ? activeCourse.holeNumber + 1 : activeCourse.holeNumber),
      selectedBallId,
      holeStars: updatedStarsMap,
      totalStars: Object.values(updatedStarsMap).reduce((a, b) => a + b, 0),
      preferences: {
        music: musicEnabled,
        sfx: sfxEnabled,
        language,
      },
    });

    const bestRank =
      result.rankStrokes !== null && result.rankTime !== null
        ? Math.min(result.rankStrokes, result.rankTime)
        : result.rankStrokes ?? result.rankTime;
    setLastBestRank(bestRank);

    // Fire celebratory confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {}

    clearVictoryTimeout();
    victoryTimeoutRef.current = window.setTimeout(() => {
      setVictoryOpen(true);
    }, 480);
  }, [activeCourse, playerName, avatarSeed, selectedBallId, holeStars, currentHoleNumber, language, clearVictoryTimeout]);

  const handleResetProgress = () => {
    resetHoleCounters();
    saveHoleStars({});
    setLeaderboards(resetAllLeaderboards());
    setCurrentHoleNumber(1);
    try {
      localStorage.setItem('minigolf_current_hole_v2', '1');
    } catch {}
    firebaseSync.syncUserProfile({
      displayName: playerName,
      avatarSeed,
      currentHole: 1,
      selectedBallId: 'golf',
      holeStars: {},
      totalStars: 0,
      preferences: {
        music: musicEnabled,
        sfx: sfxEnabled,
        language,
      },
    });
    setRetryTrigger((t) => t + 1);
  };

  const handleToggleMusic = (val: boolean) => {
    setMusicEnabled(val);
    soundEngine.setMusicEnabled(val);
  };

  const handleToggleSfx = (val: boolean) => {
    setSfxEnabled(val);
    soundEngine.setSfxEnabled(val);
  };

  const handleChangeLanguage = (lang: Language) => {
    setLanguage(lang);
    saveLanguage(lang);
  };

  const openLeaderboardForHole = useCallback((holeNum: number) => {
    setLeaderboardHoleTarget(holeNum);
    setLeaderboardOpen(true);
  }, []);

  // ── AUTH GATE ─────────────────────────────────────────────────────────────
  // Show a full-screen loading spinner until Firebase resolves auth state.
  // Then, if not authenticated, show the sign-in / register splash (non-closeable).
  if (!authReady) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#96d1ff] via-[#d8f0ff] to-[#f2faff]">
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl">⛳</div>
          <p className="text-white font-display font-bold text-xl tracking-wide drop-shadow">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#96d1ff] via-[#d8f0ff] to-[#f2faff] overflow-hidden p-4 select-none">
        <AccountModal
          isOpen={true}
          onClose={() => {
            // Guest play
            setIsAuthenticated(true);
          }}
          playerName={playerName}
          onUpdatePlayerName={(name) => {
            setPlayerName(name);
            savePlayerName(name);
          }}
          avatarSeed={avatarSeed}
          onUpdateAvatarSeed={(seed) => {
            setAvatarSeed(seed);
            saveAvatarSeed(seed);
          }}
          totalStars={totalStars}
          currentHole={currentHoleNumber}
          selectedBallId={selectedBallId}
          holeStars={holeStars}
          syncStatus={syncStatus}
          onCloudProfileLoaded={(prof) => {
            if (prof.displayName) {
              setPlayerName(prof.displayName);
              savePlayerName(prof.displayName);
            }
            if (prof.avatarSeed) {
              setAvatarSeed(prof.avatarSeed);
              saveAvatarSeed(prof.avatarSeed);
            }
            setIsAuthenticated(true);
          }}
          isAuthGate={true}
        />
      </div>
    );
  }
  // ── END AUTH GATE ──────────────────────────────────────────────────────────

  return (
    <div className="relative w-screen h-dvh overflow-hidden select-none flex flex-col bg-gradient-to-b from-[#96d1ff] via-[#d8f0ff] to-[#f2faff]">
      {/* =================================================================
          1. MAIN MENU SCREEN (Responsive across Mobile, Tablet & PC Desktop)
      ================================================================= */}
      {screen === 'menu' && (
        <div className="relative w-full h-full flex flex-col justify-between p-4 md:p-6 lg:p-6">
          {/* Background 3D Floating Island Diorama (Upper center on Mobile/Tablet, Left half on PC) */}
          <div className="absolute inset-0 z-0">
            <GolfSceneCanvas
              mode="menu"
              course={activeCourse}
              ballSkin={activeBallSkin}
              rotateTrigger={rotateTrigger}
              hintTrigger={hintTrigger}
              retryTrigger={retryTrigger}
              onPowerChange={setPowerPercent}
              onStrokeIncrement={handleStrokeIncrement}
              onHoleComplete={handleHoleComplete}
              multiplayerState={mpState}
              onMultiplayerHoleFinish={handleMultiplayerHoleFinish}
            />
          </div>

          {/* Top Action Bar */}
          <div className="relative z-20 w-full flex items-start justify-between">
            {/* Top-left User Profile & Stars Pills (Stacked on mobile so zero shrinking, row on tablet/desktop) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-2">
              {syncStatus.email ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setAccountOpen(true);
                  }}
                  className="ui-chip rounded-full pl-1.5 pr-3 py-1 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform shrink-0"
                  title="Golfer Account & Profile"
                >
                  <UserAvatar seed={avatarSeed} size={28} showBorder={false} />
                  <span className="text-xs md:text-sm font-black text-[#51336d] max-w-[120px] sm:max-w-[150px] truncate">
                    {playerName}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setAccountOpen(true);
                  }}
                  className="btn-3d-purple rounded-2xl px-3.5 py-1.5 md:px-4 md:py-2 flex items-center gap-2 cursor-pointer shadow-md hover:scale-105 active:scale-95 transition-transform shrink-0"
                  title="Sign In or Register"
                >
                  <User className="w-4 h-4 md:w-4.5 md:h-4.5 text-white" />
                  <span className="font-display font-bold text-white text-xs md:text-sm tracking-wide">
                    Sign In with Google
                  </span>
                </button>
              )}
              <div className="ui-chip rounded-full px-3 py-1 sm:px-3.5 sm:py-1.5 md:px-4 md:py-2 flex items-center gap-1.5 shrink-0">
                <Star className="w-4 h-4 md:w-5 md:h-5 fill-[#ffc82c] text-[#d97706] shrink-0" />
                <span className="text-[13px] sm:text-[14px] md:text-[16px] font-extrabold text-[#51336d] tabular-nums whitespace-nowrap">
                  {totalStars} / 90
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  openLeaderboardForHole(currentHoleNumber);
                }}
                className="btn-3d-yellow w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white cursor-pointer"
                title={t.top10LeaderboardsTitle}
              >
                <Trophy className="w-5 h-5 stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setHelpOpen(true);
                }}
                className="btn-3d-blue w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white font-display font-bold text-xl md:text-2xl cursor-pointer"
                title={t.howToPlay}
              >
                ?
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSettingsOpen(true);
                }}
                className="btn-3d-purple w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white cursor-pointer"
                title={t.settings}
              >
                <Settings className="w-5 h-5 md:w-6 md:h-6 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Menu Control Stack: Rendered inside the authentic Cartoon UI Panel from Mockup */}
          <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center my-auto pointer-events-none">
            <div className="w-full max-w-[340px] md:max-w-[380px] pointer-events-auto">
              <div className="ui-panel pt-11 pb-5 px-5 md:pt-12 md:pb-6 md:px-6 flex flex-col items-center gap-3.5 shadow-2xl">
                {/* Overlapping Purple Banner: "Home" */}
                <div className="ui-panel-title">
                  <span>Home</span>
                </div>

                {/* Squircle Close Button from Mockup */}
                <button
                  type="button"
                  className="ui-panel-close"
                  onClick={() => {
                    soundEngine.playClick();
                    setSettingsOpen(true);
                  }}
                  title="Settings"
                >
                  ✕
                </button>

                {/* Primary "Play" Wide Gold 3D Button */}
                {(() => {
                  const continueHole = isHoleUnlocked(currentHoleNumber, holeStars)
                    ? currentHoleNumber
                    : getHighestUnlockedHole(holeStars);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        soundEngine.startMusic();
                        startHole(continueHole);
                      }}
                      className="btn-3d-orange w-full h-14 md:h-16 rounded-2xl flex items-center justify-center gap-3 text-white cursor-pointer shadow-md"
                    >
                      <Play className="w-6 h-6 fill-white ml-0.5" />
                      <span className="font-display font-black text-2xl md:text-[26px] tracking-wide">
                        Play
                      </span>
                    </button>
                  );
                })()}

                {/* Secondary "Levels" Wide Gold 3D Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setSelectedWorldIndex(activeCourse.worldIndex);
                    setScreen('holes');
                  }}
                  className="btn-3d-orange w-full h-14 md:h-16 rounded-2xl flex items-center justify-center gap-3 text-white cursor-pointer shadow-md"
                >
                  <Grid className="w-5 h-5 fill-white/20 stroke-[2.75]" />
                  <span className="font-display font-black text-2xl md:text-[26px] tracking-wide">
                    Levels
                  </span>
                </button>

                {/* 2-Player Real-Time Online Match Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setMultiplayerOpen(true);
                  }}
                  className="btn-3d-purple w-full h-13 md:h-14 rounded-2xl flex items-center justify-center gap-2.5 text-white cursor-pointer shadow-md"
                >
                  <Users className="w-5 h-5 fill-white/20 stroke-[2.5]" />
                  <span className="font-display font-black text-xl md:text-2xl tracking-wide">
                    2-Player PvP
                  </span>
                </button>

                {/* Bottom Row of 3 Round Gold Action Coins (Exact match to Home reference mockup!) */}
                <div className="flex items-center justify-center gap-4 mt-1">
                  {/* Coin 1: Golfer Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setAccountOpen(true);
                    }}
                    className="btn-round-gold"
                    title="Profile & Account"
                  >
                    <User className="w-6 h-6 stroke-[2.75]" />
                  </button>

                  {/* Coin 2: Golf Balls Shop */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setBallsOpen(true);
                    }}
                    className="btn-round-gold"
                    title="Golf Balls Shop"
                  >
                    <ShoppingBag className="w-6 h-6 stroke-[2.75]" />
                  </button>

                  {/* Coin 3: Settings */}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setSettingsOpen(true);
                    }}
                    className="btn-round-gold"
                    title="Settings"
                  >
                    <Settings className="w-6 h-6 stroke-[2.75]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          2. HOLES / WORLD SELECT SCREEN (Mobile 2x3, Tablet 3x2, PC 3x2)
      ================================================================= */}
      {screen === 'holes' && (
        <HolesSelectScreen
          language={language}
          selectedWorldIndex={selectedWorldIndex}
          holeStars={holeStars}
          totalStars={totalStars}
          onChangeWorld={setSelectedWorldIndex}
          onSelectHole={(hole) => startHole(hole.holeNumber)}
          onOpenLeaderboard={(holeNum) => openLeaderboardForHole(holeNum)}
          onBackHome={() => {
            clearVictoryTimeout();
            setScreen('menu');
          }}
        />
      )}

      {/* =================================================================
          3. GAMEPLAY SCREEN
             - Mobile (< md): Compact 2-row header + vertical 3D frame + bottom thumb bar
             - Tablet (md:): Centered inline HUD pills + spacious 3D frame + centered tablet bottom control dock
             - PC (lg:): Centered header + wide horizontal 3D frame + right-flank vertical buttons (Screenshot 2)
      ================================================================= */}
      {screen === 'play' && (
        <div className="relative w-full h-full flex flex-col justify-between p-2.5 md:px-5 md:py-3.5 lg:px-5 lg:py-3.5 gap-2 md:gap-3 lg:gap-2.5">
          {/* Top HUD Header */}
          <div className="w-full flex flex-col items-center gap-1.5 md:gap-2 z-20 shrink-0">
            {mpState.isMultiplayer && mpState.status === 'connected' ? (
              /* Multiplayer Live Header */
              <>
                <div className="w-full flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setSurrenderConfirmOpen(true);
                    }}
                    className="btn-3d-red w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-white cursor-pointer shrink-0"
                    title="Leave Match"
                  >
                    <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                  </button>

                  <div className="ui-status-pill rounded-[20px] md:rounded-[22px] min-w-[200px] md:min-w-[260px] px-5 py-1 md:py-1.5 text-center flex flex-col items-center">
                    <div className="font-display font-bold text-[17px] md:text-[20px] text-[#51336d] leading-tight">
                      {t.holeLabel(activeCourse.holeNumber)} • Par {activeCourse.par}
                    </div>
                    <div className="text-[11px] md:text-[12px] font-extrabold text-[#7d36c8] leading-tight flex items-center gap-1">
                      <Radio className="w-3 h-3 text-red-500 animate-pulse" /> Match Hole {mpState.holeIndex + 1} of {mpState.matchHoles}
                    </div>
                  </div>

                  <div className="w-10 h-10 md:w-11 md:h-11 shrink-0 pointer-events-none" />
                </div>

                {/* Multiplayer Match Players & Turn Bar */}
                <div className="w-full max-w-[620px] flex items-center justify-between gap-2 px-1">
                  {/* Player 1 Card (Host) */}
                  <div className={`ui-player-card ${mpState.currentTurn === 'p1' ? 'is-active' : ''} relative flex-1 rounded-2xl px-2.5 py-1.5 md:py-2 flex items-center gap-2 transition-all`}>
                    <CardTimerBorder
                      player="p1"
                      isActive={mpState.currentTurn === 'p1'}
                      timeRemaining={mpState.turnTimeRemaining}
                      totalTime={35}
                    />
                    <UserAvatar
                      seed={mpState.isHost ? mpState.localPlayer.avatarSeed : mpState.remotePlayer?.avatarSeed || 'Host'}
                      size={32}
                      className="border-2 border-[#7d36c8]"
                    />
                    <div className="flex-1 min-w-0 text-left leading-tight">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs md:text-sm font-bold text-[#51336d] truncate">
                          {mpState.isHost ? `${mpState.localPlayer.name} (You)` : (mpState.remotePlayer?.name || 'Player 1')}
                        </span>
                        {mpState.currentTurn === 'p1' && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums shrink-0 ${
                            mpState.turnTimeRemaining <= 7
                              ? 'bg-red-500 text-white animate-pulse'
                              : mpState.turnTimeRemaining <= 15
                              ? 'bg-amber-100 text-amber-700 font-bold'
                              : 'bg-purple-100 text-[#7d36c8]'
                          }`}>
                            {Math.ceil(mpState.turnTimeRemaining)}s
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] md:text-[11px] text-[#8e76a6] font-extrabold">
                        Wins: <span className="text-[#7d36c8]">{mpState.p1HolesWon}</span> • Strokes: <span className="text-[#51336d]">{mpState.p1Strokes}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Turn Badge */}
                  <div className="shrink-0 flex flex-col items-center">
                    {(mpState.isHost && mpState.currentTurn === 'p1') || (!mpState.isHost && mpState.currentTurn === 'p2') ? (
                      <div className={`font-display font-bold px-2 py-1 md:px-4 md:py-1.5 rounded-full text-[11px] md:text-sm flex items-center gap-1 md:gap-1.5 text-white whitespace-nowrap ${
                        mpState.turnTimeRemaining <= 10
                          ? 'bg-red-500 shadow-[0_3px_0_#b91c1c] animate-bounce'
                          : 'bg-[#10b981] shadow-[0_3px_0_#059669] animate-pulse'
                      }`}>
                        <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                        <span>YOUR TURN ({Math.ceil(mpState.turnTimeRemaining)}s)</span>
                      </div>
                    ) : (
                      <div className="bg-[#f59e0b] text-white font-display font-bold px-2 py-1 md:px-4 md:py-1.5 rounded-full shadow-[0_3px_0_#d97706] text-[11px] md:text-sm flex items-center gap-1 md:gap-1.5 whitespace-nowrap">
                        <span>WAITING... ({Math.ceil(mpState.turnTimeRemaining)}s)</span>
                      </div>
                    )}
                  </div>

                  {/* Player 2 Card (Guest) */}
                  <div className={`ui-player-card ${mpState.currentTurn === 'p2' ? 'is-active' : ''} relative flex-1 rounded-2xl px-2.5 py-1.5 md:py-2 flex items-center gap-2 transition-all`}>
                    <CardTimerBorder
                      player="p2"
                      isActive={mpState.currentTurn === 'p2'}
                      timeRemaining={mpState.turnTimeRemaining}
                      totalTime={35}
                    />
                    <UserAvatar
                      seed={!mpState.isHost ? mpState.localPlayer.avatarSeed : mpState.remotePlayer?.avatarSeed || 'Guest'}
                      size={32}
                      className="border-2 border-[#ed7c08]"
                    />
                    <div className="flex-1 min-w-0 text-left leading-tight">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs md:text-sm font-bold text-[#51336d] truncate">
                          {!mpState.isHost ? `${mpState.localPlayer.name} (You)` : (mpState.remotePlayer?.name || 'Player 2')}
                        </span>
                        {mpState.currentTurn === 'p2' && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums shrink-0 ${
                            mpState.turnTimeRemaining <= 7
                              ? 'bg-red-500 text-white animate-pulse'
                              : mpState.turnTimeRemaining <= 15
                              ? 'bg-amber-100 text-amber-700 font-bold'
                              : 'bg-orange-100 text-[#ed7c08]'
                          }`}>
                            {Math.ceil(mpState.turnTimeRemaining)}s
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] md:text-[11px] text-[#8e76a6] font-extrabold">
                        Wins: <span className="text-[#ed7c08]">{mpState.p2HolesWon}</span> • Strokes: <span className="text-[#51336d]">{mpState.p2Strokes}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Single Player Standard Header */
              <>
                {/* Row 1: Holes Button | Centered Hole Title Pill | Trophy & Settings */}
                <div className="w-full flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      clearVictoryTimeout();
                      setSelectedWorldIndex(activeCourse.worldIndex);
                      setScreen('holes');
                    }}
                    className="btn-3d-blue w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white cursor-pointer shrink-0"
                    title={t.holesMenuTooltip}
                  >
                    <Grid className="w-5 h-5 md:w-6 md:h-6 stroke-[2.5]" />
                  </button>

                  <div className="ui-status-pill rounded-[20px] md:rounded-[22px] min-w-[170px] md:min-w-[215px] px-6 md:px-9 lg:px-10 py-1 md:py-1.5 text-center">
                    <div className="font-display font-bold text-[19px] md:text-[22px] lg:text-[23px] text-[#51336d] leading-tight">
                      {t.holeLabel(activeCourse.holeNumber)}
                    </div>
                    <div className="text-[11px] md:text-[12px] font-extrabold text-[#7d36c8] leading-tight truncate">
                      {localizedActiveWorldName}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        openLeaderboardForHole(activeCourse.holeNumber);
                      }}
                      className="btn-3d-yellow w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white cursor-pointer"
                      title={t.top10LeaderboardsTitle}
                    >
                      <Trophy className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setPausedOpen(true);
                      }}
                      className="btn-round-gold !w-11 !h-11 md:!w-12 md:!h-12"
                      title="Pause Game"
                    >
                      <Pause className="w-5 h-5 fill-current stroke-[2]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setSettingsOpen(true);
                      }}
                      className="btn-3d-purple w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white cursor-pointer"
                      title={t.settings}
                    >
                      <Settings className="w-5 h-5 md:w-6 md:h-6 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Fixed-Size Status Pills (Consistent height h-9 md:h-10 and fixed widths so zero shaking!) */}
                <div className="w-full grid grid-cols-4 gap-1.5 md:flex md:w-auto md:items-center md:justify-center md:gap-3">
                  {/* Strokes Pill */}
                  <div className="ui-status-pill h-9 md:h-10 md:w-[116px] rounded-full px-2.5 md:px-4 flex items-center justify-center gap-1 md:gap-2 shrink-0">
                    <span className="text-[11px] md:text-[13px] font-bold text-[#51336d] leading-none">
                      {t.strokes}
                    </span>
                    <span className="w-5 md:w-6 text-center font-display font-bold text-[15px] md:text-[18px] text-[#7d36c8] tabular-nums leading-none">
                      {strokes}
                    </span>
                  </div>

                  {/* Par Pill */}
                  <div className="ui-status-pill h-9 md:h-10 md:w-[92px] rounded-full px-2.5 md:px-4 flex items-center justify-center gap-1 md:gap-2 shrink-0">
                    <span className="text-[11px] md:text-[13px] font-bold text-[#51336d] leading-none">
                      {t.par}
                    </span>
                    <span className="w-4 md:w-5 text-center font-display font-bold text-[15px] md:text-[18px] text-[#2ba93c] tabular-nums leading-none">
                      {activeCourse.par}
                    </span>
                  </div>

                  {/* Time Pill (MM:SS fixed width) */}
                  <div className="ui-status-pill h-9 md:h-10 md:w-[130px] rounded-full px-2 md:px-4 flex items-center justify-center gap-1 md:gap-2 shrink-0">
                    <span className="hidden md:inline text-[13px] font-bold text-[#51336d] leading-none">
                      {t.time}
                    </span>
                    <span className="w-[44px] md:w-[50px] text-center font-display font-bold text-[14px] md:text-[17px] text-[#ed7c08] tabular-nums leading-none">
                      {formatGolfTime(elapsedMs)}
                    </span>
                  </div>

                  {/* Power Pill (Matches exact height h-9 md:h-10 of other pills) */}
                  <div className="ui-status-pill h-9 md:h-10 md:w-[186px] rounded-full px-2.5 md:px-4 flex flex-col md:flex-row items-center justify-center md:gap-2.5 shrink-0">
                    <span className="text-[9px] md:text-[13px] font-extrabold md:font-bold uppercase md:capitalize text-[#51336d] leading-none mb-1 md:mb-0 text-center shrink-0">
                      {t.power}
                    </span>
                    <div className="w-full md:w-28 h-2 md:h-3 rounded-full bg-[#e6edf5] overflow-hidden shrink-0 relative">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${powerPercent}%`,
                          background:
                            powerPercent > 75
                              ? '#da3f4c'
                              : powerPercent > 45
                              ? '#ed7c08'
                              : '#2ba93c',
                        }}
                      />
                      {hintInfo && (
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_#ffd13b] z-10 -translate-x-1/2 pointer-events-none rounded-full"
                          style={{ left: `${hintInfo.powerPercent}%` }}
                          title={`Suggested Power: ${hintInfo.powerPercent}%`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Center Playfield + Right-Flank Action Column (PC) */}
          <div className="flex-1 w-full min-h-0 flex items-center gap-4">
            {/* 3D Gameplay Viewport Frame */}
            <div className="flex-1 h-full min-h-0 rounded-[24px] md:rounded-[28px] border-[3px] md:border-[4px] border-white shadow-[0_6px_20px_rgba(30,80,140,0.16)] bg-[#78eb46] overflow-hidden relative">
              <GolfSceneCanvas
                mode="play"
                course={activeCourse}
                ballSkin={activeBallSkin}
                rotateTrigger={rotateTrigger}
                hintTrigger={hintTrigger}
                retryTrigger={retryTrigger}
                onPowerChange={setPowerPercent}
                onStrokeIncrement={handleStrokeIncrement}
                onHoleComplete={handleHoleComplete}
                multiplayerState={mpState}
                onMultiplayerHoleFinish={handleMultiplayerHoleFinish}
                onHintInfo={setHintInfo}
              />

              {/* Intelligent AI Caddie / Shot Hint Floating Toast */}
              {hintInfo && (
                <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 md:px-4 md:py-2 bg-[#0f172a]/90 backdrop-blur-md rounded-full border border-amber-400/60 shadow-[0_4px_16px_rgba(0,0,0,0.35)] text-white text-[12px] md:text-[14px] font-display font-bold pointer-events-none transition-all animate-in fade-in zoom-in-95">
                  <span className="text-amber-400 text-sm md:text-base">💡</span>
                  <span className="text-amber-300">
                    {hintInfo.isHoleInOne ? 'Direct Sink Line' : 'Recommended Path'}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-500" />
                  <span className="text-white">
                    Power: <span className="text-amber-400 font-extrabold">{hintInfo.powerPercent}%</span>
                  </span>
                </div>
              )}

              {/* Turn Timeout Alert Toast */}
              {mpTimeoutNotice && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white font-display font-bold px-4 py-2 rounded-full shadow-2xl border-2 border-white text-xs md:text-sm animate-bounce flex items-center gap-2 pointer-events-none">
                  <Clock className="w-4 h-4 text-white" />
                  <span>{mpTimeoutNotice}</span>
                </div>
              )}

              {/* Floating Emotes Display (Disabled for now) */}
              {ENABLE_EMOTES && floatingEmotes.length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                  {floatingEmotes.map((e) => (
                    <div
                      key={e.id}
                      className={`absolute bottom-20 ${e.from === 'local' ? 'right-6 md:right-12' : 'left-6 md:left-12'} animate-bounce bg-white/95 px-3 py-1.5 rounded-2xl shadow-xl border-2 ${e.from === 'local' ? 'border-[#00e5ff]' : 'border-[#ff5722]'} flex items-center gap-2`}
                    >
                      <span className="text-2xl md:text-3xl">{e.emoji}</span>
                      <span className="text-[11px] font-black text-slate-700">{e.from === 'local' ? 'You' : 'Opponent'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Reactions Bar in Multiplayer (Disabled for now) */}
              {ENABLE_EMOTES && mpState.isMultiplayer && mpState.status === 'connected' && (
                <div className="absolute bottom-3 right-3 z-30 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-lg border border-slate-200/80 flex items-center gap-1.5">
                  {['👏', '🔥', '⛳', '🎉', '😂', '💀'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSendEmote(emoji)}
                      className="hover:scale-130 active:scale-95 transition-transform text-lg md:text-xl p-0.5 cursor-pointer"
                      title="Send reaction"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PC Right-Side Vertical Action Stack: Rotate | Hint (Single Player only) | Retry */}
            <div className="hidden lg:flex flex-col items-center justify-center gap-3.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setRotateTrigger((t) => t + 1);
                }}
                className="btn-3d-teal w-[74px] h-[74px] rounded-[20px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer"
                title={t.rotateTooltip}
              >
                <Camera className="w-6 h-6 stroke-[2.5]" />
                <span className="font-display font-bold text-[13px]">{t.rotate}</span>
              </button>

              {!mpState.isMultiplayer && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setHintTrigger((t) => t + 1);
                  }}
                  className="btn-3d-yellow w-[74px] h-[74px] rounded-[20px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer"
                  title={t.hintTooltip}
                >
                  <Lightbulb className="w-6 h-6 fill-white stroke-[2.2]" />
                  <span className="font-display font-bold text-[13px]">{t.hint}</span>
                </button>
              )}

              {!mpState.isMultiplayer && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    resetHoleCounters();
                    setRetryTrigger((t) => t + 1);
                  }}
                  className="btn-3d-red w-[74px] h-[74px] rounded-[20px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer"
                  title={t.retryTooltip}
                >
                  <RotateCcw className="w-6 h-6 stroke-[2.75]" />
                  <span className="font-display font-bold text-[13px]">{t.retry}</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile & Tablet Bottom Control Bar: Rotate | Hint (Single Player only) | Retry (Single Player only) (Hidden on PC) */}
          <div className={`w-full ${mpState.isMultiplayer ? 'max-w-[180px]' : 'max-w-[460px]'} mx-auto grid ${mpState.isMultiplayer ? 'grid-cols-1' : 'grid-cols-3'} gap-2.5 md:gap-4 shrink-0 pb-0.5 lg:hidden`}>
            {/* Rotate Button (Teal) */}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setRotateTrigger((t) => t + 1);
              }}
              className="btn-3d-teal h-[54px] md:h-[60px] rounded-[18px] md:rounded-[20px] flex items-center justify-center gap-2 md:gap-2.5 text-white cursor-pointer"
              title={t.rotateTooltip}
            >
              <Camera className="w-5 h-5 md:w-6 md:h-6 stroke-[2.5]" />
              <span className="font-display font-bold text-[15px] md:text-[17px]">{t.rotate}</span>
            </button>

            {/* Hint Button (Yellow - Single Player only) */}
            {!mpState.isMultiplayer && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setHintTrigger((t) => t + 1);
                }}
                className="btn-3d-yellow h-[54px] md:h-[60px] rounded-[18px] md:rounded-[20px] flex items-center justify-center gap-2 md:gap-2.5 text-white cursor-pointer"
                title={t.hintTooltip}
              >
                <Lightbulb className="w-5 h-5 md:w-6 md:h-6 fill-white stroke-[2.2]" />
                <span className="font-display font-bold text-[15px] md:text-[17px]">{t.hint}</span>
              </button>
            )}

            {/* Retry Button (Coral Red - Single Player only) */}
            {!mpState.isMultiplayer && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  resetHoleCounters();
                  setRetryTrigger((t) => t + 1);
                }}
                className="btn-3d-red h-[54px] md:h-[60px] rounded-[18px] md:rounded-[20px] flex items-center justify-center gap-2 md:gap-2.5 text-white cursor-pointer"
                title={t.retryTooltip}
              >
                <RotateCcw className="w-5 h-5 md:w-6 md:h-6 stroke-[2.75]" />
                <span className="font-display font-bold text-[15px] md:text-[17px]">{t.retry}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          4. MODALS (Settings, Balls, Help, Leaderboard, Victory)
      ================================================================= */}
      <SettingsModal
        isOpen={settingsOpen}
        language={language}
        musicEnabled={musicEnabled}
        sfxEnabled={sfxEnabled}
        onChangeLanguage={handleChangeLanguage}
        onToggleMusic={handleToggleMusic}
        onToggleSfx={handleToggleSfx}
        onResetProgress={handleResetProgress}
        onClose={() => setSettingsOpen(false)}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        onOpenAccount={() => setAccountOpen(true)}
      />

      <AccountModal
        isOpen={accountOpen}
        onClose={() => setAccountOpen(false)}
        playerName={playerName}
        onUpdatePlayerName={(name) => {
          setPlayerName(name);
          savePlayerName(name);
        }}
        avatarSeed={avatarSeed}
        onUpdateAvatarSeed={(seed) => {
          setAvatarSeed(seed);
          saveAvatarSeed(seed);
        }}
        totalStars={totalStars}
        currentHole={currentHoleNumber}
        selectedBallId={selectedBallId}
        holeStars={holeStars}
        syncStatus={syncStatus}
        onCloudProfileLoaded={(cloudProfile) => {
          if (cloudProfile.displayName) {
            setPlayerName(cloudProfile.displayName);
            savePlayerName(cloudProfile.displayName);
          }
          if (cloudProfile.avatarSeed) {
            setAvatarSeed(cloudProfile.avatarSeed);
            saveAvatarSeed(cloudProfile.avatarSeed);
          }
          if (cloudProfile.currentHole && cloudProfile.currentHole > 1) {
            setCurrentHoleNumber(cloudProfile.currentHole);
          }
          if (cloudProfile.selectedBallId) {
            setSelectedBallId(cloudProfile.selectedBallId);
          }
          if (cloudProfile.holeStars) {
            setHoleStars(cloudProfile.holeStars);
          }
        }}
      />

      <BallsModal
        isOpen={ballsOpen}
        language={language}
        selectedBallId={selectedBallId}
        totalStars={totalStars}
        onSelectBall={(skin) => {
          setSelectedBallId(skin.id);
          try {
            localStorage.setItem('minigolf_ball_id', skin.id);
          } catch {}
          multiplayerManager.setLocalPlayer(playerName, skin.id, avatarSeed);
        }}
        onClose={() => setBallsOpen(false)}
      />

      <HelpModal
        isOpen={helpOpen}
        language={language}
        onClose={() => setHelpOpen(false)}
      />

      <LeaderboardModal
        isOpen={leaderboardOpen}
        language={language}
        initialHoleNumber={leaderboardHoleTarget}
        leaderboards={leaderboards}
        playerName={playerName}
        avatarSeed={avatarSeed}
        totalStars={totalStars}
        highlightEntryId={highlightEntryId}
        onChangePlayerName={(newName) => {
          setPlayerName(newName);
          savePlayerName(newName);
        }}
        onPlayHole={(holeNum) => {
          setLeaderboardOpen(false);
          startHole(holeNum);
        }}
        onClose={() => setLeaderboardOpen(false)}
      />

      <HoleCompleteModal
        isOpen={victoryOpen}
        language={language}
        holeNumber={activeCourse.holeNumber}
        strokes={strokes}
        par={activeCourse.par}
        timeMs={completedTimeMs}
        starsEarned={lastEarnedStars}
        bestRank={lastBestRank}
        isNextHoleUnlocked={
          activeCourse.holeNumber < 30
            ? isHoleUnlocked(activeCourse.holeNumber + 1, holeStars)
            : false
        }
        nextHoleLockReason={
          activeCourse.holeNumber < 30
            ? getHoleLockReason(activeCourse.holeNumber + 1, holeStars)
            : null
        }
        onHome={() => {
          resetHoleCounters();
          setScreen('menu');
        }}
        onRetry={() => {
          resetHoleCounters();
          setRetryTrigger((t) => t + 1);
        }}
        onHolesMenu={() => {
          resetHoleCounters();
          setSelectedWorldIndex(activeCourse.worldIndex);
          setScreen('holes');
        }}
        onNextHole={() => {
          const nextNum = activeCourse.holeNumber < 30 ? activeCourse.holeNumber + 1 : 1;
          if (isHoleUnlocked(nextNum, holeStars)) {
            startHole(nextNum);
          } else {
            resetHoleCounters();
            setSelectedWorldIndex(activeCourse.worldIndex);
            setScreen('holes');
          }
        }}
      />

      <PausedModal
        isOpen={pausedOpen}
        onResume={() => setPausedOpen(false)}
        onRetry={() => {
          setPausedOpen(false);
          resetHoleCounters();
          setRetryTrigger((t) => t + 1);
        }}
        onHome={() => {
          setPausedOpen(false);
          resetHoleCounters();
          setScreen('menu');
        }}
      />

      <MultiplayerModal
        isOpen={multiplayerOpen}
        onClose={() => setMultiplayerOpen(false)}
        selectedBallId={selectedBallId}
        playerName={playerName}
        avatarSeed={avatarSeed}
        startingHoleNumber={currentHoleNumber}
        onSelectStartingHole={(holeNum) => {
          currentHoleNumberRef.current = holeNum;
          setCurrentHoleNumber(holeNum);
        }}
        onStartMatch={() => {
          const st = multiplayerManager.getState();
          if (st.holeNumber) {
            currentHoleNumberRef.current = st.holeNumber;
            setCurrentHoleNumber(st.holeNumber);
          }
          setMultiplayerOpen(false);
          setScreen('play');
          setRetryTrigger((t) => t + 1);
        }}
      />

      {/* Multiplayer Hole Complete Banner */}
      {mpHoleResult !== null && !mpState.matchWinner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] p-6 max-w-sm w-full shadow-2xl border-4 border-[#00e5ff] text-center flex flex-col items-center gap-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">
              ⛳
            </div>
            <div>
              <h2 className="font-display font-black text-2xl text-slate-800">
                {mpHoleResult.winner === 'tie'
                  ? 'Hole Tied!'
                  : mpHoleResult.winner === (mpState.isHost ? 'p1' : 'p2')
                  ? 'You Won The Hole! 🎉'
                  : 'Opponent Won The Hole!'}
              </h2>
              <p className="text-sm font-bold text-slate-500 mt-1">
                P1: {mpHoleResult.p1Strokes} strokes • P2: {mpHoleResult.p2Strokes} strokes
              </p>
            </div>
            <div className="bg-slate-100 rounded-2xl px-6 py-2.5 flex items-center gap-6 font-display font-black text-lg">
              <span className="text-[#0077b6]">P1: {mpState.p1HolesWon}</span>
              <span className="text-slate-400">vs</span>
              <span className="text-[#d84315]">P2: {mpState.p2HolesWon}</span>
            </div>
            <p className="text-xs text-slate-400 font-bold animate-pulse">
              Next hole starting in a moment...
            </p>
          </div>
        </div>
      )}

      {/* Multiplayer Match Victory Modal */}
      {mpState.matchWinner !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[32px] p-7 max-w-md w-full shadow-2xl border-4 border-[#ffd700] text-center flex flex-col items-center gap-5 animate-in zoom-in-90">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center text-4xl shadow-inner">
              🏆
            </div>
            <div>
              <h2 className="font-display font-black text-2xl md:text-3xl text-slate-800 leading-tight">
                {mpState.matchWinner === 'tie'
                  ? 'Match Tied!'
                  : mpState.matchWinner === (mpState.isHost ? 'p1' : 'p2')
                  ? (mpState.opponentSurrendered ? 'You Won!\nOpponent Surrendered 🏆' : 'CHAMPION VICTORY! 👑')
                  : 'Opponent Won Match!'}
              </h2>
              <p className="text-sm font-bold text-slate-600 mt-1">
                {mpState.opponentSurrendered
                  ? 'Opponent left the match early'
                  : `Final Match Score (Best of ${mpState.matchHoles})`}
              </p>
            </div>

            <div className="w-full bg-slate-100 rounded-2xl p-4 flex items-center justify-around font-display font-black text-2xl">
              <div className="flex flex-col items-center">
                <UserAvatar
                  seed={mpState.isHost ? mpState.localPlayer.avatarSeed : mpState.remotePlayer?.avatarSeed || 'Host'}
                  size={46}
                  className="mb-1 border-2 border-blue-400 shadow-sm"
                />
                <span className="text-xs text-slate-500 font-bold uppercase truncate max-w-[90px]">
                  {mpState.isHost ? mpState.localPlayer.name : mpState.remotePlayer?.name || 'Player 1'}
                </span>
                <span className="text-[#0077b6]">{mpState.p1HolesWon}</span>
              </div>
              <span className="text-slate-300 text-xl font-bold">-</span>
              <div className="flex flex-col items-center">
                <UserAvatar
                  seed={!mpState.isHost ? mpState.localPlayer.avatarSeed : mpState.remotePlayer?.avatarSeed || 'Guest'}
                  size={46}
                  className="mb-1 border-2 border-red-400 shadow-sm"
                />
                <span className="text-xs text-slate-500 font-bold uppercase truncate max-w-[90px]">
                  {!mpState.isHost ? mpState.localPlayer.name : mpState.remotePlayer?.name || 'Player 2'}
                </span>
                <span className="text-[#d84315]">{mpState.p2HolesWon}</span>
              </div>
            </div>

            <div className="w-full flex items-center gap-3 pt-2">
              {!mpState.opponentSurrendered && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    const startHole = 1;
                    multiplayerManager.sendRematch(startHole);
                    setMpHoleResult(null);
                    currentHoleNumberRef.current = startHole;
                    setCurrentHoleNumber(startHole);
                    setRetryTrigger((t) => t + 1);
                  }}
                  className="btn-3d-green flex-1 py-3 rounded-full font-display font-bold text-white text-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-5 h-5 stroke-[2.5]" /> Rematch
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  multiplayerManager.disconnect();
                  setMpHoleResult(null);
                  setScreen('menu');
                }}
                className="btn-3d-blue flex-1 py-3 rounded-full font-display font-bold text-white text-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Surrender Confirmation Modal */}
      {surrenderConfirmOpen && (
        <GameModal
          title="Surrender?"
          onClose={() => setSurrenderConfirmOpen(false)}
          maxWidth="370px"
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSurrenderConfirmOpen(false);
                }}
                className="btn-3d-purple flex-1 py-2.5 rounded-xl font-display font-bold text-white text-sm cursor-pointer"
              >
                Keep Playing
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSurrenderConfirmOpen(false);
                  multiplayerManager.surrenderMatch();
                  setMpHoleResult(null);
                  setScreen('menu');
                }}
                className="btn-3d-red flex-1 py-2.5 rounded-xl font-display font-bold text-white text-sm cursor-pointer"
              >
                Surrender
              </button>
            </>
          }
        >
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3 shadow-xs">
              <Flag className="w-7 h-7 stroke-[2.5]" />
            </div>
            <p className="text-xs font-bold text-[#51336d] max-w-[270px]">
              Leaving now will forfeit the game. Your opponent will be awarded the win.
            </p>
          </div>
        </GameModal>
      )}
    </div>
  );
}
