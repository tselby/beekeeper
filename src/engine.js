// Spelling Bee hint engine.
//
// The puzzle's answer list is used exactly once, in buildHints(), to produce the
// same information the NYT hints page publishes (letter x length grid, two-letter
// list, totals). Everything after that works only from those hints plus the words
// the player has found, so Bee Keeper never knows more than the hints page does.
(function (root) {
  "use strict";

  function wordPoints(word, isPangram) {
    return (word.length === 4 ? 1 : word.length) + (isPangram ? 7 : 0);
  }

  function isPangram(word, letters) {
    return letters.every((l) => word.includes(l));
  }

  // puzzle: { printDate, centerLetter, outerLetters, answers }
  function buildHints(puzzle) {
    const letters = [puzzle.centerLetter, ...puzzle.outerLetters];
    const grid = {}; // first letter -> length -> count
    const twos = {}; // two-letter prefix -> count
    const lengths = new Set();
    let points = 0;
    let pangrams = 0;
    let perfectPangrams = 0;

    for (const raw of puzzle.answers) {
      const w = raw.toLowerCase();
      const f = w[0];
      const p = w.slice(0, 2);
      lengths.add(w.length);
      grid[f] = grid[f] || {};
      grid[f][w.length] = (grid[f][w.length] || 0) + 1;
      twos[p] = (twos[p] || 0) + 1;
      const pg = isPangram(w, letters);
      if (pg) {
        pangrams++;
        if (w.length === 7) perfectPangrams++;
      }
      points += wordPoints(w, pg);
    }

    return {
      date: puzzle.printDate,
      center: puzzle.centerLetter,
      letters: [...letters].sort(),
      total: puzzle.answers.length,
      points,
      pangrams,
      perfectPangrams,
      lengths: [...lengths].sort((a, b) => a - b),
      grid,
      twos,
    };
  }

  function sum(values) {
    return values.reduce((a, b) => a + b, 0);
  }

  function plural(n, one, many) {
    return n === 1 ? one : many;
  }

  // Remaining words starting with one letter form an unknown prefix x length
  // table whose row sums (remaining per prefix) and column sums (remaining per
  // length) are known. For such tables the tight bounds on any cell are
  //   max = min(row, col)        min = max(0, row + col - total)
  // and every value in between is achievable, so these bounds capture
  // everything the hints can tell you about that letter.
  function letterAnalysis(f, remLengths, remPrefixes) {
    const n = sum(remLengths.map((x) => x.remaining));
    const P = remPrefixes.filter((x) => x.remaining > 0);
    const L = remLengths.filter((x) => x.remaining > 0);
    const cells = [];
    for (const p of P) {
      for (const l of L) {
        cells.push({
          prefix: p.prefix,
          length: l.length,
          min: Math.max(0, p.remaining + l.remaining - n),
          max: Math.min(p.remaining, l.remaining),
        });
      }
    }

    const facts = [];
    const F = f.toUpperCase();
    const pre = (p) => p.toUpperCase() + "-";
    if (n === 1) {
      facts.push(`Last ${F} word: ${pre(P[0].prefix)}, ${L[0].length} letters.`);
    } else if (n > 1) {
      if (P.length === 1) facts.push(`All ${n} start ${pre(P[0].prefix)}`);
      if (L.length === 1) facts.push(`All ${n} are ${L[0].length} letters.`);
      if (P.length > 1 && L.length > 1) {
        for (const c of cells) {
          if (c.min === 0) continue;
          // min === max only happens with a single prefix or length, handled above.
          facts.push(
            `At least ${c.min} ${pre(c.prefix)} ${plural(c.min, "word is", "words are")} ${c.length} letters.`
          );
        }
      }
    }
    return { remaining: n, cells, facts };
  }

  // hints: from buildHints. found: array of words the player has found.
  function analyze(hints, found) {
    const foundSet = [...new Set(found.map((w) => w.toLowerCase()))];
    const foundGrid = {};
    const foundTwos = {};
    const counted = [];
    for (const w of foundSet) {
      const f = w[0];
      const p = w.slice(0, 2);
      // Ignore anything the hints say cannot exist (stale DOM, other puzzles).
      if (!hints.grid[f] || !hints.grid[f][w.length] || !hints.twos[p]) continue;
      if ((foundGrid[f] && foundGrid[f][w.length]) >= hints.grid[f][w.length]) continue;
      if (foundTwos[p] >= hints.twos[p]) continue;
      foundGrid[f] = foundGrid[f] || {};
      foundGrid[f][w.length] = (foundGrid[f][w.length] || 0) + 1;
      foundTwos[p] = (foundTwos[p] || 0) + 1;
      counted.push(w);
    }

    const pangramsFound = counted.filter((w) => isPangram(w, hints.letters)).length;
    const pointsFound = sum(counted.map((w) => wordPoints(w, isPangram(w, hints.letters))));

    const letters = Object.keys(hints.grid)
      .sort()
      .map((f) => {
        const lengths = hints.lengths.map((L) => {
          const total = hints.grid[f][L] || 0;
          const got = (foundGrid[f] && foundGrid[f][L]) || 0;
          return { length: L, total, found: got, remaining: total - got };
        });
        const prefixes = Object.keys(hints.twos)
          .filter((p) => p[0] === f)
          .sort()
          .map((p) => {
            const got = foundTwos[p] || 0;
            return { prefix: p, total: hints.twos[p], found: got, remaining: hints.twos[p] - got };
          });
        const a = letterAnalysis(f, lengths, prefixes);
        return {
          letter: f,
          total: sum(lengths.map((x) => x.total)),
          remaining: a.remaining,
          lengths,
          prefixes,
          cells: a.cells,
          facts: a.facts,
        };
      });

    const notes = [];
    const pangramsLeft = hints.pangrams - pangramsFound;
    const longLeft = sum(
      letters.flatMap((x) => x.lengths.filter((l) => l.length >= 7).map((l) => l.remaining))
    );
    if (pangramsLeft > 0 && pangramsLeft === longLeft) {
      notes.push(
        longLeft === 1
          ? "The last 7+ letter word is the remaining pangram."
          : `All ${longLeft} remaining 7+ letter words are pangrams.`
      );
    }

    const columns = hints.lengths.map((L) => {
      const total = sum(letters.map((x) => x.lengths.find((l) => l.length === L).total));
      const got = sum(letters.map((x) => x.lengths.find((l) => l.length === L).found));
      return { length: L, total, found: got, remaining: total - got };
    });

    return {
      date: hints.date,
      center: hints.center,
      total: hints.total,
      found: counted.length,
      points: hints.points,
      pointsFound,
      pangrams: hints.pangrams,
      pangramsFound,
      perfectPangrams: hints.perfectPangrams,
      columns,
      letters,
      notes,
    };
  }

  const api = { buildHints, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.__beeKeeperEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
