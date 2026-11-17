export type Language = 'en' | 'zh';

const LANG_STORAGE_KEY = 'minigolf_language';

export function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {}
  return 'en';
}

export function saveLanguage(lang: Language): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {}
}

export interface TranslationStrings {
  gameTitle: string;
  continue: string;
  holeLabel: (n: number) => string;
  holes: string;
  balls: string;
  top10: string;
  top10LeaderboardsTitle: string;
  howToPlayTitle: string;
  settingsTitle: string;
  settings: string;
  music: string;
  soundEffects: string;
  language: string;
  resetProgress: string;
  confirmReset: string;
  done: string;
  strokes: string;
  par: string;
  parNum: (n: number) => string;
  time: string;
  power: string;
  rotate: string;
  rotateTooltip: string;
  hint: string;
  hintTooltip: string;
  retry: string;
  retryTooltip: string;
  holesMenuTooltip: string;
  homeTooltip: string;
  holesFinishedInWorld: (done: number, total: number) => string;
  golfBalls: string;
  howToPlay: string;
  helpStep1Bold: string;
  helpStep1Text: string;
  helpStep2Bold: string;
  helpStep2Text: string;
  helpStep3Bold: string;
  helpStep3Text: string;
  gotIt: string;
  holeInOne: string;
  birdie: string;
  parBanner: string;
  holeComplete: string;
  top10Record: (rank: number) => string;
  nextHole: string;
  top10Ranks: string;
  leaderboardSubtitle: string;
  editGolferNameTooltip: string;
  previousHole: string;
  bestScore: (strokes: number, time: string) => string;
  noPersonalScore: string;
  playerCol: string;
  youBadge: string;
  newBadge: string;
  playHoleBtn: (n: number) => string;
  worlds: Record<number, { name: string; subtitle: string }>;
  holeNames: Record<number, string>;
  ballSkins: Record<string, { name: string; subtitle: string }>;
}

export const TRANSLATIONS: Record<Language, TranslationStrings> = {
  en: {
    gameTitle: 'Mini Golf',
    continue: 'Continue',
    holeLabel: (n) => `Hole ${n}`,
    holes: 'Holes',
    balls: 'Balls',
    top10: 'Top 10',
    top10LeaderboardsTitle: 'Top 10 Leaderboards',
    howToPlayTitle: 'How to Play',
    settingsTitle: 'Settings',
    settings: 'Settings',
    music: 'Music',
    soundEffects: 'Sound effects',
    language: 'Language',
    resetProgress: 'Reset progress',
    confirmReset: 'Confirm Reset?',
    done: 'Done',
    strokes: 'Strokes',
    par: 'Par',
    parNum: (n) => `Par ${n}`,
    time: 'Time',
    power: 'Power',
    rotate: 'Rotate',
    rotateTooltip: 'Rotate Camera 90°',
    hint: 'Hint',
    hintTooltip: 'Show Shot Hint',
    retry: 'Retry',
    retryTooltip: 'Retry Hole',
    holesMenuTooltip: 'Holes Menu',
    homeTooltip: 'Home',
    holesFinishedInWorld: (done, total) => `${done} of ${total} holes finished in this world`,
    golfBalls: 'Golf Balls',
    howToPlay: 'How to Play',
    helpStep1Bold: 'Drag & Release:',
    helpStep1Text:
      'Touch anywhere on the green and pull back with your thumb to aim and set shot power.',
    helpStep2Bold: 'Rotate & Hint:',
    helpStep2Text:
      'Tap the action buttons to rotate the camera 90° or preview the optimal shot direction.',
    helpStep3Bold: 'Top 10 & Stars:',
    helpStep3Text:
      'Sink the ball fast and under Par to earn 3 Gold Stars, unlock balls, and set Top 10 Hole Records!',
    gotIt: 'Got it!',
    holeInOne: 'Hole in One!',
    birdie: 'Birdie!',
    parBanner: 'Par!',
    holeComplete: 'Hole Complete!',
    top10Record: (rank) => `Top 10 Hole Record! (Rank #${rank})`,
    nextHole: 'Next Hole',
    top10Ranks: 'Top 10 Ranks',
    leaderboardSubtitle: 'Fastest times & least strokes',
    editGolferNameTooltip: 'Tap to edit golfer name',
    previousHole: 'Previous Hole',
    bestScore: (strokes, time) => `Best: ${strokes} · ${time}`,
    noPersonalScore: 'No personal score yet',
    playerCol: 'Player',
    youBadge: 'You',
    newBadge: 'New',
    playHoleBtn: (n) => `Play Hole ${n}`,
    worlds: {
      0: { name: 'Sunny Meadow', subtitle: 'Gentle green fairways' },
      1: { name: 'Pine Valley', subtitle: 'Bank shots and bumper pins' },
      2: { name: 'Golden Dunes', subtitle: 'Sand strips and doglegs' },
      3: { name: 'Emerald Ridge', subtitle: 'Moving gates and tight corners' },
      4: { name: 'Starlight Champions', subtitle: 'Master championship courses' },
    },
    holeNames: {
      1: 'Straight Shot',
      2: 'Single Pin',
      3: 'Sunny Corner',
      4: 'Left Bend',
      5: 'Corner Guard',
      6: 'Horseshoe Bend',
      7: 'Twin Bumpers',
      8: 'Zig-Zag Alley',
      9: 'Meadow Dogleg',
      10: 'Pinball Lane',
      11: 'Double Corner',
      12: 'Valley Loop',
      13: 'Sandy Straight',
      14: 'Dune Bank',
      15: 'Oasis S-Bend',
      16: 'Mirage Hook',
      17: 'Pyramid Ricochet',
      18: 'Canyon U-Turn',
      19: 'Sweeper Gate',
      20: 'Ridge Turn',
      21: 'Twin Pistons',
      22: 'Emerald Bend',
      23: 'Emerald Diamond',
      24: 'Spiral Fortress',
      25: 'Gauntlet Run',
      26: 'Starlight Z',
      27: 'Triple Crown',
      28: 'Ricochet Chamber',
      29: 'Pendulum Bridge',
      30: 'Grand Finale',
    },
    ballSkins: {
      golf: { name: 'Golf Ball', subtitle: '' },
      basketball: { name: 'Basket Ball', subtitle: '' },
      tennis: { name: 'Tennis Ball', subtitle: '' },
      soccer: { name: 'Soccer Ball', subtitle: '' },
      bowling: { name: 'Bowling Ball', subtitle: '' },
      beach: { name: 'Beach Ball', subtitle: '' },
    },
  },
  zh: {
    gameTitle: '迷你高尔夫',
    continue: '继续游戏',
    holeLabel: (n) => `第 ${n} 洞`,
    holes: '球洞',
    balls: '球皮肤',
    top10: '排行榜',
    top10LeaderboardsTitle: '前10名排行榜',
    howToPlayTitle: '游戏玩法',
    settingsTitle: '设置',
    settings: '设置',
    music: '背景音乐',
    soundEffects: '游戏音效',
    language: '语言',
    resetProgress: '重置进度',
    confirmReset: '确认重置？',
    done: '完成',
    strokes: '杆数',
    par: '标准杆',
    parNum: (n) => `标准杆 ${n}`,
    time: '时间',
    power: '力度',
    rotate: '视角',
    rotateTooltip: '旋转视角 90°',
    hint: '提示',
    hintTooltip: '显示击球提示',
    retry: '重试',
    retryTooltip: '重新开始本洞',
    holesMenuTooltip: '球洞菜单',
    homeTooltip: '返回主页',
    holesFinishedInWorld: (done, total) => `本世界已完成 ${done} / ${total} 个球洞`,
    golfBalls: '高尔夫球皮肤',
    howToPlay: '游戏玩法',
    helpStep1Bold: '拖拽并松开：',
    helpStep1Text: '按住果岭任意位置并向后拉动，即可瞄准方向并设置击球力度。',
    helpStep2Bold: '旋转与提示：',
    helpStep2Text: '点击操作按钮可旋转 90° 镜头视角，或查看最佳击球路线提示。',
    helpStep3Bold: '排行榜与星星：',
    helpStep3Text: '以更少杆数和更快时间进洞即可赢取3颗星，解锁新球皮肤并登上前10排行榜！',
    gotIt: '知道了！',
    holeInOne: '一杆进洞！',
    birdie: '小鸟球！',
    parBanner: '标准杆！',
    holeComplete: '本洞完成！',
    top10Record: (rank) => `创造球洞前10新纪录！（第 #${rank} 名）`,
    nextHole: '下一洞',
    top10Ranks: '前10名排行榜',
    leaderboardSubtitle: '最快用时与最少杆数',
    editGolferNameTooltip: '点击修改球员名称',
    previousHole: '上一洞',
    bestScore: (strokes, time) => `最佳: ${strokes}杆 · ${time}`,
    noPersonalScore: '暂无个人记录',
    playerCol: '玩家',
    youBadge: '你',
    newBadge: '新',
    playHoleBtn: (n) => `挑战第 ${n} 洞`,
    worlds: {
      0: { name: '阳光草甸', subtitle: '平缓翠绿的球道' },
      1: { name: '松林山谷', subtitle: '反弹击球与弹力柱' },
      2: { name: '金黄沙丘', subtitle: '减速沙带与曲折弯道' },
      3: { name: '翡翠山脊', subtitle: '移动机关与紧凑拐角' },
      4: { name: '星光冠军赛', subtitle: '大师级锦标赛球场' },
    },
    holeNames: {
      1: '直线进洞',
      2: '单柱守卫',
      3: '阳光拐角',
      4: '左侧弯道',
      5: '转角卫士',
      6: '马蹄回弯',
      7: '双子弹柱',
      8: '之字回廊',
      9: '草甸狗腿洞',
      10: '弹珠球道',
      11: '双重转角',
      12: '山谷环道',
      13: '沙带直道',
      14: '沙丘反弹',
      15: '绿洲S弯',
      16: '幻影勾弯',
      17: '金字塔弹射',
      18: '峡谷U型弯',
      19: '横扫闸门',
      20: '山脊转弯',
      21: '双塞机关',
      22: '翡翠弯道',
      23: '翡翠菱形',
      24: '螺旋堡垒',
      25: '闯关长廊',
      26: '星光Z字',
      27: '三冠王回廊',
      28: '弹射密室',
      29: '钟摆大桥',
      30: '终极决战',
    },
    ballSkins: {
      golf: { name: '高尔夫球', subtitle: '' },
      basketball: { name: '篮球', subtitle: '' },
      tennis: { name: '网球', subtitle: '' },
      soccer: { name: '足球', subtitle: '' },
      bowling: { name: '保龄球', subtitle: '' },
      beach: { name: '沙滩球', subtitle: '' },
    },
  },
};
