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

- **Convert PR link:** `⌘⇧L` on macOS, `Ctrl+Shift+L` on Windows/Linux — converts the active tab.
- **Scroll to top of PR:** `⌘⇧U` on macOS, `Ctrl+Shift+U` on Windows/Linux — smooth-scrolls to the top of the page (only acts on Graphite or GitHub PR pages).
- **Sticky branch-name bar (Graphite):** a compact floating bar that pins the PR's
  source branch name to the top of a Graphite PR page once you scroll past it, so you
  never lose track of which branch you're viewing. It sits just below Graphite's own
  sticky header (which only shows the PR title), so it never covers the native title or
  the Review/Merge/Agent buttons. Click the bar to jump back to the top, or use the
  **Copy** button to copy the branch name. On by default; toggle it in settings.
- **Auto-scroll the Activity pane (Graphite):** when you open the Activity pane
  (press `3` on a PR), it smoothly animates (~1s, eased) down to the latest
  commit/comment at the bottom instead of starting at the top, so you don't have to
  scroll to see recent activity. The target follows content that's still streaming in,
  and the animation aborts the instant you scroll or interact, so it never fights a
  manual scroll. On by default; toggle it in settings.
- **Toolbar icon:** opens the settings page in a new tab. From there you can:
  - Choose what happens on convert: replace current tab (default), open in new tab, or copy to clipboard.
  - Toggle the sticky branch-name bar on Graphite PR pages.
  - Toggle auto-scrolling the Activity pane to the latest.
  - See the current shortcut bindings, change them, or revert to defaults — all of these deep-link to Chrome's built-in shortcut editor (`chrome://extensions/shortcuts`), the only place Chrome lets users rebind extension shortcuts.

If the current tab isn't a recognized PR URL, the toolbar badge briefly shows `✗` and nothing else happens.

## Files

- `manifest.json` — MV3 manifest
- `background.js` — service worker; handles shortcut/click, URL conversion, and dispatch
- `content.js` / `content.css` — sticky branch-name bar injected on Graphite PR pages
- `options.html` / `options.js` — settings page (auto-saves)
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
