// js/storage.js
// ----------------------------------------------------
// Save/Load + Endings collection + UI open/close helpers
// (GitHub Pages front용 localStorage)
// ----------------------------------------------------

(() => {
  const KEY_SAVE = "verpotter_save_v1";
  const KEY_ENDINGS = "verpotter_endings_v1";

  const qs = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  const el = {
    // title buttons
    btnContinue: qs("#btnContinue"),
    btnEndings: qs("#btnEndings"),

    // hud/menu
    btnMenu: qs("#btnMenu"),
    btnSave: qs("#btnSave"),
    sheetMenu: qs("#sheetMenu"),
    btnSave2: qs("#btnSave2"),
    btnLoad: qs("#btnLoad"),
    btnRestart: qs("#btnRestart"),
    btnResetEndings: qs("#btnResetEndings"),

    // modals
    modalLog: qs("#modalLog"),
    btnLog: qs("#btnLog"),
    logList: qs("#logList"),

    modalEndings: qs("#modalEndings"),
    endingGrid: qs("#endingGrid"),

    // screens
    screenTitle: qs("#screenTitle"),
    screenGame: qs("#screenGame"),
  };

  // ---------- Base helpers ----------
  function openLayer(layerEl) {
    if (!layerEl) return;
    layerEl.classList.remove("is-hidden");
  }
  function closeLayer(layerEl) {
    if (!layerEl) return;
    layerEl.classList.add("is-hidden");
  }
  function closeById(id) {
    const node = qs(`#${id}`);
    if (node) closeLayer(node);
  }

  // click outside / close buttons
  function bindCloseEvents() {
    qsa("[data-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-close");
        closeById(id);
      });
    });

    // esc close (desktop)
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeLayer(el.sheetMenu);
      closeLayer(el.modalLog);
      closeLayer(el.modalEndings);
    });
  }

  // ---------- Save data shape ----------
  function defaultEndings() {
    return {
      // id -> {id, type, title, text, ts}
      items: {}
    };
  }

  function hasSave() {
    return !!localStorage.getItem(KEY_SAVE);
  }

  function readSave() {
    const raw = localStorage.getItem(KEY_SAVE);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function writeSave(saveObj) {
    localStorage.setItem(KEY_SAVE, JSON.stringify(saveObj));
    syncContinueButton();
  }

  function clearSave() {
    localStorage.removeItem(KEY_SAVE);
    syncContinueButton();
  }

  function readEndings() {
    const raw = localStorage.getItem(KEY_ENDINGS);
    if (!raw) return defaultEndings();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.items) return defaultEndings();
      return parsed;
    } catch {
      return defaultEndings();
    }
  }

  function writeEndings(endingStore) {
    localStorage.setItem(KEY_ENDINGS, JSON.stringify(endingStore));
  }

  function resetEndings() {
    writeEndings(defaultEndings());
    renderEndingsModal();
  }

  // ---------- Public API (used by game.js/title.js) ----------
  // 게임 진행 상태를 저장/불러오기 위해 window.StorageAPI 제공
  window.StorageAPI = {
    save(game) {
      // game: {turn, chapter, flags, lastChoice, log, state}
      const payload = {
        v: 1,
        ts: Date.now(),
        game: game
      };
      writeSave(payload);
      return true;
    },
    load() {
      const data = readSave();
      return data?.game ?? null;
    },
    clearSave,
    hasSave,

    addEnding(ending) {
      // ending: {type:"GOOD|BAD", title, text}
      // 동일 엔딩 중복 방지: type+title로 id 생성
      const store = readEndings();
      const id = `${ending.type || "BAD"}::${(ending.title || "ENDING").trim()}`.slice(0, 80);
      if (!store.items[id]) {
        store.items[id] = {
          id,
          type: ending.type || "BAD",
          title: ending.title || "ENDING",
          text: ending.text || "",
          ts: Date.now()
        };
        writeEndings(store);
      }
      renderEndingsModal();
      return id;
    },

    getEndings() {
      return readEndings();
    }
  };

  // ---------- UI: Continue button enable ----------
  function syncContinueButton() {
    if (!el.btnContinue) return;
    el.btnContinue.disabled = !hasSave();
  }

  // ---------- UI: Log modal render ----------
  function renderLogModalFromGame(game) {
    if (!el.logList) return;
    el.logList.innerHTML = "";
    const log = Array.isArray(game?.log) ? game.log : [];
    if (!log.length) {
      el.logList.innerHTML = `<div class="log-item"><div class="who">로그</div><p class="say">아직 기록이 없어요.</p></div>`;
      return;
    }
    log.forEach((row) => {
      const item = document.createElement("div");
      item.className = "log-item";
      item.innerHTML = `
        <div class="who">${escapeHtml(row.speaker || "")}</div>
        <p class="say">${escapeHtml(row.text || "")}</p>
      `;
      el.logList.appendChild(item);
    });
  }

  // ---------- UI: Endings modal render ----------
  function renderEndingsModal() {
    if (!el.endingGrid) return;
    const store = readEndings();
    const items = Object.values(store.items || {})
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));

    el.endingGrid.innerHTML = "";
    if (!items.length) {
      el.endingGrid.innerHTML = `
        <div class="ending-card" style="grid-column:1 / -1;">
          <div class="type">NONE</div>
          <div class="name">아직 모은 엔딩이 없어요</div>
          <p class="desc">배드/굿 엔딩을 모아보세요.</p>
        </div>`;
      return;
    }

    items.forEach((it) => {
      const card = document.createElement("div");
      card.className = "ending-card";
      card.innerHTML = `
        <div class="type">${escapeHtml(it.type || "")}</div>
        <div class="name">${escapeHtml(it.title || "")}</div>
        <p class="desc">${escapeHtml((it.text || "").slice(0, 120))}${(it.text||"").length>120 ? "…" : ""}</p>
      `;
      card.addEventListener("click", () => {
        // 클릭하면 전체 텍스트를 alert로 간단히(원하면 모달 상세로 확장 가능)
        alert(`[${it.type}] ${it.title}\n\n${it.text}`);
      });
      el.endingGrid.appendChild(card);
    });
  }

  // ---------- Wire UI buttons ----------
  function bindUI() {
    // menu open
    el.btnMenu?.addEventListener("click", () => openLayer(el.sheetMenu));

    // save buttons
    el.btnSave?.addEventListener("click", () => {
      const g = window.__getGameState?.();
      if (!g) return alert("저장할 게임 상태가 없어요.");
      window.StorageAPI.save(g);
      toast("저장했어요 💾");
    });

    el.btnSave2?.addEventListener("click", () => {
      const g = window.__getGameState?.();
      if (!g) return alert("저장할 게임 상태가 없어요.");
      window.StorageAPI.save(g);
      toast("저장했어요 💾");
      closeLayer(el.sheetMenu);
      syncContinueButton();
    });

    // load (in-game)
    el.btnLoad?.addEventListener("click", async () => {
      const saved = window.StorageAPI.load();
      if (!saved) return alert("저장된 데이터가 없어요.");
      closeLayer(el.sheetMenu);
      await window.__loadGameState?.(saved);
      toast("불러왔어요 📂");
    });

    // restart
    el.btnRestart?.addEventListener("click", () => {
      if (!confirm("처음부터 다시 시작할까요? (현재 진행은 저장해두면 이어할 수 있어요)")) return;
      closeLayer(el.sheetMenu);
      window.__startGame?.();
    });

    // reset endings
    el.btnResetEndings?.addEventListener("click", () => {
      if (!confirm("모은 엔딩 기록을 초기화할까요?")) return;
      resetEndings();
      toast("엔딩 기록을 초기화했어요.");
      closeLayer(el.sheetMenu);
    });

    // log modal open
    el.btnLog?.addEventListener("click", () => {
      const g = window.__getGameState?.();
      renderLogModalFromGame(g);
      openLayer(el.modalLog);
    });

    // endings open (title & in-game)
    el.btnEndings?.addEventListener("click", () => {
      renderEndingsModal();
      openLayer(el.modalEndings);
    });

    // continue button (title) — 실제 로드는 title.js에서 start 호출하면서 사용
    syncContinueButton();

    // render endings once
    renderEndingsModal();
  }

  // ---------- tiny toast ----------
  let toastTimer = null;
  function toast(msg) {
    const old = qs("#__toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.id = "__toast";
    t.textContent = msg;
    t.style.position = "absolute";
    t.style.left = "50%";
    t.style.bottom = "18px";
    t.style.transform = "translateX(-50%)";
    t.style.zIndex = "999";
    t.style.padding = "10px 12px";
    t.style.borderRadius = "999px";
    t.style.border = "1px solid rgba(255,255,255,.14)";
    t.style.background = "rgba(15,23,48,.75)";
    t.style.backdropFilter = "blur(10px)";
    t.style.boxShadow = "0 10px 24px rgba(0,0,0,.25)";
    t.style.fontWeight = "800";
    t.style.fontSize = "13px";
    document.querySelector(".app")?.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 1200);
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- init ----------
  bindCloseEvents();
  bindUI();

  // expose for debugging
  window.__renderEndingsModal = renderEndingsModal;
  window.__syncContinue = syncContinueButton;
})();
