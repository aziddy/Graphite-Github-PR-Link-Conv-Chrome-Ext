const GRAPHITE_RE = /^https?:\/\/app\.graphite\.com\/github\/pr\/([^/]+)\/([^/]+)\/(\d+)/;
const GITHUB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

function convert(url) {
  let m = url.match(GRAPHITE_RE);
  if (m) return `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`;
  m = url.match(GITHUB_RE);
  if (m) return `https://app.graphite.com/github/pr/${m[1]}/${m[2]}/${m[3]}`;
  return null;
}

function flashBadge(tabId, text, color) {
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  chrome.action.setBadgeText({ text, tabId });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId });
  }, 1500);
}

async function copyToClipboard(tabId, text) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (t) => navigator.clipboard.writeText(t),
    args: [text],
  });
}

async function convertActiveTab(tab) {
  if (!tab?.id) return;
  const target = convert(tab.url ?? "");
  if (!target) {
    flashBadge(tab.id, "✗", "#c0392b");
    return;
  }

  const { openBehavior = "replace" } = await chrome.storage.sync.get("openBehavior");

  if (openBehavior === "newTab") {
    await chrome.tabs.create({ url: target, index: tab.index + 1, active: true });
  } else if (openBehavior === "clipboard") {
    try {
      await copyToClipboard(tab.id, target);
      flashBadge(tab.id, "✓", "#27ae60");
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      flashBadge(tab.id, "✗", "#c0392b");
    }
  } else {
    await chrome.tabs.update(tab.id, { url: target });
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "convert-pr-link") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await convertActiveTab(tab);
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
