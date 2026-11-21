# YouTube Auto Resume

[![CI](https://github.com/ArghaG0/YT-Auto-Resume/actions/workflows/ci.yml/badge.svg)](https://github.com/ArghaG0/YT-Auto-Resume/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](https://github.com/ArghaG0/YT-Auto-Resume/releases)
[![Manifest V3](https://img.shields.io/badge/manifest-v3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)

A lightweight, privacy-first **Manifest V3** browser extension that automatically confirms YouTube's inactivity interruption (*"Video paused. Continue watching?"*), keeping background music and long videos playing seamlessly without overriding intentional user pauses.

Distributed directly via **GitHub Releases** for Chromium-based browsers (Chrome, Edge, Brave, Opera, Vivaldi).

---

## Features

- **i18n-Resilient Detection:** Recognizes YouTube's Web Component hierarchy (`<ytd-popup-container yt-confirm-dialog-renderer>`) without depending on English-only text matching. Works across all interface languages (English, Spanish, German, Japanese, Hindi, French, etc.).
- **Deep Shadow DOM Piercing:** Recursively traverses open Shadow Roots (`#shadow-root (open)`) across nested Web Components (`<yt-button-renderer>` $\rightarrow$ `<yt-button-shape>` $\rightarrow$ `<button>`) to activate the actual interactive button.
- **Minimized Window Resilience (v1.0.1):** Features a bounded debounce engine (200ms upper ceiling) that counteracts Chromium's background timer clamping ($\ge 1,000\text{ ms}$) when windows are minimized or occluded on Windows, preventing timer starvation when video audio pauses.
- **Two-Phase Playback Verification (v1.0.1):** Separates button click dispatch from playback verification. Actively monitors the `<video>` element for resumption within 1,500ms before marking the prompt handled.
- **Controlled Retries with Concurrency Protection (v1.0.1):** Reversible deduplication leases allow up to 3 controlled retries if YouTube delays playback resumption, preventing permanent lockout.
- **Observer Health & Disconnection Recovery (v1.0.1):** Detects detached `<ytd-popup-container>` nodes during YouTube SPA route transitions and automatically re-attaches observers to replacement containers.
- **100% Diagnostic Observability (v1.0.1):** Captures 24 granular diagnostic event types (initialization, occlusion, button resolution, click dispatch, playback verification, retries, and error handling) in a local FIFO ring buffer.
- **Clear Background Status UI (v1.0.1):** Toolbar popup displays reassuring green protection status whether browsing YouTube or multitasking across other background tabs.
- **Fail-Closed Safety:** Never clicks unrelated buttons (e.g. channel unsubscribe, playlist delete, or dismiss). Normal user pauses (spacebar, click, media keys) always remain paused.
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
