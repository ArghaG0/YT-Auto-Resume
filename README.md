# YouTube Auto Resume

[![CI](https://github.com/ArghaG0/YT-Auto-Resume/actions/workflows/ci.yml/badge.svg)](https://github.com/ArghaG0/YT-Auto-Resume/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/ArghaG0/YT-Auto-Resume/releases)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

A lightweight, privacy-first **Manifest V3** browser extension that provides uninterrupted YouTube playback:
1. **Auto-resumes playback** when paused by inactivity interruptions (*"Video paused. Continue watching?"*).
2. **Automates clicking "Skip ad" controls** as soon as they become visible and enabled, without blocking requests or violating YouTube policies.

Normal user pauses (spacebar, click, media keys) are always respected. Distributed directly via **GitHub Releases** for Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi).

---

## Features

- **Inactivity Prompt Auto-Resume:** Automatically confirms YouTube's inactivity confirmation modal across all interface languages (English, Spanish, German, Japanese, Hindi, French, etc.) via deep Shadow DOM traversal (`<ytd-popup-container yt-confirm-dialog-renderer>`).
- **Safe & Compliant Skip Ad Automation:** Automatically clicks visible, interactable "Skip ad" buttons as soon as countdown timers elapse. Strictly adheres to store policies: zero network request blocking, zero stream interception, and fail-closed safety.
- **Two-Tier Scoped MutationObserver (Near-Zero Overhead):** Monitors `#movie_player` class only during normal video playback (0% subtree DOM mutations). Attaches scoped observers to ad overlays strictly while advertisements are actively playing, disconnecting immediately upon completion.
- **Ad Pod & Consecutive Ad Support:** Tracks individual ad units (e.g. "Ad 1 of 2" followed by "Ad 2 of 2") via an in-memory lifecycle state machine (FSM) without getting stuck or locked out.
- **Minimized Window Resilience:** Features a bounded debounce engine (200ms ceiling) that counteracts Chromium's background timer clamping ($\ge 1,000\text{ ms}$) when windows are minimized or occluded on Windows.
- **Two-Phase Playback & Skip Verification:** Distinguishes action dispatch from playback transition verification, confirming actual resumption within 1,500ms before marking actions completed.
- **Comprehensive Local Diagnostics & Filtering:** Captures diagnostic events across both engines in a local FIFO ring buffer with category filters (`[Inactivity]`, `[Ad Control]`, `[All]`).
- **Independent Feature Toggles:** Independent master and sub-feature switches in the toolbar popup and options page.
- **100% Private & Local:** Zero analytics, telemetry, or external network requests. Settings and bounded diagnostics remain strictly on your local machine.

---

## Installation Guide (Chromium Browsers)

Because this extension is open-source and distributed via GitHub Releases (not the Chrome Web Store), install it using Chromium's native **Developer Mode**:

### Step 1: Download & Extract
1. Go to the [Releases](https://github.com/ArghaG0/YT-Auto-Resume/releases) page.
2. Under **Assets**, download **`youtube-auto-resume-v1.0.1.zip`** (ensure you download this packaged asset, not the generic "Source code" zip).
3. Extract the ZIP file to a permanent folder on your drive (e.g., `Documents/BrowserExtensions/YouTubeAutoResume`).

### Step 2: Load into Browser
1. In Google Chrome, Microsoft Edge, or Brave, open the extensions management page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
2. Enable the **Developer mode** toggle switch (usually located in the top-right corner).
3. Click the **Load unpacked** button (top-left).
4. Select the extracted folder (the directory containing `manifest.json`).
5. The extension icon will appear in your toolbar. Pin it for quick access!

---

## How to Update

To update to a newer release:
1. Download the new release ZIP from GitHub.
2. Extract the files and replace the contents of your existing extension folder.
3. Open `chrome://extensions` and click the **Reload** (circular arrow) icon on the YouTube Auto Resume card.

---

## Background Playback Tips

Chromium browsers include memory-saving features that can freeze inactive background tabs. If you frequently listen to music in minimized or background tabs, configure this one-time setting:

- **Microsoft Edge (Sleeping Tabs):** Go to `edge://settings/system` ➔ Under *Never put these sites to sleep*, add `youtube.com`.
- **Google Chrome (Memory Saver):** Go to `chrome://settings/performance` ➔ Under *Always keep these sites active*, add `youtube.com`.

---

## Permissions Explained

YouTube Auto Resume requests the absolute minimum permissions required:

| Permission | Purpose |
| :--- | :--- |
| `storage` | Stores your enable/disable preferences and local diagnostic logs locally in `chrome.storage.local`. |
| `activeTab` | Allows the toolbar popup to detect whether the current tab is `youtube.com` to display live status. |
| `*://*.youtube.com/*` | Injects the content script to observe the inactivity modal on YouTube pages. |

---

## Development & Testing

For developers who want to contribute or modify the extension:

```bash
# Clone the repository
git clone https://github.com/ArghaG0/YT-Auto-Resume.git
cd YT-Auto-Resume

# Install dependencies
npm install

# Run bundling with esbuild
npm run build

# Run Vitest unit & fixture test suites
npm test

# Run ESLint static analysis
npm run lint

# Package clean production release ZIP
npm run package
```
