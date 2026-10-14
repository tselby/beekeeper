# Bee Keeper

A browser extension for the [New York Times Spelling Bee](https://www.nytimes.com/puzzles/spelling-bee)
that keeps score against the hints for you.

The daily hints page publishes a letter × length grid and a two-letter list ("5 words start
with A, 2 of them are 4 letters, AD-1 AN-3 …"). Bee Keeper puts those hints next to the game,
counts them down as you find words, and works out what the remaining words must look like:

> **A** · 1 left — Last A word: AD-, 5 letters.
>
> **R** · 4 left — At least 2 RA- words are 5 letters.

It never shows you a word.

## Features

- **Remaining grid**: words left for each starting letter and length, with ✓ when a cell is done.
  Hover a cell to see found/total.
- **Two-letter list**: each starting pair counts down and is crossed out when finished.
- **Deductions**: for each letter, what the hints force about the words you haven't found yet.
  There's also a note when every remaining 7+ letter word has to be a pangram.
- **Live updates**: the panel follows the game's own word list. Newly found words briefly
  highlight their grid cell and two-letter start.
- **Points and pangrams**: found/total, including how many pangrams are perfect (7 letters).
- **Float or dock**: a floating panel in the corner, or docked under the puzzle for narrow windows.
  Click the header to collapse it.
- **Archive puzzles**: works on `/puzzles/spelling-bee/YYYY-MM-DD` pages too.

## Install

Bee Keeper isn't in an extension store. Load it unpacked in any Chromium browser
(Chrome, Brave, Edge, Arc):

1. Download the zip from the [latest release](https://github.com/tselby/beekeeper/releases/latest)
   and unzip it.
2. Open `chrome://extensions` (`brave://extensions` in Brave) and turn on **Developer mode**.
3. Click **Load unpacked** and select the unzipped `beekeeper` folder.
4. Open the Spelling Bee and press **Play** or **Continue**. The panel appears once the game starts.

Keep the folder somewhere permanent. The browser loads the extension from it every time it starts.

To update, download the new release and replace the folder's contents. Then click the reload icon
on the extension's card and reload the puzzle tab.

## Development

No build step and no dependencies. You need Node 18+ for the tests. You can also load the
repository folder itself with **Load unpacked**.

```
npm test                       # engine unit tests (node --test)
python3 scripts/make_icons.py  # regenerate icons/*.png (no dependencies)
```

| Path | What it does |
| --- | --- |
| `manifest.json` | Manifest V3. One content script on `nytimes.com/puzzles/spelling-bee*`. No permissions. |
| `src/engine.js` | Pure logic: answers → hint counts, then hints + found words → remaining counts and deductions. |
| `src/content.js` | Reads the page, finds your words, renders the panel in a shadow root. |
| `test/` | Unit tests for the engine. |
| `scripts/make_icons.py` | Draws the toolbar icons. |

The content script runs in the page's own JavaScript world (`"world": "MAIN"`) so it can read the
puzzle data. It depends on a few details of the NYT page, listed in [`CLAUDE.md`](CLAUDE.md). If
the NYT changes the page, those are the places to check first.

## Disclaimer

Bee Keeper is an independent fan project. It is not affiliated with or endorsed by The New York
Times. "Spelling Bee" and "The New York Times" are trademarks of The New York Times Company.
You need your own access to the game to use it.

## License

[MIT](LICENSE)
