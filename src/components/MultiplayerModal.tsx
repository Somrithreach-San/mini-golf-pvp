import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  RotateCcw,
  Trophy,
  Flag,
} from 'lucide-react';
import { multiplayerManager, MultiplayerState } from '../multiplayer/MultiplayerManager';
import { ALL_HOLES, GOLF_WORLDS } from '../data/courses';
import { UserAvatar } from './UserAvatar';
import { getSavedAvatarSeed } from '../data/userProfile';
import { soundEngine } from '../audio/soundEngine';
import { GameModal } from './GameModals';

interface MultiplayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartMatch: () => void;
  selectedBallId?: string;
  playerName?: string;
  avatarSeed?: string;
  startingHoleNumber?: number;
  onSelectStartingHole?: (holeNum: number) => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  onStartMatch,
  selectedBallId,
  playerName,
  avatarSeed,
  startingHoleNumber = 1,
  onSelectStartingHole,
}) => {
  const [tab, setTab] = useState<'host' | 'join'>('host');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [codeChars, setCodeChars] = useState<string[]>(['', '', '', '']);
  const codeRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const activePlayerName = playerName || localStorage.getItem('minigolf_player_name') || 'Golfer';
  const activeAvatarSeed = avatarSeed || getSavedAvatarSeed();
  const ballSkin = selectedBallId || localStorage.getItem('minigolf_ball_id') || 'golf';
  const [matchHoles, setMatchHoles] = useState<number>(3);
  const [startHoleNumber, setStartHoleNumber] = useState<number>(startingHoleNumber || 1);
  const [copied, setCopied] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [mpState, setMpState] = useState<MultiplayerState>(multiplayerManager.getState());

  useEffect(() => {
    return multiplayerManager.subscribe((state) => {
      setMpState(state);
      if (state.status === 'connected' && state.holeNumber) {
        setStartHoleNumber(state.holeNumber);
      }
    });
  }, []);

  const handleCreateRoom = async () => {
    soundEngine.playClick();
    setIsBusy(true);
    multiplayerManager.setLocalPlayer(activePlayerName, ballSkin, activeAvatarSeed);
    try {
      await multiplayerManager.createRoom(matchHoles, startHoleNumber);
    } catch (e) {
      console.error(e);
    } finally {
      setIsBusy(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...codeChars];
    next[idx] = digit;
    setCodeChars(next);
    const joined = next.join('');
    setRoomCodeInput(joined);

    if (digit && idx < 3) {
      codeRefs[idx + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeChars[idx] && idx > 0) {
      codeRefs[idx - 1].current?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      codeRefs[idx - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && idx < 3) {
      codeRefs[idx + 1].current?.focus();
    } else if (e.key === 'Enter' && roomCodeInput.length === 4) {
      handleJoinRoom();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
    if (pasted.length > 0) {
      const next = ['', '', '', ''];
      for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
      setCodeChars(next);
      setRoomCodeInput(next.join(''));
      const focusIdx = Math.min(pasted.length, 3);
      codeRefs[focusIdx].current?.focus();
      e.preventDefault();
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    soundEngine.playClick();
    setIsBusy(true);
    multiplayerManager.setLocalPlayer(activePlayerName, ballSkin, activeAvatarSeed);
    try {
      await multiplayerManager.joinRoom(roomCodeInput.trim());
    } catch (e) {
      console.error(e);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyCode = () => {
    soundEngine.playClick();
    if (mpState.roomCode) {
      navigator.clipboard.writeText(mpState.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartHostGame = () => {
    soundEngine.playClick();
    multiplayerManager.sendStartMatch();
    onStartMatch();
  };

  const handleDisconnect = () => {
    soundEngine.playClick();
    multiplayerManager.disconnect();
  };

  if (!isOpen) return null;

  const modalTitle =
    mpState.status === 'hosting'
      ? 'Room Ready!'
      : mpState.status === 'connected'
      ? 'Match Lobby'
      : 'Online 2-Player';

  return (
    <GameModal
      title={modalTitle}
      onClose={onClose}
      maxWidth="430px"
    >
      {/* ── STATE 1: HOSTING & WAITING FOR OPPONENT ─────────────── */}
      {mpState.status === 'hosting' ? (
        <div className="flex flex-col items-center text-center py-1">
          <p className="text-[12px] font-extrabold text-[#7d36c8] mb-4">
            Share this code with your friend to play
          </p>

          {/* Room Passcode Diorama Box */}
          <div className="w-full ui-card p-4 shadow-[0_4px_0_#d5c2e6] mb-4 flex flex-col items-center">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#7d36c8] mb-1">
              Room Passcode
            </span>
            <div className="text-4xl font-display font-black tracking-widest text-[#51336d] font-mono my-1 select-all">
              {mpState.roomCode}
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="btn-3d-purple rounded-xl px-5 py-2 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer mt-2"
            >
              {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Code Copied!' : 'Copy Code'}
            </button>
          </div>

          {/* Pulsing Status Bar */}
          <div className="w-full ui-card p-3 flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-[#7d36c8] animate-spin">
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="text-left">
                <div className="text-xs font-extrabold text-[#51336d]">Waiting for Opponent…</div>
                <div className="text-[10px] font-bold text-[#9b83b3]">Keep this screen open</div>
              </div>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-[#7d36c8] animate-ping mr-1" />
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            className="btn-3d-red rounded-xl px-6 py-2.5 text-white font-display font-bold text-sm cursor-pointer"
          >
            Cancel Hosting
          </button>
        </div>
      ) : mpState.status === 'connected' ? (
        /* ── STATE 2: CONNECTED & READY TO TEE OFF ─────────────── */
        <div className="flex flex-col items-center text-center py-1">
          <p className="text-[12px] font-extrabold text-[#7d36c8] mb-4">
            Both players connected!
          </p>

          <div className="w-full flex items-center justify-between gap-3 mb-4">
            {/* Host Card */}
            <div className="ui-player-card is-active flex-1 p-3 rounded-2xl flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-[#7d36c8] mb-1">Host (P1)</span>
              <UserAvatar seed={mpState.isHost ? activeAvatarSeed : (mpState.remotePlayer?.avatarSeed || 'P1')} size={42} />
              <span className="font-display font-bold text-xs text-[#51336d] mt-1.5 truncate max-w-[90px]">
                {mpState.isHost ? `${activePlayerName} (You)` : (mpState.remotePlayer?.name || 'Player 1')}
              </span>
            </div>

            <div className="font-display font-black text-xl text-[#7d36c8]">VS</div>

            {/* Guest Card */}
            <div className="ui-player-card is-active flex-1 p-3 rounded-2xl flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-[#ed7c08] mb-1">Guest (P2)</span>
              <UserAvatar seed={!mpState.isHost ? activeAvatarSeed : (mpState.remotePlayer?.avatarSeed || 'P2')} size={42} />
              <span className="font-display font-bold text-xs text-[#51336d] mt-1.5 truncate max-w-[90px]">
                {!mpState.isHost ? `${activePlayerName} (You)` : (mpState.remotePlayer?.name || 'Player 2')}
              </span>
            </div>
          </div>

          {/* Match Config summary */}
          <div className="w-full ui-card p-3 flex items-center justify-around text-xs font-bold text-[#51336d] mb-4">
            <div>Starting: <span className="text-[#7d36c8] font-extrabold">Hole {startHoleNumber}</span></div>
            <div className="w-px h-4 bg-purple-200" />
            <div>Length: <span className="text-[#ed7c08] font-extrabold">{matchHoles} Holes</span></div>
          </div>

          {mpState.isHost ? (
            <button
              type="button"
              onClick={handleStartHostGame}
              className="btn-3d-orange rounded-2xl w-full py-3 text-white font-display font-bold text-lg flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Play className="w-5 h-5 fill-white" />
              Tee Off! (Start Match)
            </button>
          ) : (
            <div className="w-full py-3 px-4 bg-purple-50 border border-purple-200 rounded-2xl text-[#7d36c8] text-xs font-bold flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#7d36c8] animate-ping" />
              Waiting for host to tee off…
            </div>
          )}

          <button
            type="button"
            onClick={handleDisconnect}
            className="text-xs font-extrabold text-[#9b83b3] hover:text-red-500 mt-3 transition-colors cursor-pointer"
          >
            Leave Match
          </button>
        </div>
      ) : (
        /* ── STATE 3: IDLE / HOST & JOIN SETUP ────────────────────── */
        <div className="flex flex-col py-1">
          {/* Segmented Mode Selector (Host vs Join) */}
          <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200 mb-4">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setTab('host');
              }}
              className={`flex-1 py-1.5 px-3 rounded-full text-[13px] font-extrabold transition-all cursor-pointer ${
                tab === 'host'
                  ? 'bg-[#7d36c8] text-white shadow-xs'
                  : 'text-[#51336d] hover:text-[#7d36c8]'
              }`}
            >
              Host Match
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                setTab('join');
              }}
              className={`flex-1 py-1.5 px-3 rounded-full text-[13px] font-extrabold transition-all cursor-pointer ${
                tab === 'join'
                  ? 'bg-[#7d36c8] text-white shadow-xs'
                  : 'text-[#51336d] hover:text-[#7d36c8]'
              }`}
            >
              Join Match
            </button>
          </div>

          {tab === 'host' ? (
            <div className="flex flex-col">
              {/* Row 1: Starting Hole */}
              <div className="py-2.5 border-b-2 border-dashed border-[#e6d9f0]">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#7d36c8] flex items-center justify-center text-white shadow-xs shrink-0">
                    <Flag className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold text-[#51336d] leading-none">
                      Starting Hole
                    </div>
                    <div className="text-[11px] font-bold text-[#9b83b3] mt-0.5">
                      Choose your opening course
                    </div>
                  </div>
                </div>

                <select
                  value={startHoleNumber}
                  onChange={(e) => {
                    soundEngine.playClick();
                    const num = Number(e.target.value);
                    setStartHoleNumber(num);
                    onSelectStartingHole?.(num);
                  }}
                  aria-label="Select Starting Hole"
                  className="ui-field text-xs font-extrabold text-[#51336d] cursor-pointer outline-none"
                >
                  {ALL_HOLES.map((hole) => {
                    const world = GOLF_WORLDS[hole.worldIndex];
                    return (
                      <option key={hole.holeNumber} value={hole.holeNumber}>
                        Hole {hole.holeNumber}: {hole.name} ({world?.name || 'World'}) • Par {hole.par}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Row 2: Match Length */}
              <div className="py-2.5 border-b-2 border-dashed border-[#e6d9f0] mb-3.5">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-[#f2930a] flex items-center justify-center text-white shadow-xs shrink-0">
                    <Trophy className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold text-[#51336d] leading-none">
                      Match Length
                    </div>
                    <div className="text-[11px] font-bold text-[#9b83b3] mt-0.5">
                      Number of consecutive holes
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { holes: 3, label: '3 Holes', desc: 'Quick' },
                    { holes: 5, label: '5 Holes', desc: 'Tour' },
                    { holes: 9, label: '9 Holes', desc: 'Full' },
                  ].map((item) => {
                    const isSelected = matchHoles === item.holes;
                    return (
                      <button
                        key={item.holes}
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setMatchHoles(item.holes);
                        }}
                        className={`py-2 px-1 rounded-xl border-2 flex flex-col items-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#7d36c8] bg-[#f8f2fd] shadow-xs ring-1 ring-[#7d36c8]'
                            : 'border-[#e6d9f0] bg-white hover:border-purple-300'
                        }`}
                      >
                        <span
                          className={`font-display font-bold text-xs leading-none ${
                            isSelected ? 'text-[#7d36c8]' : 'text-[#51336d]'
                          }`}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] font-extrabold text-[#9b83b3] mt-0.5">
                          {item.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Create Room Button */}
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={isBusy}
                className="btn-3d-orange rounded-2xl w-full py-3 text-white font-display font-bold text-lg flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-white shrink-0" />
                {isBusy ? 'Creating Room…' : 'Create Match Room'}
              </button>
            </div>
          ) : (
            /* Join Room View */
            <div className="flex flex-col py-1">
              <div className="flex flex-col items-center mb-4">
                <span className="text-[13px] font-extrabold text-[#51336d] mb-3">
                  Enter 4-Digit Room Code
                </span>

                {/* OTP Code Boxes */}
                <div className="flex items-center gap-2.5" onPaste={handleOtpPaste}>
                  {codeChars.map((ch, idx) => (
                    <input
                      key={idx}
                      ref={codeRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={ch}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onFocus={(e) => e.target.select()}
                      className={`w-14 h-16 rounded-2xl border-2 text-center font-display font-black text-2xl outline-none transition-all cursor-text ${
                        ch
                          ? 'border-[#7d36c8] bg-[#f6edff] text-[#51336d] shadow-[0_3px_0_#d5c2e6]'
                          : 'border-[#ded0ea] bg-white text-transparent focus:border-[#7d36c8] focus:bg-white focus:shadow-[0_3px_0_#d5c2e6]'
                      }`}
                      placeholder="·"
                      style={{ caretColor: '#7d36c8' }}
                    />
                  ))}
                </div>

                <p className="text-[11px] font-bold text-[#9b83b3] mt-2.5">
                  Ask your friend for the 4-digit code shown on their screen
                </p>
              </div>

              {mpState.errorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl p-2.5 text-center mb-3">
                  {mpState.errorMessage}
                </div>
              )}

              {/* Join Button */}
              <button
                type="button"
                onClick={handleJoinRoom}
                disabled={isBusy || roomCodeInput.trim().length < 4}
                className="btn-3d-purple rounded-2xl w-full py-3 text-white font-display font-bold text-lg flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Users className="w-5 h-5 shrink-0" />
                {isBusy ? 'Connecting…' : 'Join Match Room'}
              </button>
            </div>
          )}
        </div>
      )}
    </GameModal>
  );
};
