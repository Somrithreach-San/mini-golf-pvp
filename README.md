# ⛳ Mini Golf PvP 3D

A stylish, feature-rich 3D Miniature Golf game built with **React 19**, **Three.js**, **Tailwind CSS v4**, and **Vite**. Features 30 campaign holes across 5 worlds, realistic physics, intelligent shot hints, and real-time 2-player online multiplayer.

---

## 🌟 Features

- **🎮 30 Championship Holes across 5 Worlds**:
  - *Sunny Meadow*: Gentle green fairways & scenic windmills.
  - *Pine Valley*: High-velocity bumper ricochet challenges.
  - *Golden Dunes*: Sand traps and doglegs.
  - *Emerald Ridge*: Dynamic moving gates & tight corridors.
  - *Starlight Champions*: Master championship obstacle courses.
- **⚔️ Real-Time 2-Player Online PvP**:
  - Instant matchmaking & room codes via WebRTC DataChannels (PeerJS).
  - Synchronized real-time ball trajectories, turn clock, and emotes.
- **✨ Diorama Aesthetic & 3D Audio**:
  - Low-poly nature vignettes, animated windmills, custom golf ball skins, and spatial audio sound effects.
- **💡 Intelligent BFS Shot Trajectory Hints**:
  - Course-aware pathfinding that calculates recommended aiming angles and power percentages.
- **🏆 Global Leaderboards & Cloud Progression**:
  - Saved progress and 3-star hole mastery synced to Firebase Cloud Firestore.

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm or bun

### 2. Installation
```bash
git clone <your-repo-url> mini-golf-pvp
cd mini-golf-pvp
npm install
```

### 3. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
*(Add your Firebase project credentials in `.env` for cloud authentication and leaderboards).*

### 4. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 📦 Build & Deploy

Build the production bundle:
```bash
npm run build
```

Deploy to Firebase Hosting:
```bash
npm run deploy
```

---

## 🛠️ Tech Stack
- **Engine**: Three.js, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Lucide Icons, Canvas Confetti
- **Multiplayer**: PeerJS (WebRTC P2P DataChannels)
- **Backend / Cloud**: Firebase Authentication (Google OAuth), Cloud Firestore
- **Bundler**: Vite
