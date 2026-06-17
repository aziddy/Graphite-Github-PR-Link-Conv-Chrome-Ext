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
  const ACTIVITY_KEY = "autoScrollActivity";

  let enabled = true; // sticky bar; default on, overwritten by stored setting
  let bar = null;
  let scheduled = false;

  let activityEnabled = true; // auto-scroll Activity pane; default on
  let activityWasOpen = false; // tracks open/close transitions of the pane
  let autoScrollRaf = null; // active scroll animation frame, if any
  let autoScrollCleanup = null; // tears down the animation's abort listeners

  // ---- DOM helpers ---------------------------------------------------------

  // The PR's OWN (source) branch carries the CSS-module class
  // "BranchMetadata_sourceBranchMenu". The base/target branch is a separate
  // "PrBaseBranchSelect_branchName" element — on a stacked PR that base is the
  // branch one step lower in the stack, and it can render as a <button> too, so
  // a generic "branch-name" match would sometimes grab it instead. Target the
  // source explicitly, and never the base select. Queried fresh each call so it
  // stays correct across in-app navigation between stacked PRs.
  function findBranchEl() {
    return (
      document.querySelector('[class*="sourceBranchMenu"]') ||
      document.querySelector('[class*="BranchMetadata_sourceBranch"]') ||
      [...document.querySelectorAll('[class*="branch-name"]')].find(
        (el) => !/PrBaseBranchSelect/.test(el.className.toString())
      ) ||
      null
    );
  }

  function branchName(el) {
    if (!el) return "";
    return (el.getAttribute("title") || el.textContent || "").trim();
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

    left.append(num, icon, name);
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
    // Reuse our bar only if it's still attached and has the expected structure.
    if (bar && bar.isConnected && bar.querySelector(".ghpr-sbb-name")) return bar;
    // Drop any stale or duplicate bars left by a previous version/context so we
    // never operate on an element built by older, mismatched code.
    document.querySelectorAll("#" + BAR_ID).forEach((e) => e.remove());
    bar = buildBar();
    return bar;
  }

  function removeBar() {
    bar = null;
    document.querySelectorAll("#" + BAR_ID).forEach((e) => e.remove());
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
    const nameEl = b.querySelector(".ghpr-sbb-name");
    if (!nameEl) return; // bar structure unexpected; ensureBar rebuilds next tick
    nameEl.textContent = name;
    nameEl.title = name;
    const numEl = b.querySelector(".ghpr-sbb-num");
    if (numEl) numEl.textContent = prNumber();

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

  // ---- Activity pane auto-scroll ------------------------------------------

  // The Activity side panel (opened by pressing `3`) is a fixed-position
  // SidePanel whose header reads "Activity". It's removed from the DOM when
  // closed, so its mere presence means "open".
  function getActivityPane() {
    for (const p of document.querySelectorAll('[class*="SidePanel_sidePanel"]')) {
      const r = p.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) continue;
      const heads = p.querySelectorAll('[class*="font__h3"], h1, h2, h3');
      for (const h of heads) {
        if (h.textContent.trim() === "Activity") return p;
      }
    }
    return null;
  }

  // The inner scroll container that holds the chronological activity list.
  function findActivityScroller(pane) {
    let best = null;
    for (const el of pane.querySelectorAll('[class*="Scrollable_scrollable"]')) {
      if (
        el.scrollHeight > el.clientHeight + 20 &&
        (!best || el.scrollHeight > best.scrollHeight)
      ) {
        best = el;
      }
    }
    if (!best) {
      for (const el of pane.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        if (
          (s.overflowY === "auto" || s.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 20 &&
          (!best || el.scrollHeight > best.scrollHeight)
        ) {
          best = el;
        }
      }
    }
    return best;
  }

  function stopActivityAutoScroll() {
    if (autoScrollRaf !== null) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
    if (autoScrollCleanup) {
      autoScrollCleanup();
      autoScrollCleanup = null;
    }
  }

  // Smoothly animates the pane to the bottom over ~1s when it opens, so the
  // latest commit/comment is in view. The target is re-evaluated each frame so
  // it still lands at the bottom if activity is streaming in. Aborts the moment
  // the user scrolls or interacts, so we never fight a manual scroll.
  function startActivityAutoScroll() {
    stopActivityAutoScroll();
    const pane = getActivityPane();
    const sc = pane && findActivityScroller(pane);
    if (!sc) return;

    const DURATION = 1000;
    const startTop = sc.scrollTop;
    let startTime = null;
    let lastSet = startTop;

    // easeInOutCubic — gentle acceleration and deceleration.
    const ease = (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const SCROLL_KEYS = new Set([
      "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ",
    ]);
    const abort = () => stopActivityAutoScroll();
    const onKey = (e) => {
      if (SCROLL_KEYS.has(e.key)) stopActivityAutoScroll();
    };
    const opts = { passive: true };
    sc.addEventListener("wheel", abort, opts);
    sc.addEventListener("touchstart", abort, opts);
    sc.addEventListener("mousedown", abort, opts); // scrollbar drag
    window.addEventListener("keydown", onKey, opts);
    autoScrollCleanup = () => {
      sc.removeEventListener("wheel", abort, opts);
      sc.removeEventListener("touchstart", abort, opts);
      sc.removeEventListener("mousedown", abort, opts);
      window.removeEventListener("keydown", onKey, opts);
    };

    const frame = (now) => {
      if (startTime === null) startTime = now;
      // If scrollTop drifted from what we set, the user scrolled -> stop.
      if (Math.abs(sc.scrollTop - lastSet) > 2) {
        stopActivityAutoScroll();
        return;
      }
      const target = sc.scrollHeight - sc.clientHeight; // bottom may grow
      const t = Math.min(1, (now - startTime) / DURATION);
      sc.scrollTop = startTop + (target - startTop) * ease(t);
      lastSet = sc.scrollTop;
      if (t < 1) {
        autoScrollRaf = requestAnimationFrame(frame);
      } else {
        sc.scrollTop = sc.scrollHeight - sc.clientHeight; // snap to final bottom
        stopActivityAutoScroll();
      }
    };
    autoScrollRaf = requestAnimationFrame(frame);
  }

  // Detect open/close transitions of the Activity pane.
  function checkActivity() {
    const open = !!getActivityPane();
    if (activityEnabled && open && !activityWasOpen) {
      startActivityAutoScroll();
    } else if (!open && autoScrollRaf !== null) {
      stopActivityAutoScroll();
    }
    activityWasOpen = open;
  }

  // ---- Wiring --------------------------------------------------------------

  function start() {
    // Capture-phase so we also catch scrolls inside Graphite's nested panel.
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    // Catches SPA navigation and late-rendered content.
    setInterval(scheduleUpdate, 750);
    scheduleUpdate();

    // Watches for the Activity pane opening so we can jump it to the latest.
    setInterval(checkActivity, 350);
  }

  chrome.storage.sync.get([SETTING_KEY, ACTIVITY_KEY]).then((res) => {
    enabled = res[SETTING_KEY] !== false; // default on
    activityEnabled = res[ACTIVITY_KEY] !== false; // default on
    start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (SETTING_KEY in changes) {
      enabled = changes[SETTING_KEY].newValue !== false;
      scheduleUpdate();
    }
    if (ACTIVITY_KEY in changes) {
      activityEnabled = changes[ACTIVITY_KEY].newValue !== false;
      if (!activityEnabled) stopActivityAutoScroll();
    }
  });
})();
