# YouTube Auto Resume

[![CI](https://github.com/ArghaG0/YT-Auto-Resume/actions/workflows/ci.yml/badge.svg)](https://github.com/ArghaG0/YT-Auto-Resume/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/ArghaG0/YT-Auto-Resume/releases)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

A lightweight, privacy-first **Manifest V3** browser extension that automatically confirms YouTube's inactivity interruption (*"Video paused. Continue watching?"*), keeping background music and long videos playing seamlessly without overriding intentional user pauses.

Distributed directly via **GitHub Releases** for Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi).

---

## Features

- **i18n-Resilient Detection:** Recognizes YouTube's Web Component hierarchy (`<ytd-popup-container yt-confirm-dialog-renderer>`) without depending on English-only text matching. Works across all interface languages (English, Spanish, German, Japanese, Hindi, French, etc.).
- **Shadow DOM Traversal:** Recursively traverses open Shadow Roots (`#shadow-root (open)`) within custom elements (`<yt-button-renderer>`) to activate the actual interactive button.
- **Fail-Closed Safety:** Never clicks unrelated buttons (e.g. channel unsubscribe, playlist delete, or dismiss). Normal user pauses (spacebar, click, media keys) always remain paused.
- **Background Tab Execution:** Relies on microtask-driven DOM observation rather than clamped timer loops, executing promptly even when YouTube is minimized or playing in the background.
- **100% Private & Local:** Zero analytics, telemetry, or external network requests. Settings and bounded diagnostics remain strictly on your local machine.
- **Bounded Diagnostics Console:** An optional local diagnostic log viewer (capped at 50 events / ≤ 100 KB) available directly in the Options page.

---

## Installation Guide (Chromium Browsers)

Because this extension is open-source and distributed via GitHub Releases (not the Chrome Web Store), install it using Chromium's native **Developer Mode**:

### Step 1: Download & Extract
1. Go to the [Releases](https://github.com/ArghaG0/YT-Auto-Resume/releases) page.
2. Download the latest `youtube-auto-resume-vX.Y.Z.zip` file.
3. Extract the ZIP file to a permanent folder on your drive (e.g., `Documents/BrowserExtensions/YouTubeAutoResume`).

### Step 2: Load into Browser
1. In Google Chrome, Microsoft Edge, or Brave, open the extensions management page:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
2. Enable the **Developer mode** toggle switch (usually located in the top-right corner).
3. Click the **Load unpacked** button (top-left).
4. Select the extracted **`src`** folder (the folder containing `manifest.json`).
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
