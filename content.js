(function () {
  if (window.__cleanReaderLoaded) return;
  window.__cleanReaderLoaded = true;

  const OVERLAY_ID = "clean-reader-overlay";

  const state = {
    active: false,
    fontSize: 20,
    theme: "light"
  };

  // ---------- חילוץ תוכן ----------
  function findMainContent() {
    const candidates = [
      "article",
      "[role='main']",
      "main",
      ".post-content",
      ".article-content",
      ".entry-content",
      "#content"
    ];

    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 400) return el;
    }

    // גיבוי: האלמנט עם הכי הרבה טקסט בפסקאות
    let best = null;
    let bestScore = 0;
    document.querySelectorAll("div, section").forEach((el) => {
      const paragraphs = el.querySelectorAll(":scope > p");
      let score = 0;
      paragraphs.forEach((p) => (score += p.innerText.length));
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best || document.body;
  }

  function buildCleanHTML(source) {
    const clone = source.cloneNode(true);

    clone
      .querySelectorAll(
        "script, style, noscript, iframe, form, nav, aside, footer, header, button, input, select, textarea, svg, canvas, video, audio, [aria-hidden='true'], .ad, .ads, .advertisement, .sidebar, .share, .social, .comments, .related"
      )
      .forEach((n) => n.remove());

    // השארת רק תכונות בטוחות
    clone.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        const keep = ["href", "src", "alt"];
        if (!keep.includes(attr.name)) el.removeAttribute(attr.name);
      });
      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    });

    return clone.innerHTML;
  }

  function getTitle() {
    const h1 = document.querySelector("h1");
    return (h1 && h1.innerText.trim()) || document.title;
  }

  function readingTime(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  }

  // ---------- שמירת העדפות ----------
  async function loadPrefs() {
    try {
      const data = await chrome.storage.sync.get(["fontSize", "theme"]);
      if (data.fontSize) state.fontSize = data.fontSize;
      if (data.theme) state.theme = data.theme;
    } catch (e) {}
  }

  function savePrefs() {
    try {
      chrome.storage.sync.set({ fontSize: state.fontSize, theme: state.theme });
    } catch (e) {}
  }

  // ---------- בניית הממשק ----------
  function applyStyles(overlay) {
    overlay.dataset.theme = state.theme;
    overlay.style.setProperty("--cr-font-size", state.fontSize + "px");
  }

  async function open() {
    await loadPrefs();

    const source = findMainContent();
    const html = buildCleanHTML(source);
    const title = getTitle();
    const minutes = readingTime(source.innerText);

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
      <div class="cr-toolbar">
        <div class="cr-group">
          <button data-act="smaller" title="הקטן גופן">א-</button>
          <button data-act="bigger" title="הגדל גופן">א+</button>
        </div>
        <div class="cr-group">
          <button data-theme="light" title="בהיר">☀️</button>
          <button data-theme="dark" title="כהה">🌙</button>
          <button data-theme="purple" title="סגול">💜</button>
        </div>
        <button class="cr-close" data-act="close" title="סגור (Esc)">✕</button>
      </div>
      <div class="cr-progress"><div class="cr-progress-bar"></div></div>
      <div class="cr-scroll">
        <article class="cr-article">
          <h1 class="cr-title"></h1>
          <div class="cr-meta">⏱ ${minutes} דקות קריאה</div>
          <div class="cr-body">${html}</div>
        </article>
      </div>
    `;

    overlay.querySelector(".cr-title").textContent = title;
    applyStyles(overlay);
    document.documentElement.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";

    // אנימציית כניסה
    requestAnimationFrame(() => overlay.classList.add("cr-visible"));

    // אירועים
    overlay.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.dataset.act === "bigger") {
        state.fontSize = Math.min(34, state.fontSize + 2);
      } else if (btn.dataset.act === "smaller") {
        state.fontSize = Math.max(14, state.fontSize - 2);
      } else if (btn.dataset.act === "close") {
        close();
        return;
      } else if (btn.dataset.theme) {
        state.theme = btn.dataset.theme;
      }
      applyStyles(overlay);
      savePrefs();
    });

    // פס התקדמות
    const scroller = overlay.querySelector(".cr-scroll");
    const bar = overlay.querySelector(".cr-progress-bar");
    scroller.addEventListener("scroll", () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const pct = max > 0 ? (scroller.scrollTop / max) * 100 : 0;
      bar.style.width = pct + "%";
    });

    document.addEventListener("keydown", onKey);
    state.active = true;
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    overlay.classList.remove("cr-visible");
    setTimeout(() => overlay.remove(), 250);
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    state.active = false;
  }

  // ---------- האזנה להודעות ----------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE") {
      state.active ? close() : open();
    }
  });
})();
