export interface LeaderboardEntry {
  id: string;
  holeNumber: number; // 1..30
  playerName: string;
  strokes: number;
  timeMs: number; // completion time in milliseconds
  stars: number;
  ballId: string;
  timestamp: number;
  isUser?: boolean;
}

export type LeaderboardSortMode = 'stars' | 'strokes' | 'time';

const STORAGE_KEY = 'minigolf_leaderboards_v1';
const PLAYER_NAME_KEY = 'minigolf_player_name';

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || 'Golf Pro';
  } catch {
    return 'Golf Pro';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim() || 'Golf Pro');
  } catch {}
}

export function formatGolfTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(Math.max(0, ms) / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function sortEntries(
  entries: LeaderboardEntry[],
  sortBy: LeaderboardSortMode = 'stars'
): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (sortBy === 'stars') {
      // Primary: Most stars first (descending: 3★ > 2★ > 1★)
      if (b.stars !== a.stars) return b.stars - a.stars;
      // Secondary: Least strokes (ascending)
      if (a.strokes !== b.strokes) return a.strokes - b.strokes;
      // Tertiary: Fastest completion time (ascending)
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return b.timestamp - a.timestamp;
    } else if (sortBy === 'strokes') {
      if (a.strokes !== b.strokes) return a.strokes - b.strokes;
      if (b.stars !== a.stars) return b.stars - a.stars;
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return b.timestamp - a.timestamp;
    } else {
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      if (b.stars !== a.stars) return b.stars - a.stars;
      if (a.strokes !== b.strokes) return a.strokes - b.strokes;
      return b.timestamp - a.timestamp;
    }
  });
}

function sortAndTrimEntries(
  entries: LeaderboardEntry[],
  sortBy: LeaderboardSortMode = 'stars'
): LeaderboardEntry[] {
  return sortEntries(entries, sortBy).slice(0, 10);
}

export function loadAllLeaderboards(): Record<number, LeaderboardEntry[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Strip out any old seed entries (id starts with "seed-")
        const cleaned: Record<number, LeaderboardEntry[]> = {};
        for (const [key, entries] of Object.entries(parsed)) {
          cleaned[Number(key)] = (entries as LeaderboardEntry[]).filter(
            (e) => !e.id.startsWith('seed-')
          );
        }
        return cleaned;
      }
    }
  } catch {}
  // No saved data — start with empty leaderboards
  return {};
}

export function saveAllLeaderboards(data: Record<number, LeaderboardEntry[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function recordHoleScore(params: {
  holeNumber: number;
  playerName: string;
  strokes: number;
  timeMs: number;
  stars: number;
  ballId: string;
}): {
  updatedBoard: Record<number, LeaderboardEntry[]>;
  newEntry: LeaderboardEntry;
  rankStars: number | null;   // 1..10 or null if outside top 10
  rankStrokes: number | null; // 1..10 or null if outside top 10
  rankTime: number | null;    // 1..10 or null if outside top 10
} {
  const allBoards = loadAllLeaderboards();
  const currentList = allBoards[params.holeNumber] || [];

  const newEntry: LeaderboardEntry = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    holeNumber: params.holeNumber,
    playerName: params.playerName.trim() || 'Golf Pro',
    strokes: params.strokes,
    timeMs: Math.max(100, Math.round(params.timeMs)),
    stars: params.stars,
    ballId: params.ballId,
    timestamp: Date.now(),
    isUser: true,
  };

  // Combine and keep entries that are in the Top 10 by Most Stars, Least Strokes, or Fastest Time
  const combined = [...currentList, newEntry];
  const topByStars = sortEntries(combined, 'stars').slice(0, 10);
  const topByStrokes = sortEntries(combined, 'strokes').slice(0, 10);
  const topByTime = sortEntries(combined, 'time').slice(0, 10);

  const mergedMap = new Map<string, LeaderboardEntry>();
  for (const e of topByStars) mergedMap.set(e.id, e);
  for (const e of topByStrokes) mergedMap.set(e.id, e);
  for (const e of topByTime) mergedMap.set(e.id, e);

  // Store sorted by default Stars priority (most stars first)
  const savedList = sortEntries(Array.from(mergedMap.values()), 'stars');
  const updatedBoard: Record<number, LeaderboardEntry[]> = {
    ...allBoards,
    [params.holeNumber]: savedList,
  };

  saveAllLeaderboards(updatedBoard);

  const starIdx = topByStars.findIndex((e) => e.id === newEntry.id);
  const sIdx = topByStrokes.findIndex((e) => e.id === newEntry.id);
  const tIdx = topByTime.findIndex((e) => e.id === newEntry.id);

  return {
    updatedBoard,
    newEntry,
    rankStars: starIdx >= 0 ? starIdx + 1 : null,
    rankStrokes: sIdx >= 0 ? sIdx + 1 : null,
    rankTime: tIdx >= 0 ? tIdx + 1 : null,
  };
}

export function resetAllLeaderboards(): Record<number, LeaderboardEntry[]> {
  const fresh: Record<number, LeaderboardEntry[]> = {};
  saveAllLeaderboards(fresh);
  return fresh;
}
