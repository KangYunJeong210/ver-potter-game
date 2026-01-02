// js/title.js
// ----------------------------------------------------
// Title screen controls: New / Continue / Endings
// ----------------------------------------------------

const btnNew = document.getElementById("btnNew");
const btnContinue = document.getElementById("btnContinue");
const btnEndings = document.getElementById("btnEndings");

btnNew?.addEventListener("click", async () => {
  try {
    await window.__startGame?.();
  } catch (e) {
    alert("시작 실패: " + (e?.message || e));
  }
});

btnContinue?.addEventListener("click", async () => {
  try {
    const saved = window.StorageAPI?.load?.();
    if (!saved) return alert("저장된 데이터가 없어요.");
    await window.__loadGameState?.(saved);
  } catch (e) {
    alert("이어하기 실패: " + (e?.message || e));
  }
});

btnEndings?.addEventListener("click", () => {
  // storage.js가 모달 렌더/오픈까지 처리
  document.getElementById("btnEndings")?.click();
});

// 초기 동기화
window.__syncContinue?.();
