import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Copy,
  Check,
  Play,
  RotateCcw,
  X,
  Trophy,
  Flag,
  Radio,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { multiplayerManager, MultiplayerState } from '../multiplayer/MultiplayerManager';
import { ALL_HOLES, GOLF_WORLDS } from '../data/courses';
import { UserAvatar } from './UserAvatar';
import { getSavedAvatarSeed } from '../data/userProfile';
import { soundEngine } from '../audio/soundEngine';

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
    if (startingHoleNumber) {
      setStartHoleNumber(startingHoleNumber);
    }
  }, [startingHoleNumber]);

  useEffect(() => {
    return multiplayerManager.subscribe((state) => {
      setMpState(state);
    });
  }, []);

  useEffect(() => {
    return multiplayerManager.onStartMatch(() => {
      onStartMatch();
    });
  }, [onStartMatch]);

  const handleCreateRoom = async () => {
    soundEngine.playClick();
    setIsBusy(true);
    multiplayerManager.setLocalPlayer(activePlayerName, ballSkin, activeAvatarSeed);
    try {
      await multiplayerManager.createRoom(matchHoles, startHoleNumber);
      onSelectStartingHole?.(startHoleNumber);
    } catch (e) {
      console.error(e);
    } finally {
      setIsBusy(false);
    }
  };

  const handleOtpChange = (idx: number, val: string) => {
    const ch = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...codeChars];
    next[idx] = ch;
    setCodeChars(next);
    const joined = next.join('');
    setRoomCodeInput(joined);
    if (ch && idx < 3) {
      codeRefs[idx + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (codeChars[idx]) {
        // Clear current cell
        const next = [...codeChars];
        next[idx] = '';
        setCodeChars(next);
        setRoomCodeInput(next.join(''));
      } else if (idx > 0) {
        // Move back and clear previous cell
        const next = [...codeChars];
        next[idx - 1] = '';
        setCodeChars(next);
        setRoomCodeInput(next.join(''));
        codeRefs[idx - 1].current?.focus();
      }
      e.preventDefault();
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
    if (!roomCodeInput.trim()) return;    soundEngine.playClick();
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3.5 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[28px] w-full max-w-[395px] md:max-w-[430px] p-5 md:p-6 shadow-[0_12px_0_rgba(0,0,0,0.14),0_20px_40px_rgba(0,0,0,0.28)] flex flex-col relative max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Close Button */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* ── STATE 1: HOSTING & WAITING FOR OPPONENT ─────────────── */}
        {mpState.status === 'hosting' ? (
          <div className="flex flex-col items-center text-center py-1">
            <h2 className="font-display text-[28px] font-bold text-[#2ecc71] mb-1 tracking-tight">
              Room Ready!
            </h2>
            <p className="text-[12px] font-extrabold text-slate-500 mb-4">
              Share this code with your friend to play
            </p>

            {/* Room Passcode Diorama Box */}
            <div className="w-full bg-[#f1f8ff] border-2 border-[#b8dcff] rounded-2xl p-4 shadow-[0_4px_0_rgba(143,192,235,0.65)] mb-4 flex flex-col items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700 mb-1">
                Room Passcode
              </span>
              <div className="text-4xl font-display font-black tracking-widest text-[#163a5f] font-mono my-1 select-all">
                {mpState.roomCode}
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="btn-3d-blue rounded-full px-5 py-1.5 text-white font-display font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Code Copied!' : 'Copy Code'}
              </button>
            </div>

            {/* Pulsing Status Bar */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-spin">
                  <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-extrabold text-[#163a5f]">Waiting for Opponent…</div>
                  <div className="text-[10px] font-bold text-slate-400">Keep this screen open</div>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mr-1" />
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={handleDisconnect}
              className="btn-3d-red rounded-full px-8 py-2.5 text-white font-display font-bold text-sm cursor-pointer"
            >
              Cancel Room
            </button>
          </div>
        ) : mpState.status === 'connected' ? (
          /* ── STATE 2: MATCH CONNECTED & READY TO TEE OFF ─────────── */
          <div className="flex flex-col items-center text-center py-1">
            <h2 className="font-display text-[28px] font-bold text-[#2ecc71] mb-1 tracking-tight">
              Match Ready!
            </h2>
            <p className="text-[12px] font-extrabold text-slate-500 mb-4">
              Both golfers are connected & ready
            </p>

            {/* Opponents Versus Card */}
            <div className="w-full grid grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 mb-3.5">
              <div className="p-3 bg-white rounded-xl shadow-xs border border-sky-100 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase text-[#2f80ed] tracking-wider">
                  Player 1 (Host)
                </span>
                <UserAvatar
                  seed={mpState.isHost ? mpState.localPlayer.avatarSeed : mpState.remotePlayer?.avatarSeed || 'Host'}
                  size={46}
                  showBorder={false}
                />
                <span className="text-xs font-black text-[#163a5f] truncate max-w-full">
                  {mpState.isHost ? `${mpState.localPlayer.name} (You)` : mpState.remotePlayer?.name || 'Player 1'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-xl shadow-xs border border-rose-100 flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-extrabold uppercase text-rose-500 tracking-wider">
                  Player 2 (Guest)
                </span>
                <UserAvatar
                  seed={!mpState.isHost ? mpState.localPlayer.avatarSeed : mpState.remotePlayer?.avatarSeed || 'Guest'}
                  size={46}
                  showBorder={false}
                />
                <span className="text-xs font-black text-[#163a5f] truncate max-w-full">
                  {!mpState.isHost ? `${mpState.localPlayer.name} (You)` : mpState.remotePlayer?.name || 'Player 2'}
                </span>
              </div>
            </div>

            {/* Course Information Banner */}
            <div className="w-full bg-[#f1f8ff] border border-sky-200 rounded-xl px-3 py-2 mb-4 flex items-center justify-center gap-2 text-xs font-extrabold text-[#163a5f]">
              <span>⛳ Starting Course:</span>
              <span className="text-[#2ecc71]">
                Hole {mpState.holeNumber || startHoleNumber} (
                {ALL_HOLES.find((h) => h.holeNumber === (mpState.holeNumber || startHoleNumber))?.name || 'Meadow'}
                )
              </span>
            </div>

            {/* Action Buttons */}
            {mpState.isHost ? (
              <button
                type="button"
                onClick={handleStartHostGame}
                className="btn-3d-green rounded-full w-full py-3 text-white font-display font-bold text-[18px] flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Play className="w-5 h-5 fill-white" />
                Tee Off! (Start Match)
              </button>
            ) : (
              <div className="w-full py-3 px-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                Waiting for host to tee off…
              </div>
            )}

            <button
              type="button"
              onClick={handleDisconnect}
              className="text-xs font-extrabold text-slate-400 hover:text-red-500 mt-3 transition-colors cursor-pointer"
            >
              Leave Match
            </button>
          </div>
        ) : (
          /* ── STATE 3: IDLE / HOST & JOIN SETUP ────────────────────── */
          <div className="flex flex-col py-1">
            <h2 className="font-display text-[28px] font-bold text-[#2ecc71] text-center mb-1 tracking-tight">
              Match Room
            </h2>
            <p className="text-[12px] font-extrabold text-slate-500 text-center mb-3.5">
              Real-time 2-Player Mini Golf PvP
            </p>

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
                    ? 'bg-[#37d062] text-white shadow-xs'
                    : 'text-[#163a5f] hover:text-[#2ecc71]'
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
                    ? 'bg-[#37d062] text-white shadow-xs'
                    : 'text-[#163a5f] hover:text-[#2ecc71]'
                }`}
              >
                Join Match
              </button>
            </div>

            {tab === 'host' ? (
              <div className="flex flex-col">
                {/* Row 1: Starting Hole */}
                <div className="py-2.5 border-b-2 border-dashed border-slate-200">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-[#2f80ed] flex items-center justify-center text-white shadow-xs shrink-0">
                      <Flag className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold text-[#163a5f] leading-none">
                        Starting Hole
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 mt-0.5">
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
                    className="w-full bg-[#f1f8ff] border border-sky-200 rounded-xl px-3 py-2 text-xs font-extrabold text-[#163a5f] cursor-pointer outline-none shadow-xs"
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
                <div className="py-2.5 border-b-2 border-dashed border-slate-200 mb-3.5">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-xl bg-[#f59f00] flex items-center justify-center text-white shadow-xs shrink-0">
                      <Trophy className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold text-[#163a5f] leading-none">
                        Match Length
                      </div>
                      <div className="text-[11px] font-bold text-slate-400 mt-0.5">
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
                              ? 'border-[#2ecc71] bg-[#f0fdf4] shadow-xs'
                              : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
                          }`}
                        >
                          <span
                            className={`font-display font-bold text-xs leading-none ${
                              isSelected ? 'text-[#2ecc71]' : 'text-[#163a5f]'
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-400 mt-0.5">
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
                  className="btn-3d-green rounded-full w-full py-3 text-white font-display font-bold text-[18px] flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-white shrink-0" />
                  {isBusy ? 'Creating Room…' : 'Create Match Room'}
                </button>
              </div>
            ) : (
              /* Join Room View */
              <div className="flex flex-col py-1">
                <div className="flex flex-col items-center mb-4">
                  <span className="text-[13px] font-extrabold text-[#163a5f] mb-3">
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
                        className={`w-14 h-16 rounded-2xl border-2 text-center font-display font-black text-2xl outline-none transition-all cursor-text shadow-[0_3px_0_rgba(143,192,235,0.6)] ${
                          ch
                            ? 'border-[#2f80ed] bg-[#e8f4ff] text-[#163a5f] shadow-[0_3px_0_rgba(47,128,237,0.4)]'
                            : 'border-sky-200 bg-[#f1f8ff] text-transparent focus:border-[#2f80ed] focus:bg-white focus:shadow-[0_3px_0_rgba(47,128,237,0.4)]'
                        }`}
                        placeholder="·"
                        style={{ caretColor: '#2f80ed' }}
                      />
                    ))}
                  </div>

                  <p className="text-[11px] font-bold text-slate-400 mt-2.5">
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
                  className="btn-3d-blue rounded-full w-full py-3 text-white font-display font-bold text-[18px] flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <Users className="w-5 h-5 shrink-0" />
                  {isBusy ? 'Connecting…' : 'Join Match Room'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
