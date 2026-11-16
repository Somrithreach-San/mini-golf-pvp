import { Peer, DataConnection } from 'peerjs';
import { BallPhysicsState } from '../physics/golfPhysics';
import { getSavedAvatarSeed, saveAvatarSeed } from '../data/userProfile';

export type MultiplayerStatus =
  | 'idle'
  | 'hosting'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export type TurnPlayer = 'p1' | 'p2';

export interface PlayerProfile {
  name: string;
  ballSkinId: string;
  avatarSeed: string;
}

export interface BallSyncData {
  x: number;
  z: number;
  vx: number;
  vz: number;
  isMoving: boolean;
  isSunk: boolean;
  sinkProgress: number;
}

export interface MultiplayerMessage {
  type:
    | 'JOIN'
    | 'INIT_MATCH'
    | 'START_MATCH'
    | 'AIM'
    | 'CANCEL_AIM'
    | 'STROKE'
    | 'SYNC'
    | 'HOLE_COMPLETE'
    | 'NEXT_HOLE'
    | 'MATCH_COMPLETE'
    | 'REMATCH'
    | 'SURRENDER'
    | 'TURN_TIMEOUT'
    | 'EMOTE';
  payload?: any;
}

export interface MultiplayerState {
  isMultiplayer: boolean;
  isHost: boolean;
  status: MultiplayerStatus;
  roomCode: string;
  localPlayer: PlayerProfile;
  remotePlayer: PlayerProfile | null;
  currentTurn: TurnPlayer;
  p1Strokes: number;
  p2Strokes: number;
  p1HolesWon: number;
  p2HolesWon: number;
  ties: number;
  matchHoles: number;
  holeIndex: number;
  holeNumber: number;
  matchWinner: 'p1' | 'p2' | 'tie' | null;
  opponentSurrendered?: boolean;
  turnTimeRemaining: number;
  turnDuration: number;
  errorMessage?: string;
  lastEmote?: { emoji: string; from: 'local' | 'remote'; id: number };
}

type StateListener = (state: MultiplayerState) => void;
type RemoteAimListener = (aim: { dirX: number; dirZ: number; power: number } | null) => void;
type RemoteStrokeListener = (stroke: { dirX: number; dirZ: number; power: number }) => void;
type RemoteEmoteListener = (emoji: string) => void;
type SyncListener = (data: { b1: BallSyncData; b2: BallSyncData; currentTurn: TurnPlayer; holeNumber?: number; turnTimeRemaining?: number }) => void;
type HoleCompleteListener = (payload: { winner: 'p1' | 'p2' | 'tie'; p1Strokes: number; p2Strokes: number; nextHoleNumber: number }) => void;
type NextHoleListener = (payload: { holeNumber: number; holeIndex: number }) => void;
type TimeoutListener = (timedOutPlayer: TurnPlayer) => void;

class MultiplayerManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private stateListeners: Set<StateListener> = new Set();
  private aimListeners: Set<RemoteAimListener> = new Set();
  private strokeListeners: Set<RemoteStrokeListener> = new Set();
  private emoteListeners: Set<RemoteEmoteListener> = new Set();
  private syncListeners: Set<SyncListener> = new Set();
  private startMatchListeners: Set<() => void> = new Set();
  private holeCompleteListeners: Set<HoleCompleteListener> = new Set();
  private nextHoleListeners: Set<NextHoleListener> = new Set();
  private timeoutListeners: Set<TimeoutListener> = new Set();
  private lastTimerNotify: number = 0;

  private state: MultiplayerState = {
    isMultiplayer: false,
    isHost: false,
    status: 'idle',
    roomCode: '',
    localPlayer: {
      name: 'Player 1',
      ballSkinId: 'golf',
      avatarSeed: 'Ace10',
    },
    remotePlayer: null,
    currentTurn: 'p1',
    p1Strokes: 0,
    p2Strokes: 0,
    p1HolesWon: 0,
    p2HolesWon: 0,
    ties: 0,
    matchHoles: 3,
    holeIndex: 0,
    holeNumber: 1,
    matchWinner: null,
    turnTimeRemaining: 35,
    turnDuration: 35,
  };

  constructor() {
    // Load local player preferences
    try {
      const savedName = localStorage.getItem('minigolf_player_name');
      const savedSkin = localStorage.getItem('minigolf_ball_id') || localStorage.getItem('minigolf_selected_ball');
      const savedSeed = getSavedAvatarSeed();
      if (savedName) this.state.localPlayer.name = savedName;
      if (savedSkin) this.state.localPlayer.ballSkinId = savedSkin;
      this.state.localPlayer.avatarSeed = savedSeed;
    } catch {}
  }

  public getState(): MultiplayerState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  public onRemoteAim(listener: RemoteAimListener): () => void {
    this.aimListeners.add(listener);
    return () => this.aimListeners.delete(listener);
  }

  public onRemoteStroke(listener: RemoteStrokeListener): () => void {
    this.strokeListeners.add(listener);
    return () => this.strokeListeners.delete(listener);
  }

  public onRemoteEmote(listener: RemoteEmoteListener): () => void {
    this.emoteListeners.add(listener);
    return () => this.emoteListeners.delete(listener);
  }

  public onSync(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  public onStartMatch(listener: () => void): () => void {
    this.startMatchListeners.add(listener);
    return () => this.startMatchListeners.delete(listener);
  }

  public onHoleComplete(listener: HoleCompleteListener): () => void {
    this.holeCompleteListeners.add(listener);
    return () => this.holeCompleteListeners.delete(listener);
  }

  public onNextHole(listener: NextHoleListener): () => void {
    this.nextHoleListeners.add(listener);
    return () => this.nextHoleListeners.delete(listener);
  }

  public onTimeout(listener: TimeoutListener): () => void {
    this.timeoutListeners.add(listener);
    return () => this.timeoutListeners.delete(listener);
  }

  private notify() {
    const snapshot = this.getState();
    this.stateListeners.forEach((fn) => fn(snapshot));
  }

  public setLocalPlayer(name: string, ballSkinId: string, avatarSeed?: string) {
    const finalSeed = avatarSeed || this.state.localPlayer.avatarSeed || getSavedAvatarSeed();
    this.state.localPlayer = { name, ballSkinId, avatarSeed: finalSeed };
    try {
      localStorage.setItem('minigolf_player_name', name);
      localStorage.setItem('minigolf_ball_id', ballSkinId);
      localStorage.setItem('minigolf_selected_ball', ballSkinId);
      saveAvatarSeed(finalSeed);
    } catch {}
    this.notify();
  }

  /**
   * Generates a 4-digit numeric room code (e.g. 4821, 7305)
   */
  private generateRoomCode(): string {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private getPeerId(roomCode: string): string {
    return `minigolf3d-room-${roomCode.toUpperCase()}`;
  }

  /**
   * Host an Online Match (Player 1)
   */
  public async createRoom(matchHoles = 3, startingHoleNumber = 1): Promise<string> {
    this.disconnect();

    const roomCode = this.generateRoomCode();
    const peerId = this.getPeerId(roomCode);

    this.state.isMultiplayer = true;
    this.state.isHost = true;
    this.state.status = 'hosting';
    this.state.roomCode = roomCode;
    this.state.matchHoles = matchHoles;
    this.state.holeIndex = 0;
    this.state.holeNumber = startingHoleNumber;
    this.state.currentTurn = 'p1';
    this.state.p1Strokes = 0;
    this.state.p2Strokes = 0;
    this.state.p1HolesWon = 0;
    this.state.p2HolesWon = 0;
    this.state.ties = 0;
    this.state.matchWinner = null;
    this.state.remotePlayer = null;
    this.notify();

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer.on('open', () => {
        this.notify();
        resolve(roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Host error:', err);
        this.state.status = 'error';
        this.state.errorMessage = err.message || 'Connection failed';
        this.notify();
        reject(err);
      });
    });
  }

  /**
   * Join an Online Match via 4-digit Room Code (Player 2)
   */
  public async joinRoom(roomCodeInput: string): Promise<void> {
    this.disconnect();

    const roomCode = roomCodeInput.trim().toUpperCase();
    const hostPeerId = this.getPeerId(roomCode);

    this.state.isMultiplayer = true;
    this.state.isHost = false;
    this.state.status = 'connecting';
    this.state.roomCode = roomCode;
    this.state.currentTurn = 'p1';
    this.state.p1Strokes = 0;
    this.state.p2Strokes = 0;
    this.state.p1HolesWon = 0;
    this.state.p2HolesWon = 0;
    this.state.ties = 0;
    this.state.matchWinner = null;
    this.notify();

    return new Promise((resolve, reject) => {
      // Guest creates an auto-ID peer and connects to host
      this.peer = new Peer({ debug: 1 });

      this.peer.on('open', () => {
        if (!this.peer) return;
        const conn = this.peer.connect(hostPeerId, { reliable: true });
        this.setupConnection(conn);

        conn.on('open', () => {
          conn.send({
            type: 'JOIN',
            payload: { player: this.state.localPlayer },
          });
          resolve();
        });
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Guest error:', err);
        this.state.status = 'error';
        this.state.errorMessage = 'Room not found. Check code and try again.';
        this.notify();
        reject(err);
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    this.conn = conn;

    conn.on('open', () => {
      this.state.status = 'connected';
      this.notify();

      if (this.state.isHost) {
        // Send initial match setup to guest
        conn.send({
          type: 'INIT_MATCH',
          payload: {
            hostPlayer: this.state.localPlayer,
            matchHoles: this.state.matchHoles,
            holeIndex: this.state.holeIndex,
            holeNumber: this.state.holeNumber,
          },
        });
      }
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as MultiplayerMessage);
    });

    conn.on('close', () => {
      if (this.state.isMultiplayer && this.state.status === 'connected' && !this.state.matchWinner) {
        // Opponent disconnected/left before defined match end -> Remaining player wins by surrender
        this.state.matchWinner = this.state.isHost ? 'p1' : 'p2';
        this.state.opponentSurrendered = true;
        this.notify();
      } else {
        this.state.status = 'disconnected';
        this.state.remotePlayer = null;
        this.notify();
      }
    });

    conn.on('error', (err) => {
      console.error('Connection data error:', err);
      this.state.status = 'error';
      this.state.errorMessage = 'Connection interrupted.';
      this.notify();
    });
  }

  private handleIncomingMessage(msg: MultiplayerMessage) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'JOIN': {
        if (this.state.isHost && msg.payload?.player) {
          this.state.remotePlayer = msg.payload.player;
          this.notify();
          // Reply with host info including active starting hole
          this.send({
            type: 'INIT_MATCH',
            payload: {
              hostPlayer: this.state.localPlayer,
              matchHoles: this.state.matchHoles,
              holeIndex: this.state.holeIndex,
              holeNumber: this.state.holeNumber,
            },
          });
        }
        break;
      }

      case 'INIT_MATCH': {
        if (!this.state.isHost && msg.payload) {
          this.state.remotePlayer = msg.payload.hostPlayer;
          this.state.matchHoles = msg.payload.matchHoles;
          this.state.holeIndex = msg.payload.holeIndex ?? 0;
          this.state.holeNumber = msg.payload.holeNumber ?? 1;
          this.state.status = 'connected';
          this.notify();
        }
        break;
      }

      case 'START_MATCH': {
        if (!this.state.isHost) {
          this.startMatchListeners.forEach((fn) => fn());
        }
        break;
      }

      case 'AIM': {
        if (msg.payload) {
          this.aimListeners.forEach((fn) => fn(msg.payload));
        }
        break;
      }

      case 'CANCEL_AIM': {
        this.aimListeners.forEach((fn) => fn(null));
        break;
      }

      case 'STROKE': {
        if (msg.payload) {
          this.aimListeners.forEach((fn) => fn(null));
          this.strokeListeners.forEach((fn) => fn(msg.payload));
        }
        break;
      }

      case 'SYNC': {
        if (!this.state.isHost && msg.payload) {
          let changed = false;
          if (this.state.currentTurn !== msg.payload.currentTurn) {
            this.state.currentTurn = msg.payload.currentTurn;
            changed = true;
          }
          if (this.state.p1Strokes !== msg.payload.p1Strokes) {
            this.state.p1Strokes = msg.payload.p1Strokes;
            changed = true;
          }
          if (this.state.p2Strokes !== msg.payload.p2Strokes) {
            this.state.p2Strokes = msg.payload.p2Strokes;
            changed = true;
          }
          if (msg.payload.holeNumber && this.state.holeNumber !== msg.payload.holeNumber) {
            this.state.holeNumber = msg.payload.holeNumber;
            changed = true;
          }
          if (typeof msg.payload.turnTimeRemaining === 'number') {
            this.setTurnTimeRemaining(msg.payload.turnTimeRemaining);
          }
          this.syncListeners.forEach((fn) => fn(msg.payload));
          if (changed) this.notify();
        }
        break;
      }

      case 'HOLE_COMPLETE': {
        if (msg.payload) {
          this.state.p1HolesWon = msg.payload.p1HolesWon;
          this.state.p2HolesWon = msg.payload.p2HolesWon;
          this.state.ties = msg.payload.ties;
          this.state.holeIndex = msg.payload.nextHoleIndex;
          this.state.currentTurn = msg.payload.nextTurn;
          this.state.turnTimeRemaining = 35;
          this.holeCompleteListeners.forEach((fn) => fn(msg.payload));
          this.notify();
        }
        break;
      }

      case 'NEXT_HOLE': {
        if (msg.payload) {
          this.state.holeNumber = msg.payload.holeNumber;
          this.state.holeIndex = msg.payload.holeIndex;
          this.state.p1Strokes = 0;
          this.state.p2Strokes = 0;
          this.state.currentTurn = msg.payload.nextTurn || 'p1';
          this.state.turnTimeRemaining = 35;
          this.nextHoleListeners.forEach((fn) => fn(msg.payload));
          this.notify();
        }
        break;
      }

      case 'MATCH_COMPLETE': {
        if (msg.payload) {
          this.state.matchWinner = msg.payload.winner;
          this.notify();
        }
        break;
      }

      case 'SURRENDER': {
        if (this.state.isMultiplayer && !this.state.matchWinner) {
          this.state.matchWinner = this.state.isHost ? 'p1' : 'p2';
          this.state.opponentSurrendered = true;
          this.notify();
        }
        break;
      }

      case 'TURN_TIMEOUT': {
        if (msg.payload) {
          const timedOut = msg.payload.timedOutPlayer as TurnPlayer;
          if (timedOut === 'p1') {
            this.state.p1Strokes += 1;
          } else {
            this.state.p2Strokes += 1;
          }
          this.state.currentTurn = msg.payload.nextTurn;
          this.state.turnTimeRemaining = 35;
          this.timeoutListeners.forEach((fn) => fn(timedOut));
          this.notify();
        }
        break;
      }

      case 'REMATCH': {
        this.state.p1Strokes = 0;
        this.state.p2Strokes = 0;
        this.state.p1HolesWon = 0;
        this.state.p2HolesWon = 0;
        this.state.ties = 0;
        this.state.holeIndex = 0;
        this.state.holeNumber = msg.payload?.holeNumber ?? 1;
        this.state.matchWinner = null;
        this.state.currentTurn = 'p1';
        this.notify();
        break;
      }

      case 'EMOTE': {
        if (msg.payload?.emoji) {
          this.state.lastEmote = {
            emoji: msg.payload.emoji,
            from: 'remote',
            id: Date.now(),
          };
          this.emoteListeners.forEach((fn) => fn(msg.payload.emoji));
          this.notify();
        }
        break;
      }
    }
  }

  public recordStroke(player: TurnPlayer) {
    if (player === 'p1') {
      this.state.p1Strokes += 1;
    } else {
      this.state.p2Strokes += 1;
    }
    this.notify();
  }

  public setTurn(turn: TurnPlayer) {
    this.state.currentTurn = turn;
    this.state.turnTimeRemaining = 35;
    this.notify();
  }

  public setTurnTimeRemaining(time: number, forceNotify: boolean = false) {
    this.state.turnTimeRemaining = Math.max(0, time);
    const now = performance.now();
    if (forceNotify || now - this.lastTimerNotify >= 100) {
      this.lastTimerNotify = now;
      this.notify();
    }
  }

  public resetTurnTimer(seconds: number = 35) {
    this.state.turnTimeRemaining = seconds;
    this.state.turnDuration = seconds;
    this.notify();
  }

  public handleTimeout(): TurnPlayer {
    const timedOut = this.state.currentTurn;
    if (timedOut === 'p1') {
      this.state.p1Strokes += 1;
    } else {
      this.state.p2Strokes += 1;
    }
    const nextTurn: TurnPlayer = timedOut === 'p1' ? 'p2' : 'p1';
    this.state.currentTurn = nextTurn;
    this.state.turnTimeRemaining = 35;
    this.send({
      type: 'TURN_TIMEOUT',
      payload: {
        timedOutPlayer: timedOut,
        nextTurn,
      },
    });
    this.timeoutListeners.forEach((fn) => fn(timedOut));
    this.notify();
    return timedOut;
  }

  public finishHole(winner: 'p1' | 'p2' | 'tie'): { isMatchOver: boolean; matchWinner: 'p1' | 'p2' | 'tie' | null; nextHoleNumber: number } {
    if (winner === 'p1') {
      this.state.p1HolesWon += 1;
    } else if (winner === 'p2') {
      this.state.p2HolesWon += 1;
    } else {
      this.state.ties += 1;
    }

    const nextHoleIndex = this.state.holeIndex + 1;
    const isMatchOver = nextHoleIndex >= this.state.matchHoles;
    const nextHoleNumber = this.state.holeNumber < 30 ? this.state.holeNumber + 1 : 1;

    let matchWinner: 'p1' | 'p2' | 'tie' | null = null;
    if (isMatchOver) {
      if (this.state.p1HolesWon > this.state.p2HolesWon) matchWinner = 'p1';
      else if (this.state.p2HolesWon > this.state.p1HolesWon) matchWinner = 'p2';
      else matchWinner = 'tie';
      this.state.matchWinner = matchWinner;
      this.sendMatchComplete(matchWinner);
    } else {
      const nextTurn: TurnPlayer = winner === 'p2' ? 'p2' : 'p1';
      this.state.holeIndex = nextHoleIndex;
      this.state.currentTurn = nextTurn;
      this.sendHoleComplete({
        p1HolesWon: this.state.p1HolesWon,
        p2HolesWon: this.state.p2HolesWon,
        ties: this.state.ties,
        nextHoleIndex,
        nextHoleNumber,
        nextTurn,
        winner,
        p1Strokes: this.state.p1Strokes,
        p2Strokes: this.state.p2Strokes,
      });
    }

    this.notify();
    return { isMatchOver, matchWinner, nextHoleNumber };
  }

  public advanceHole(nextHoleNumber: number, nextTurn: TurnPlayer = 'p1') {
    this.state.holeNumber = nextHoleNumber;
    this.state.p1Strokes = 0;
    this.state.p2Strokes = 0;
    this.state.currentTurn = nextTurn;
    this.state.turnTimeRemaining = 35;
    this.send({
      type: 'NEXT_HOLE',
      payload: {
        holeNumber: nextHoleNumber,
        holeIndex: this.state.holeIndex,
        nextTurn,
      },
    });
    this.notify();
  }

  public send(msg: MultiplayerMessage) {
    if (this.conn && this.conn.open) {
      try {
        this.conn.send(msg);
      } catch (err) {
        console.warn('Failed to send multiplayer message:', err);
      }
    }
  }

  public sendStartMatch() {
    this.send({ type: 'START_MATCH' });
  }

  public sendAim(dirX: number, dirZ: number, power: number) {
    this.send({ type: 'AIM', payload: { dirX, dirZ, power } });
  }

  public sendCancelAim() {
    this.send({ type: 'CANCEL_AIM' });
  }

  public sendStroke(dirX: number, dirZ: number, power: number) {
    this.send({ type: 'STROKE', payload: { dirX, dirZ, power } });
  }

  public sendSync(payload: {
    b1: BallSyncData;
    b2: BallSyncData;
    currentTurn: TurnPlayer;
    p1Strokes: number;
    p2Strokes: number;
    holeNumber?: number;
    turnTimeRemaining?: number;
  }) {
    this.send({
      type: 'SYNC',
      payload: {
        ...payload,
        holeNumber: payload.holeNumber ?? this.state.holeNumber,
        turnTimeRemaining: payload.turnTimeRemaining ?? this.state.turnTimeRemaining,
      },
    });
  }

  public sendHoleComplete(payload: {
    p1HolesWon: number;
    p2HolesWon: number;
    ties: number;
    nextHoleIndex: number;
    nextHoleNumber: number;
    nextTurn: TurnPlayer;
    winner: 'p1' | 'p2' | 'tie';
    p1Strokes: number;
    p2Strokes: number;
  }) {
    this.send({ type: 'HOLE_COMPLETE', payload });
  }

  public sendMatchComplete(winner: 'p1' | 'p2' | 'tie') {
    this.send({ type: 'MATCH_COMPLETE', payload: { winner } });
  }

  public sendRematch(holeNumber: number = 1) {
    this.state.p1Strokes = 0;
    this.state.p2Strokes = 0;
    this.state.p1HolesWon = 0;
    this.state.p2HolesWon = 0;
    this.state.ties = 0;
    this.state.holeIndex = 0;
    this.state.holeNumber = holeNumber;
    this.state.matchWinner = null;
    this.state.opponentSurrendered = false;
    this.state.currentTurn = 'p1';
    this.state.turnTimeRemaining = 35;
    this.send({ type: 'REMATCH', payload: { holeNumber } });
    this.notify();
  }

  public surrenderMatch() {
    if (this.state.isMultiplayer && this.state.status === 'connected') {
      try {
        this.send({
          type: 'SURRENDER',
          payload: { by: this.state.isHost ? 'p1' : 'p2' },
        });
      } catch {}
    }
    this.disconnect();
  }

  public sendEmote(emoji: string) {
    this.state.lastEmote = { emoji, from: 'local', id: Date.now() };
    this.send({ type: 'EMOTE', payload: { emoji } });
    this.notify();
  }

  public disconnect() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch {}
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
    this.state.isMultiplayer = false;
    this.state.isHost = false;
    this.state.status = 'idle';
    this.state.roomCode = '';
    this.state.remotePlayer = null;
    this.state.matchWinner = null;
    this.state.opponentSurrendered = false;
    this.notify();
  }
}

export const multiplayerManager = new MultiplayerManager();
