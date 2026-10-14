// Runs in the page's own JS world (manifest "world": "MAIN") so it can read
// window.gameData. Everything lives inside this closure; only the engine is
// exposed, as window.__beeKeeperEngine.
(function () {
  "use strict";
  if (window.__beeKeeperStarted) return;
  window.__beeKeeperStarted = true;

  const engine = window.__beeKeeperEngine;
  const COLLAPSED_KEY = "beeKeeper:collapsed";
  const DOCKED_KEY = "beeKeeper:docked";

  function getPref(key) {
    try {
      return localStorage.getItem(key) === "1";
    } catch (e) {
      return false;
    }
  }
  function setPref(key, on) {
    try {
      localStorage.setItem(key, on ? "1" : "0");
    } catch (e) {}
  }

  // ---- data from the page -------------------------------------------------

  function urlDate() {
    const m = location.pathname.match(/\/spelling-bee\/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  function findPuzzle() {
    const g = window.gameData;
    if (!g) return null;
    const p = g.pastPuzzles || {};
    const all = [g.today, g.yesterday, p.today, p.yesterday, ...(p.thisWeek || []), ...(p.lastWeek || [])];
    const want = urlDate() || (g.today && g.today.printDate);
    return all.find((x) => x && x.printDate === want && x.answers && x.answers.length) || null;
  }

  function foundWords(date) {
    const words = new Set();
    for (const el of document.querySelectorAll(".sb-wordlist-items-pag .sb-anagram")) {
      words.add(el.textContent.trim().toLowerCase());
    }
    // The start screen has no word list; fall back to NYT's saved game state.
    try {
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith("games-state-spelling_bee")) continue;
        const states = JSON.parse(localStorage.getItem(k)).states || [];
        for (const s of states) {
          if (s.printDate === date && s.data && Array.isArray(s.data.answers)) {
            s.data.answers.forEach((w) => words.add(String(w).toLowerCase()));
          }
        }
      }
    } catch (e) {
      // Saved state is optional; the DOM list is the primary source.
    }
    return [...words];
  }

  // ---- panel --------------------------------------------------------------

  const host = document.createElement("div");
  host.id = "bee-keeper-host";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483000;
        width: 340px; max-height: calc(100vh - 32px); overflow: auto;
        background: #fff; color: #121212; border: 1px solid #dcdcdc; border-radius: 10px;
        box-shadow: 0 6px 24px rgba(0,0,0,.14);
        font: 14px/1.35 "nyt-franklin", -apple-system, "Helvetica Neue", Arial, sans-serif;
      }
      header {
        position: sticky; top: 0; display: flex; align-items: center; gap: 8px;
        padding: 10px 12px; background: #f7da21; border-radius: 9px 9px 0 0; cursor: pointer;
        user-select: none;
      }
      header h1 { font-size: 14px; font-weight: 700; margin: 0; flex: 1; }
      header .stat { font-size: 12px; font-variant-numeric: tabular-nums; }
      header .chev { font-size: 12px; width: 12px; text-align: center; }
      .panel.collapsed .body { display: none; }
      .collapsed header { border-radius: 9px; }
      .body { padding: 10px 12px 12px; }
      .summary { display: flex; gap: 14px; font-size: 12px; color: #555; margin-bottom: 10px; }
      .summary b { color: #121212; font-variant-numeric: tabular-nums; }
      h2 { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #777; margin: 14px 0 6px; }
      table { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
      th, td { text-align: center; padding: 3px 0; min-width: 26px; }
      th { font-size: 12px; color: #555; font-weight: 600; }
      td.l { font-weight: 700; text-transform: uppercase; text-align: left; padding-left: 4px; }
      td.l.center { color: #b8860b; }
      td.none { color: #ccc; }
      td.done { color: #9a9a9a; }
      td.open { font-weight: 700; }
      .sum { border-left: 1px solid #e6e6e6; }
      tr.tot td { border-top: 1px solid #e6e6e6; }
      tr.finished td { color: #b5b5b5; font-weight: 400; }
      .twos { display: grid; grid-template-columns: 22px 1fr; row-gap: 4px; }
      .twos .l { font-weight: 700; text-transform: uppercase; }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .chip {
        font-size: 12px; padding: 1px 6px; border-radius: 4px; background: #f4f4f4;
        text-transform: uppercase; font-variant-numeric: tabular-nums;
      }
      .chip b { font-weight: 700; margin-left: 3px; }
      .chip.done { background: none; color: #b5b5b5; text-decoration: line-through; }
      ul.facts { list-style: none; margin: 0; padding: 0; }
      ul.facts li { padding: 5px 0; border-top: 1px solid #f0f0f0; }
      ul.facts li:first-child { border-top: none; }
      ul.facts .who { font-weight: 700; display: inline-block; min-width: 18px; }
      ul.facts .left { color: #777; font-size: 12px; }
      ul.facts .fact { display: block; padding-left: 18px; }
      ul.facts li.note { background: #fdf6c7; border-radius: 4px; padding: 5px 8px; }
      .muted { color: #888; font-size: 12px; }
      header button {
        font: inherit; font-size: 12px; padding: 2px 8px; border-radius: 12px; cursor: pointer;
        border: 1px solid rgba(0,0,0,.35); background: transparent; color: inherit;
      }
      header button:hover { background: rgba(255,255,255,.5); }
      section > h2:first-child { margin-top: 0; }
      section + section { margin-top: 14px; }
      /* Docked: sits in the page flow below the game, sections side by side. */
      .panel.docked {
        position: static; width: auto; max-width: 1080px; max-height: none; overflow: visible;
        margin: 24px auto; box-shadow: none;
      }
      .docked header { position: static; }
      .docked .body {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px 32px; padding: 14px 16px 16px;
      }
      .docked section + section { margin-top: 0; }
      .flash { animation: flash 1.4s ease-out; }
      @keyframes flash { from { background: #f7da21; } to { background: transparent; } }
    </style>
    <div class="panel">
      <header><h1>Bee Keeper</h1><span class="stat"></span><button class="dock"></button><span class="chev"></span></header>
      <div class="body"></div>
    </div>`;
  const panel = shadow.querySelector(".panel");
  const body = shadow.querySelector(".body");
  const headerStat = shadow.querySelector("header .stat");
  const chev = shadow.querySelector("header .chev");

  const dockBtn = shadow.querySelector("header .dock");

  function setCollapsed(c) {
    panel.classList.toggle("collapsed", c);
    chev.textContent = c ? "▴" : "▾";
    setPref(COLLAPSED_KEY, c);
  }
  function applyDocked(d) {
    panel.classList.toggle("docked", d);
    dockBtn.textContent = d ? "Float" : "Dock below";
    dockBtn.title = d ? "Float in the corner" : "Dock below the puzzle";
  }
  function setDocked(d) {
    applyDocked(d);
    setPref(DOCKED_KEY, d);
    if (host.isConnected) place();
  }
  shadow.querySelector("header").addEventListener("click", () =>
    setCollapsed(!panel.classList.contains("collapsed"))
  );
  dockBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setDocked(!panel.classList.contains("docked"));
    if (panel.classList.contains("docked")) host.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // Docked goes right after the game section, which is outside NYT's React
  // root so their re-renders leave it alone. Floating goes at the end of body.
  function place() {
    const anchor = panel.classList.contains("docked") && document.getElementById("spelling-bee-container");
    if (anchor) {
      if (anchor.nextSibling !== host) anchor.after(host);
    } else if (host.parentNode !== document.body) {
      document.body.appendChild(host);
    }
  }

  setCollapsed(getPref(COLLAPSED_KEY));
  applyDocked(getPref(DOCKED_KEY));

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function cell(x) {
    if (x.total === 0) return `<td class="none">·</td>`;
    if (x.remaining === 0) return `<td class="done" title="${x.found}/${x.total} found">✓</td>`;
    return `<td class="open" title="${x.found}/${x.total} found">${x.remaining}</td>`;
  }

  function render(r, changed) {
    headerStat.textContent = `${r.found}/${r.total} words`;
    const grid = `
      <table>
        <tr><th></th>${r.columns.map((c) => `<th>${c.length}</th>`).join("")}<th class="sum">Σ</th></tr>
        ${r.letters
          .map(
            (L) => `
          <tr class="${L.remaining === 0 ? "finished" : ""}">
            <td class="l ${L.letter === r.center ? "center" : ""}">${L.letter}</td>
            ${L.lengths.map((x) => cell(x).replace("<td", `<td data-k="${L.letter}${x.length}"`)).join("")}
            <td class="sum ${L.remaining ? "open" : "done"}">${L.remaining || "✓"}</td>
          </tr>`
          )
          .join("")}
        <tr class="tot"><td class="l">Σ</td>${r.columns.map(cell).join("")}
          <td class="sum open">${r.total - r.found || "✓"}</td></tr>
      </table>`;

    const twos = `<div class="twos">${r.letters
      .map(
        (L) => `<span class="l">${L.letter}</span><span class="chips">${L.prefixes
          .map(
            (p) =>
              `<span class="chip ${p.remaining ? "" : "done"}" data-k="${p.prefix}" title="${p.found}/${p.total} found">${p.prefix}${
                p.remaining ? `<b>${p.remaining}</b>` : ""
              }</span>`
          )
          .join("")}</span>`
      )
      .join("")}</div>`;

    const items = [
      ...r.notes.map((n) => `<li class="note">${esc(n)}</li>`),
      ...r.letters
        .filter((L) => L.remaining > 0)
        .map(
          (L) => `<li><span class="who">${L.letter.toUpperCase()}</span>
            <span class="left">${L.remaining} left</span>
            ${L.facts.map((f) => `<span class="fact">${esc(f)}</span>`).join("")}</li>`
        ),
    ];
    const facts = items.length ? `<ul class="facts">${items.join("")}</ul>` : `<p class="muted">All words found. 🐝</p>`;

    body.innerHTML = `
      <section>
        <div class="summary">
          <span>Points <b>${r.pointsFound}/${r.points}</b></span>
          <span>Pangrams <b>${r.pangramsFound}/${r.pangrams}</b>${r.perfectPangrams ? ` <span title="perfect pangrams (7 letters)">(${r.perfectPangrams} perfect)</span>` : ""}</span>
        </div>
        <h2>Remaining by letter × length</h2>${grid}
      </section>
      <section><h2>Two-letter starts remaining</h2>${twos}</section>
      <section><h2>Deductions</h2>${facts}</section>`;

    for (const k of changed) {
      shadow.querySelectorAll(`[data-k="${k}"]`).forEach((el) => el.classList.add("flash"));
    }
  }

  function renderMessage(msg) {
    headerStat.textContent = "";
    body.innerHTML = `<p class="muted">${esc(msg)}</p>`;
  }

  // ---- update loop --------------------------------------------------------

  let hints = null;
  let lastKey = "";
  let lastFound = null;

  function update() {
    // Stay hidden on the welcome / start screen; the word list only exists once
    // the player has pressed Continue or Play.
    if (!document.querySelector(".sb-wordlist-box")) {
      if (host.isConnected) host.remove();
      lastKey = "";
      return;
    }
    place();
    const puzzle = findPuzzle();
    if (!puzzle) {
      hints = null;
      if (lastKey !== "none") renderMessage("Puzzle data not found on this page. Reload to track this puzzle.");
      lastKey = "none";
      return;
    }
    if (!hints || hints.date !== puzzle.printDate) {
      hints = engine.buildHints(puzzle);
      lastFound = null;
    }
    const found = foundWords(hints.date).sort();
    const key = hints.date + ":" + found.join(",");
    if (key === lastKey) return;
    lastKey = key;

    // Flash the grid cell and prefix chip for newly found words.
    const changed = [];
    if (lastFound) {
      const prev = new Set(lastFound);
      for (const w of found) if (!prev.has(w)) changed.push(w[0] + w.length, w.slice(0, 2));
    }
    lastFound = found;
    render(engine.analyze(hints, found), changed);
  }

  let pending = 0;
  const schedule = () => {
    clearTimeout(pending);
    pending = setTimeout(update, 150);
  };
  new MutationObserver((muts) => {
    if (muts.every((m) => host.contains(m.target) || m.target === host)) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  setInterval(update, 2000); // catches URL changes and saved-state updates
  update();
})();
