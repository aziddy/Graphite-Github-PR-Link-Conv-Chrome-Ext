# Graphite ⇄ GitHub PR Link Converter

A Chrome extension that flips the active tab's URL between Graphite and GitHub PR formats with a single keyboard shortcut or toolbar-icon click. Direction is auto-detected.

## URL mapping

| Graphite                                                       | GitHub                                                |
| -------------------------------------------------------------- | ----------------------------------------------------- |
| `https://app.graphite.com/github/pr/{org}/{repo}/{prNumber}`   | `https://github.com/{org}/{repo}/pull/{prNumber}`     |

Extra sub-paths (e.g. `/files`, `/commits`), query strings, and hash fragments are stripped — the converted URL always points at the canonical PR page.

## Install (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this repository's root folder.

## Usage

- **Convert (keyboard shortcut):** `⌘⇧L` on macOS, `Ctrl+Shift+L` on Windows/Linux — converts the active tab.
- **Toolbar icon:** opens the settings page in a new tab. From there you can:
  - Choose what happens on convert: replace current tab (default), open in new tab, or copy to clipboard.
  - See the current shortcut binding, change it, or revert to default — all of these deep-link to Chrome's built-in shortcut editor (`chrome://extensions/shortcuts`), the only place Chrome lets users rebind extension shortcuts.

If the current tab isn't a recognized PR URL, the toolbar badge briefly shows `✗` and nothing else happens.

## Files

- `manifest.json` — MV3 manifest
- `background.js` — service worker; handles shortcut/click, URL conversion, and dispatch
- `options.html` / `options.js` — settings page (one dropdown, auto-saves)
- `icons/` — toolbar and management-page icons (16/32/48/128 px)
- `assets/App-Icon-V1.png` — source icon (1106×1115)

No build step — vanilla JS.

## Icons

Source: `assets/App-Icon-V1.png`. Rasterized variants live in `icons/` and are referenced from `manifest.json`. To regenerate after editing the source (macOS):

```bash
for size in 16 32 48 128; do
  sips -z $size $size assets/App-Icon-V1.png --out icons/icon${size}.png
done
```
