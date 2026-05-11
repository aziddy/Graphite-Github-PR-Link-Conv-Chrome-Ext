const GRAPHITE_RE = /^https?:\/\/app\.graphite\.com\/github\/pr\/([^/]+)\/([^/]+)\/(\d+)/;
const GITHUB_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

function convert(url) {
  let m = url.match(GRAPHITE_RE);
  if (m) return `https://github.com/${m[1]}/${m[2]}/pull/${m[3]}`;
  m = url.match(GITHUB_RE);
  if (m) return `https://app.graphite.com/github/pr/${m[1]}/${m[2]}/${m[3]}`;
  return null;
}

function isPrPage(url) {
  return GRAPHITE_RE.test(url) || GITHUB_RE.test(url);
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

async function scrollToTop(tab) {
  if (!tab?.id) return;
  if (!isPrPage(tab.url ?? "")) {
    flashBadge(tab.id, "✗", "#c0392b");
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        document.querySelectorAll("*").forEach((el) => {
          if (el.scrollTop > 0) {
            el.scrollTo({ top: 0, behavior: "smooth" });
          }
        });
      },
    });
  } catch (err) {
    console.error("Scroll-to-top failed:", err);
    flashBadge(tab.id, "✗", "#c0392b");
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (command === "convert-pr-link") {
    await convertActiveTab(tab);
  } else if (command === "scroll-to-top") {
    await scrollToTop(tab);
  }
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
