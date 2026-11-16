import {
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { LeaderboardEntry } from '../data/leaderboard';
import { generateRandomAvatarSeed } from '../data/userProfile';

export interface GlobalStarRankingUser {
  uid: string;
  displayName: string;
  avatarSeed: string;
  totalStars: number;
  currentHole: number;
  isCurrentUser: boolean;
}

export interface CloudUserProfile {
  uid: string;
  displayName: string;
  avatarSeed: string;
  currentHole: number;
  selectedBallId: string;
  holeStars: Record<string, number>;
  totalStars: number;
  preferences: {
    music: boolean;
    sfx: boolean;
    language: string;
  };
  updatedAt: number;
}

export interface CloudSyncStatus {
  configured: boolean;
  connected: boolean;
  uid: string | null;
  mode: 'firebase' | 'local';
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
  /** True once onAuthStateChanged has fired at least once (or Firebase not configured) */
  authResolved: boolean;
}

const LOCAL_DEVICE_ID_KEY = 'minigolf_local_device_uid';

function getOrCreateLocalDeviceId(): string {
  try {
    let id = localStorage.getItem(LOCAL_DEVICE_ID_KEY);
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(LOCAL_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'local_player';
  }
}

class FirebaseSyncManager {
  private currentUser: User | null = null;
  private isConnected = false;
  private authResolved = false;
  private listeners: Set<(status: CloudSyncStatus) => void> = new Set();

  public subscribeStatus(listener: (status: CloudSyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notifyStatus(): void {
    const status = this.getStatus();
    this.listeners.forEach((cb) => cb(status));
  }

  public getStatus(): CloudSyncStatus {
    const configured = isFirebaseConfigured();
    const isRealUser = Boolean(this.currentUser && !this.currentUser.isAnonymous);
    return {
      configured,
      connected: this.isConnected && isRealUser,
      uid: isRealUser ? this.currentUser!.uid : null,
      mode: configured && isRealUser ? 'firebase' : 'local',
      isAnonymous: !isRealUser,
      email: isRealUser ? this.currentUser?.email || null : null,
      displayName: isRealUser ? this.currentUser?.displayName || null : null,
      authResolved: this.authResolved,
    };
  }

  /**
   * Initializes Firebase Auth listener.
   * Only registered (non-anonymous) accounts are allowed.
   */
  public async initSession(
    onCloudProfileLoaded?: (profile: CloudUserProfile) => void
  ): Promise<void> {
    if (!isFirebaseConfigured() || !auth || !db) {
      this.isConnected = false;
      this.authResolved = true; // Not configured — immediately resolved (local mode)
      this.notifyStatus();
      return;
    }

    try {
      onAuthStateChanged(auth, async (user) => {
        // Mark auth as resolved on first callback (whether user is null or not)
        this.authResolved = true;

        // If an anonymous guest session was active from earlier, sign out immediately
        if (user && user.isAnonymous) {
          try {
            await signOut(auth!);
          } catch {}
          this.currentUser = null;
          this.isConnected = false;
          this.notifyStatus();
          return;
        }

        if (user && !user.isAnonymous) {
          this.currentUser = user;
          this.isConnected = true;
          this.notifyStatus();
          console.log('[FirebaseSync] Registered user authenticated:', user.email);

          if (onCloudProfileLoaded) {
            try {
              const userRef = doc(db!, 'users', user.uid);
              const snapshot = await getDoc(userRef);
              if (snapshot.exists()) {
                const data = snapshot.data() as CloudUserProfile;
                console.log('[FirebaseSync] Cloud profile retrieved:', data);
                onCloudProfileLoaded(data);
              }
            } catch (err) {
              console.warn('[FirebaseSync] Failed to read cloud user profile:', err);
            }
          }
        } else {
          this.currentUser = null;
          this.isConnected = false;
          this.notifyStatus();
        }
      });
    } catch (err) {
      console.warn('[FirebaseSync] Error setting up auth listener:', err);
      this.isConnected = false;
      this.notifyStatus();
    }
  }

  /**
   * Persists the user profile, stars, current hole, and settings to Firestore.
   */
  public async syncUserProfile(profile: Omit<CloudUserProfile, 'uid' | 'updatedAt'>): Promise<void> {
    if (!isFirebaseConfigured() || !db || !this.currentUser || this.currentUser.isAnonymous) {
      return;
    }

    try {
      const uid = this.currentUser.uid;
      const userRef = doc(db, 'users', uid);
      const payload: CloudUserProfile = {
        ...profile,
        uid,
        updatedAt: Date.now(),
      };
      await setDoc(userRef, payload, { merge: true });
      console.log('[FirebaseSync] User profile synced to Firestore.');
    } catch (err) {
      console.warn('[FirebaseSync] Error syncing user profile:', err);
    }
  }

  /**
   * Records a hole completion score in the global hole leaderboard collection.
   */
  public async submitScore(params: {
    holeNumber: number;
    playerName: string;
    avatarSeed: string;
    strokes: number;
    timeMs: number;
    stars: number;
    ballId: string;
  }): Promise<void> {
    if (!isFirebaseConfigured() || !db || !this.currentUser || this.currentUser.isAnonymous) return;

    try {
      const uid = this.currentUser.uid;
      const holeScoresCol = collection(db, 'leaderboards', String(params.holeNumber), 'scores');
      await addDoc(holeScoresCol, {
        uid,
        playerName: params.playerName,
        avatarSeed: params.avatarSeed,
        holeNumber: params.holeNumber,
        strokes: params.strokes,
        timeMs: params.timeMs,
        stars: params.stars,
        ballId: params.ballId,
        timestamp: Date.now(),
      });
      console.log(`[FirebaseSync] Score submitted to Hole ${params.holeNumber} global leaderboard.`);
    } catch (err) {
      console.warn('[FirebaseSync] Error submitting score:', err);
    }
  }

  /**
   * Fetches top scores from the global hole leaderboard collection.
   */
  public async fetchLeaderboard(holeNumber: number): Promise<LeaderboardEntry[]> {
    if (!isFirebaseConfigured() || !db) return [];

    try {
      const holeScoresCol = collection(db, 'leaderboards', String(holeNumber), 'scores');
      const q = query(holeScoresCol, orderBy('strokes', 'asc'), orderBy('timeMs', 'asc'), limit(10));
      const querySnap = await getDocs(q);

      const entries: LeaderboardEntry[] = [];
      querySnap.forEach((docSnap) => {
        const d = docSnap.data();
        entries.push({
          id: docSnap.id,
          holeNumber: d.holeNumber || holeNumber,
          playerName: d.playerName || 'Golfer',
          strokes: d.strokes || 1,
          timeMs: d.timeMs || 0,
          stars: d.stars || 1,
          ballId: d.ballId || 'golf',
          timestamp: d.timestamp || Date.now(),
          isUser: this.currentUser ? d.uid === this.currentUser.uid : false,
        });
      });
      return entries;
    } catch (err) {
      console.warn('[FirebaseSync] Error fetching cloud leaderboard:', err);
      return [];
    }
  }

  /**
   * Fetches all registered players ranked by total stars (most stars first).
   */
  public async fetchGlobalStarRankings(): Promise<GlobalStarRankingUser[]> {
    if (!isFirebaseConfigured() || !db) return [];

    try {
      const usersCol = collection(db, 'users');
      const q = query(usersCol, orderBy('totalStars', 'desc'), limit(50));
      const querySnap = await getDocs(q);

      const list: GlobalStarRankingUser[] = [];
      const currentUid = this.currentUser?.uid;

      querySnap.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          uid: docSnap.id,
          displayName: d.displayName || 'Golfer',
          avatarSeed: d.avatarSeed || 'seed',
          totalStars: Number(d.totalStars) || 0,
          currentHole: Number(d.currentHole) || 1,
          isCurrentUser: Boolean(currentUid && docSnap.id === currentUid),
        });
      });

      return list;
    } catch (err) {
      console.warn('[FirebaseSync] Error fetching global star rankings:', err);
      return [];
    }
  }

  /**
   * Registers a new permanent user with email and password,
   * linking their current stars, avatar, and progress.
   */
  public async registerWithEmail(
    email: string,
    password: string,
    displayName: string,
    avatarSeed: string,
    initialProfile?: Partial<CloudUserProfile>
  ): Promise<{ success: boolean; error?: string }> {
    if (!isFirebaseConfigured() || !auth || !db) {
      return { success: false, error: 'Firebase is not configured.' };
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;
      this.currentUser = user;

      if (displayName.trim()) {
        try {
          await updateProfile(user, { displayName: displayName.trim() });
        } catch {}
      }

      // Sync user profile to Firestore
      const userRef = doc(db, 'users', user.uid);
      const payload: CloudUserProfile = {
        uid: user.uid,
        displayName: displayName.trim() || 'Golfer',
        avatarSeed: avatarSeed || 'Ace',
        currentHole: initialProfile?.currentHole || 1,
        selectedBallId: initialProfile?.selectedBallId || 'golf',
        holeStars: initialProfile?.holeStars || {},
        totalStars: initialProfile?.totalStars || 0,
        preferences: initialProfile?.preferences || { music: true, sfx: true, language: 'en' },
        updatedAt: Date.now(),
      };
      await setDoc(userRef, payload, { merge: true });

      this.isConnected = true;
      this.notifyStatus();
      return { success: true };
    } catch (err: any) {
      console.warn('[FirebaseSync] Registration error:', err);
      let errorMsg = 'Failed to create account. Please try again.';
      if (err?.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Please log in instead.';
      } else if (err?.code === 'auth/weak-password') {
        errorMsg = 'Password must be at least 6 characters.';
      } else if (err?.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      } else if (err?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Email/Password sign-in is not enabled yet in your Firebase Console (Authentication > Sign-in method).';
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Logs in an existing user with email and password.
   */
  public async loginWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; profile?: CloudUserProfile; error?: string }> {
    if (!isFirebaseConfigured() || !auth || !db) {
      return { success: false, error: 'Firebase is not configured.' };
    }

    try {
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;
      this.currentUser = user;
      this.isConnected = true;
      this.notifyStatus();

      // Retrieve cloud profile
      const userRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(userRef);
      let profile: CloudUserProfile | undefined;
      if (snapshot.exists()) {
        profile = snapshot.data() as CloudUserProfile;
      }
      return { success: true, profile };
    } catch (err: any) {
      console.warn('[FirebaseSync] Login error:', err);
      let errorMsg = 'Invalid email or password.';
      if (
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/invalid-credential'
      ) {
        errorMsg = 'Invalid email or password.';
      } else if (err?.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      } else if (err?.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed login attempts. Please wait a moment.';
      } else if (err?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Email/Password sign-in is not enabled yet in your Firebase Console (Authentication > Sign-in method).';
      }
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Logs out the user.
   */
  public async logout(): Promise<void> {
    if (!isFirebaseConfigured() || !auth) return;
    try {
      await signOut(auth);
      this.currentUser = null;
      this.isConnected = false;
      this.authResolved = true;
      this.notifyStatus();
    } catch (err) {
      console.warn('[FirebaseSync] Logout error:', err);
    }
  }

  /**
   * Signs in with Google via popup. Creates Firestore profile on first login.
   */
  public async loginWithGoogle(): Promise<{ success: boolean; profile?: CloudUserProfile; error?: string }> {
    if (!isFirebaseConfigured() || !auth || !db) {
      return { success: false, error: 'Firebase not configured.' };
    }
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if Firestore profile exists
      const userRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(userRef);

      let profile: CloudUserProfile;

      if (snapshot.exists()) {
        profile = snapshot.data() as CloudUserProfile;
      } else {
        // First-time Google login: create profile with random avatar
        const avatarSeed = generateRandomAvatarSeed();
        profile = {
          uid: user.uid,
          displayName: user.displayName || 'Golfer',
          avatarSeed,
          currentHole: 1,
          selectedBallId: 'golf',
          holeStars: {},
          totalStars: 0,
          preferences: { music: true, sfx: true, language: 'en' },
          updatedAt: Date.now(),
        };
        await setDoc(userRef, profile);
      }

      return { success: true, profile };
    } catch (err: unknown) {
      const code = (err as { code?: string }).code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { success: false, error: '' }; // silent cancel
      }
      const msg = (err as { message?: string }).message || 'Google sign-in failed.';
      return { success: false, error: msg };
    }
  }
}

export const firebaseSync = new FirebaseSyncManager();
