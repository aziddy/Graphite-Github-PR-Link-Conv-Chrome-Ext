const SHORTCUTS_URL = "chrome://extensions/shortcuts";

const COMMANDS = [
  { name: "convert-pr-link", defaultMac: "⌘⇧L", defaultOther: "Ctrl+Shift+L" },
  { name: "scroll-to-top", defaultMac: "⌘⇧U", defaultOther: "Ctrl+Shift+U" },
];

const select = document.getElementById("openBehavior");
const saved = document.getElementById("saved");
const stickyBar = document.getElementById("stickyBranchBar");
const autoScrollActivity = document.getElementById("autoScrollActivity");
const savedSticky = document.getElementById("savedSticky");
const changeBtn = document.getElementById("changeShortcut");
const revertBtn = document.getElementById("revertShortcut");
const confirmRevert = document.getElementById("confirmRevert");
const confirmYes = document.getElementById("confirmRevertYes");
const confirmNo = document.getElementById("confirmRevertNo");

const isMac = /mac/i.test(navigator.platform);

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

async function refreshShortcuts() {
  const all = await chrome.commands.getAll();
  for (const { name, defaultMac, defaultOther } of COMMANDS) {
    const kbd = document.querySelector(`kbd[data-cmd="${name}"]`);
    const badge = document.querySelector(`.default-badge[data-cmd="${name}"]`);
    if (!kbd || !badge) continue;

    const cmd = all.find((c) => c.name === name);
    const binding = cmd?.shortcut?.trim();

    if (binding) {
      kbd.textContent = binding;
      const expected = isMac ? defaultMac : defaultOther;
      const isDefault =
        shortcutsMatch(binding, expected) ||
        shortcutsMatch(binding, defaultMac) ||
        shortcutsMatch(binding, defaultOther);
      badge.hidden = !isDefault;
    } else {
      kbd.textContent = "Not set";
      badge.hidden = true;
    }
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

function flashStickySaved() {
  savedSticky.classList.add("visible");
  setTimeout(() => savedSticky.classList.remove("visible"), 1000);
}

chrome.storage.sync
  .get(["stickyBranchBar", "autoScrollActivity"])
  .then(({ stickyBranchBar = true, autoScrollActivity: autoScroll = true }) => {
    stickyBar.checked = stickyBranchBar;
    autoScrollActivity.checked = autoScroll;
  });

stickyBar.addEventListener("change", async () => {
  await chrome.storage.sync.set({ stickyBranchBar: stickyBar.checked });
  flashStickySaved();
});

autoScrollActivity.addEventListener("change", async () => {
  await chrome.storage.sync.set({ autoScrollActivity: autoScrollActivity.checked });
  flashStickySaved();
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

refreshShortcuts();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshShortcuts();
});
