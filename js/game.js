// js/game.js
const API_URL = "https://YOUR-VERCEL-DOMAIN.vercel.app/api/story";

const els = {
  screenTitle: document.getElementById("screenTitle"),
  screenGame: document.getElementById("screenGame"),
  hudChapter: document.getElementById("hudChapter"),
  chipTurn: document.getElementById("chipTurn"),
  chipLayer: document.getElementById("chipLayer"),
  speakerName: document.getElementById("speakerName"),
  portraitImg: document.getElementById("portraitImg"),
  portraitCaption: document.getElementById("portraitCaption"),
  dialogText: document.getElementById("dialogText"),
  choiceList: document.getElementById("choiceList"),

  barCanonity: document.getElementById("barCanonity"),
  barCorruption: document.getElementById("barCorruption"),
  barSanity: document.getElementById("barSanity"),
  barTrust: document.getElementById("barTrust"),
  barFate: document.getElementById("barFate"),

  overlayEnding: document.getElementById("overlayEnding"),
  endingType: document.getElementById("endingType"),
  endingTitle: document.getElementById("endingTitle"),
  endingText: document.getElementById("endingText"),
  btnEndingHome: document.getElementById("btnEndingHome"),
  btnEndingContinue: document.getElementById("btnEndingContinue")
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const game = {
  turn: 1,
  chapter: "PROLOGUE",
  flags: [],
  lastChoice: null,
  log: [], // {speaker,text}
  state: { canonity: 5, corruption: 0, sanity: 7, trust: 6, fate: 0 }
};

function setBar(el, value) {
  const pct = clamp(value, 0, 10) * 10;
  el.style.width = `${pct}%`;
}

function renderHUD(layer) {
  els.hudChapter.textContent = game.chapter;
  els.chipTurn.textContent = `Turn ${game.turn}`;
  els.chipLayer.textContent =
    layer === "CORRUPT" ? "🩸 Corrupt" : layer === "MIXED" ? "⚠️ Mixed" : "📜 Canon";

  setBar(els.barCanonity, game.state.canonity);
  setBar(els.barCorruption, game.state.corruption);
  setBar(els.barSanity, game.state.sanity);
  setBar(els.barTrust, game.state.trust);
  setBar(els.barFate, game.state.fate);
}

function applyDelta(delta) {
  for (const k of ["canonity","corruption","sanity","trust","fate"]) {
    game.state[k] = clamp(game.state[k] + (delta?.[k] ?? 0), 0, 10);
  }
}

function renderScene(scene) {
  game.chapter = scene.chapter || game.chapter;

  els.speakerName.textContent = scene.speaker || "나 (베르)";
  els.portraitCaption.textContent = (scene.speaker || "베르").replace(/^나\s*\(|\)$/g, "");
  els.portraitImg.src = `./img/portrait/${scene.portrait || "neutral"}.png`;

  els.dialogText.textContent = scene.text || "...";
  renderHUD(scene.layer || "CANON");

  // choices
  els.choiceList.innerHTML = "";
  scene.choices.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    // 타입에 따라 테두리 약간 다르게(옵션)
    btn.dataset.type =
      c.tag === "📜" ? "canon" :
      c.tag === "⚠️" ? "warn" :
      c.tag === "🩸" ? "dark" : "bait";

    btn.innerHTML = `
      <span class="tag">${c.tag}</span>
      <span class="label">${c.label}</span>
    `;
    btn.addEventListener("click", async () => {
      game.lastChoice = { id: c.id, tag: c.tag, label: c.label };
      applyDelta(c.delta);
      game.turn += 1;

      // 로그 누적(요약만 보내도 됨)
      game.log.push({ speaker: scene.speaker, text: scene.text });
      if (game.log.length > 14) game.log.shift();

      const next = await fetchNext();
      renderScene(next);

      if (next.ending) showEnding(next.ending);
    });

    els.choiceList.appendChild(btn);
  });
}

function showEnding(ending) {
  els.endingType.textContent = ending.type === "GOOD" ? "GOOD END" : "BAD END";
  els.endingTitle.textContent = ending.title || (ending.type === "GOOD" ? "RESOLUTION" : "ERASURE");
  els.endingText.textContent = ending.text || "";
  els.overlayEnding.classList.remove("is-hidden");
}

function hideEnding() {
  els.overlayEnding.classList.add("is-hidden");
}

async function fetchNext() {
  // 로그를 “요약 문자열”로 보내면 토큰 절약
  const logSummary = game.log.map(x => `${x.speaker}: ${x.text}`).join("\n").slice(0, 1200);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state: game.state,
      chapter: game.chapter,
      lastChoice: game.lastChoice,
      flags: game.flags,
      log: logSummary
    })
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`API error: ${res.status} ${t}`);
  }
  return await res.json();
}

// 외부에서 시작 버튼 누르면 호출할 수 있게
window.__startGame = async function startGame() {
  game.turn = 1;
  game.chapter = "PROLOGUE";
  game.flags = [];
  game.lastChoice = null;
  game.log = [];
  game.state = { canonity: 5, corruption: 0, sanity: 7, trust: 6, fate: 0 };

  hideEnding();

  const first = await fetchNext();
  renderScene(first);

  els.screenTitle.classList.add("is-hidden");
  els.screenGame.classList.remove("is-hidden");
};

// 엔딩 버튼
els.btnEndingHome?.addEventListener("click", () => {
  hideEnding();
  location.reload(); // 간단히 타이틀로
});
els.btnEndingContinue?.addEventListener("click", () => {
  hideEnding();
});


// js/game.js (패치/추가용) - 아래 블록을 "기존 game.js"에 반영해줘
// ----------------------------------------------------
// 1) __getGameState / __loadGameState 제공
// 2) 엔딩 도달 시 StorageAPI.addEnding 호출 + 자동 저장(옵션)
// ----------------------------------------------------

// ✅ 아래 2개 함수를 game.js 상단(또는 game 객체 선언 아래)에 추가/교체
window.__getGameState = function () {
  // game 객체를 그대로 저장해도 되지만, 필요한 것만 추려서 저장(안전)
  return {
    turn: game.turn,
    chapter: game.chapter,
    flags: game.flags,
    lastChoice: game.lastChoice,
    log: game.log,
    state: game.state
  };
};

window.__loadGameState = async function (savedGame) {
  // savedGame은 StorageAPI.load() 결과(game)
  if (!savedGame) throw new Error("No saved game");
  game.turn = savedGame.turn ?? 1;
  game.chapter = savedGame.chapter ?? "PROLOGUE";
  game.flags = Array.isArray(savedGame.flags) ? savedGame.flags : [];
  game.lastChoice = savedGame.lastChoice ?? null;
  game.log = Array.isArray(savedGame.log) ? savedGame.log : [];
  game.state = savedGame.state ?? { canonity: 5, corruption: 0, sanity: 7, trust: 6, fate: 0 };

  hideEnding?.();

  // 이어할 때도 다음 장면은 AI가 생성하도록: 현재 상태로 1턴 호출
  const scene = await fetchNext();
  renderScene(scene);

  // 화면 전환
  els.screenTitle.classList.add("is-hidden");
  els.screenGame.classList.remove("is-hidden");

  if (scene.ending) showEnding(scene.ending);
};

// ✅ showEnding 함수 안에 아래 2줄을 추가해줘(엔딩 수집)
function showEnding(ending) {
  els.endingType.textContent = ending.type === "GOOD" ? "GOOD END" : "BAD END";
  els.endingTitle.textContent = ending.title || (ending.type === "GOOD" ? "RESOLUTION" : "ERASURE");
  els.endingText.textContent = ending.text || "";
  els.overlayEnding.classList.remove("is-hidden");

  // 🔥 엔딩 기록 저장
  window.StorageAPI?.addEnding?.(ending);
  // 🔒 엔딩 순간 자동 저장(원하면 제거 가능)
  window.StorageAPI?.save?.(window.__getGameState?.());
}

// ✅ 각 선택 버튼 클릭 직후(혹은 renderScene 후) 자동 저장하고 싶으면,
// choice 클릭 핸들러 마지막에 한 줄 추가:
// window.StorageAPI?.save?.(window.__getGameState?.());
