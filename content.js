// Sticky branch-name bar for Graphite PR pages.
//
// Injects a fixed bar at the top of the viewport that shows the PR's source
// branch name once the real branch label has scrolled out of view, so you
// never have to scroll back up to remember which branch you're looking at.
//
// Graphite is a single-page app, so this script is injected on every
// app.graphite.com page and gates its own logic on the PR URL pattern. It
// re-checks the DOM on scroll/resize and on a low-frequency interval to cope
// with client-side navigation and late-loading content.

(() => {
  "use strict";

  const PR_RE = /^https?:\/\/app\.graphite\.com\/github\/pr\/[^/]+\/[^/]+\/\d+/;
  const BAR_ID = "ghpr-sticky-branch-bar";
  const SETTING_KEY = "stickyBranchBar";

  let enabled = true; // default on; overwritten by stored setting below
  let bar = null;
  let branchEl = null; // element holding the source branch name
  let scheduled = false;

  // ---- DOM helpers ---------------------------------------------------------

  // Source branch: a button whose CSS-module class contains "branch-name".
  // (The target branch renders as a <span> with the same substring.)
  function findBranchEl() {
    if (branchEl && branchEl.isConnected) return branchEl;
    branchEl =
      document.querySelector('button[class*="branch-name"]') ||
      document.querySelector('button[aria-haspopup="menu"][title]');
    return branchEl;
  }

  function branchName(el) {
    if (!el) return "";
    return (el.getAttribute("title") || el.textContent || "").trim();
  }

  function targetBranch() {
    // The "→ main" span sits next to the source branch button.
    const spans = document.querySelectorAll('span[class*="branch-name"][title]');
    for (const s of spans) {
      const t = (s.getAttribute("title") || s.textContent || "").trim();
      if (t) return t;
    }
    return "";
  }

  function prNumber() {
    const m = (document.title || "").match(/#(\d+)/);
    return m ? m[0] : "";
  }

  // Replicates the extension's scroll-to-top behaviour (window + any inner
  // scrollable container, since Graphite scrolls a nested panel).
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelectorAll("*").forEach((el) => {
      if (el !== bar && el.scrollTop > 0) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  // ---- Bar construction ----------------------------------------------------

  function buildBar() {
    const el = document.createElement("div");
    el.id = BAR_ID;
    el.setAttribute("role", "complementary");
    el.dataset.visible = "false";

    const left = document.createElement("button");
    left.type = "button";
    left.className = "ghpr-sbb-main";
    left.title = "Scroll to top of PR";

    const num = document.createElement("span");
    num.className = "ghpr-sbb-num";

    const icon = document.createElement("span");
    icon.className = "ghpr-sbb-icon";
    icon.textContent = "⎇"; // branch-ish glyph

    const name = document.createElement("span");
    name.className = "ghpr-sbb-name";

    const arrow = document.createElement("span");
    arrow.className = "ghpr-sbb-arrow";

    const target = document.createElement("span");
    target.className = "ghpr-sbb-target";

    left.append(num, icon, name, arrow, target);
    left.addEventListener("click", scrollToTop);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ghpr-sbb-copy";
    copy.title = "Copy branch name";
    copy.textContent = "Copy";
    copy.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(branchName(findBranchEl()));
        copy.textContent = "Copied";
        copy.classList.add("ghpr-sbb-copied");
        setTimeout(() => {
          copy.textContent = "Copy";
          copy.classList.remove("ghpr-sbb-copied");
        }, 1200);
      } catch (err) {
        console.error("[sticky branch bar] copy failed:", err);
      }
    });

    el.append(left, copy);
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function ensureBar() {
    if (bar && bar.isConnected) return bar;
    bar = buildBar();
    return bar;
  }

  function removeBar() {
    if (bar) {
      bar.remove();
      bar = null;
    }
  }

  // ---- Update loop ---------------------------------------------------------

  function update() {
    scheduled = false;

    if (!enabled || !PR_RE.test(location.href)) {
      removeBar();
      return;
    }

    const el = findBranchEl();
    const name = branchName(el);
    if (!el || !name) {
      // Branch element not present yet (still loading) — hide if we have a bar.
      if (bar) bar.dataset.visible = "false";
      return;
    }

    const b = ensureBar();
    b.querySelector(".ghpr-sbb-name").textContent = name;
    b.querySelector(".ghpr-sbb-name").title = name;
    b.querySelector(".ghpr-sbb-num").textContent = prNumber();

    const tgt = targetBranch();
    b.querySelector(".ghpr-sbb-arrow").textContent = tgt ? "→" : "";
    b.querySelector(".ghpr-sbb-target").textContent = tgt;

    // Show only once the real branch label has scrolled above the viewport.
    const rect = el.getBoundingClientRect();
    const offscreen = rect.bottom <= 4;
    b.dataset.visible = offscreen ? "true" : "false";
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  // ---- Wiring --------------------------------------------------------------

  function start() {
    // Capture-phase so we also catch scrolls inside Graphite's nested panel.
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    // Catches SPA navigation and late-rendered content.
    setInterval(scheduleUpdate, 750);
    scheduleUpdate();
  }

  chrome.storage.sync.get(SETTING_KEY).then((res) => {
    enabled = res[SETTING_KEY] !== false; // default on
    start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && SETTING_KEY in changes) {
      enabled = changes[SETTING_KEY].newValue !== false;
      scheduleUpdate();
    }
  });
})();
