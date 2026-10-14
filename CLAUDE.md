# Bee Keeper — notes for working on this repo

Chromium extension (Manifest V3, loaded unpacked) that adds a hints tracker panel to the NYT
Spelling Bee. Plain JS, no build, no dependencies. See README.md for the user-facing description.

## Rules

- **Never display answers.** `buildHints()` in `src/engine.js` is the only code that may touch
  the answer list. Everything downstream must work from hint-level data (letter × length grid,
  two-letter counts, totals) plus the player's found words. Don't pass answers anywhere else.
- Keep `src/engine.js` pure (no DOM) and covered by `test/engine.test.js`. Run `npm test`.
- The content script runs in the page's MAIN world. Keep everything inside its closure. The only
  globals are `window.__beeKeeperEngine` and `window.__beeKeeperStarted`.
- Panel prefs live in the page's localStorage under `beeKeeper:*`.

## NYT page details the extension depends on

Checked October 2026. If something breaks, look here first.

- **Puzzle data**: `window.gameData` (inline script). `gameData.today` is the puzzle for the
  current page, including archive pages. It has `printDate`, `centerLetter`, `outerLetters`,
  `answers` and `pangrams`. `gameData.yesterday` and `gameData.pastPuzzles.{today,yesterday,thisWeek,lastWeek}`
  hold other recent puzzles. Look the puzzle up by the URL date (`/puzzles/spelling-bee/YYYY-MM-DD`).
- **Found words**: `.sb-wordlist-items-pag li .sb-anagram`. This list only exists once the game has
  started.
- **Game started**: the panel shows only when `.sb-wordlist-box` exists. It is absent on the
  welcome/start screen.
- **Saved progress**: `localStorage["games-state-spelling_bee/<userId>"].states[]` with `printDate` and
  `data.answers` (the player's found words). Used as a fallback source.
- **Dock anchor**: `#spelling-bee-container`. The docked panel goes right after it, outside the
  React root (`#pz-game-root`), so re-renders don't remove it.
- **Hints page** (not used, for reference):
  `https://www.nytimes.com/YYYY/MM/DD/crosswords/spelling-bee-forum.html`.

## Testing in a browser

Reload the extension at `brave://extensions` or `chrome://extensions` after changes, then reload
the puzzle tab. Test on an archive puzzle that's already in progress, so you don't start today's
game for the player.
