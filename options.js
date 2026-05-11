const DEFAULT_SHORTCUT_MAC = "⌘⇧L";
const DEFAULT_SHORTCUT_OTHER = "Ctrl+Shift+L";
const SHORTCUTS_URL = "chrome://extensions/shortcuts";

const select = document.getElementById("openBehavior");
const saved = document.getElementById("saved");
const currentShortcut = document.getElementById("currentShortcut");
const defaultBadge = document.getElementById("defaultBadge");
const changeBtn = document.getElementById("changeShortcut");
const revertBtn = document.getElementById("revertShortcut");
const confirmRevert = document.getElementById("confirmRevert");
const confirmYes = document.getElementById("confirmRevertYes");
const confirmNo = document.getElementById("confirmRevertNo");

const isMac = /mac/i.test(navigator.platform);
const defaultShortcut = isMac ? DEFAULT_SHORTCUT_MAC : DEFAULT_SHORTCUT_OTHER;

function shortcutsMatch(a, b) {
  const normalize = (s) =>
    (s ?? "")
      .replace(/⌘/g, "Command")
      .replace(/⇧/g, "Shift")
      .replace(/⌥/g, "Alt")
      .replace(/⌃/g, "Ctrl")
      .replace(/\s+/g, "")
      .toLowerCase();
  return normalize(a) === normalize(b);
}

async function refreshShortcut() {
  const commands = await chrome.commands.getAll();
  const cmd = commands.find((c) => c.name === "convert-pr-link");
  const binding = cmd?.shortcut?.trim();

  if (binding) {
    currentShortcut.textContent = binding;
    defaultBadge.hidden = !shortcutsMatch(binding, defaultShortcut) &&
                         !shortcutsMatch(binding, "Ctrl+Shift+L") &&
                         !shortcutsMatch(binding, "Command+Shift+L");
  } else {
    currentShortcut.textContent = "Not set";
    defaultBadge.hidden = true;
  }
}

chrome.storage.sync.get("openBehavior").then(({ openBehavior = "replace" }) => {
  select.value = openBehavior;
});

select.addEventListener("change", async () => {
  await chrome.storage.sync.set({ openBehavior: select.value });
  saved.classList.add("visible");
  setTimeout(() => saved.classList.remove("visible"), 1000);
});

changeBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: SHORTCUTS_URL });
});

revertBtn.addEventListener("click", () => {
  confirmRevert.hidden = false;
});

confirmNo.addEventListener("click", () => {
  confirmRevert.hidden = true;
});

confirmYes.addEventListener("click", () => {
  confirmRevert.hidden = true;
  chrome.tabs.create({ url: SHORTCUTS_URL });
});

refreshShortcut();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshShortcut();
});
