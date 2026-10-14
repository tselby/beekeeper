const test = require("node:test");
const assert = require("node:assert/strict");
const { buildHints, analyze } = require("../src/engine.js");

// The engine only looks at first letters, two-letter prefixes and lengths,
// so the "words" here are made up to shape the hints.
function puzzle(answers, center = "a", outer = ["b", "c", "d", "e", "n", "r"]) {
  return { printDate: "2026-10-13", centerLetter: center, outerLetters: outer, answers };
}

test("buildHints produces the hints-page grid and two-letter list", () => {
  const h = buildHints(puzzle(["anbc", "anbcd", "adbce", "rabcd"]));
  assert.deepEqual(h.grid, { a: { 4: 1, 5: 2 }, r: { 5: 1 } });
  assert.deepEqual(h.twos, { an: 2, ad: 1, ra: 1 });
  assert.deepEqual(h.lengths, [4, 5]);
  assert.equal(h.total, 4);
  assert.equal(h.points, 1 + 5 + 5 + 5);
});

test("pangrams and perfect pangrams are counted and scored", () => {
  const h = buildHints(puzzle(["abcdenr", "abcdenrr", "anbc"]));
  assert.equal(h.pangrams, 2);
  assert.equal(h.perfectPangrams, 1);
  assert.equal(h.points, 7 + 7 + 8 + 7 + 1);
});

test("one word left: prefix and length are both pinned", () => {
  // 5 A words: AN x3, AD x2. Found all AN plus one AD.
  const h = buildHints(puzzle(["anbc", "anbcd", "anbce", "adbcd", "adbce"]));
  const r = analyze(h, ["anbc", "anbcd", "anbce", "adbcd"]);
  const a = r.letters.find((x) => x.letter === "a");
  assert.equal(a.remaining, 1);
  assert.deepEqual(a.facts, ["Last A word: AD-, 5 letters."]);
});

test("forced cells come from prefix and length counts together", () => {
  // R remaining: RA x3, RO x1; lengths 4 x1, 5 x3. At least 2 RA- must be 5 letters.
  const h = buildHints(puzzle(["rabc", "rabcd", "rabce", "robcd"]));
  const r = analyze(h, []);
  const rr = r.letters.find((x) => x.letter === "r");
  assert.deepEqual(rr.facts, ["At least 2 RA- words are 5 letters."]);
  const cell = rr.cells.find((c) => c.prefix === "ro" && c.length === 4);
  assert.deepEqual([cell.min, cell.max], [0, 1]);
});

test("single prefix or single length is summarised instead of listing cells", () => {
  // RA x2 (4, 5), RO x1 (5). After finding the 4-letter word, both left are 5 letters.
  const h = buildHints(puzzle(["rabc", "rabcd", "robcd"]));
  assert.deepEqual(analyze(h, ["rabc"]).letters[0].facts, ["All 2 are 5 letters."]);

  // RA x3 (4), RO x1 (6). After finding the RO word, everything left is RA- and 4 letters.
  const h2 = buildHints(puzzle(["rabc", "rabd", "rabe", "robcfg"]));
  assert.deepEqual(analyze(h2, ["robcfg"]).letters[0].facts, [
    "All 3 start RA-",
    "All 3 are 4 letters.",
  ]);
});

test("nothing is forced when counts leave every cell open", () => {
  // RA x2, RO x2; 4 x2, 5 x2.
  const h = buildHints(puzzle(["rabc", "rabd", "robce", "robcf"]));
  assert.deepEqual(analyze(h, []).letters[0].facts, []);
});

test("several cells can be forced at once", () => {
  // RA x2, RO x2; 4 x1, 5 x3 -> at least one of each prefix is 5 letters.
  const h = buildHints(puzzle(["rabc", "rabde", "robcf", "robcg"]));
  assert.deepEqual(analyze(h, []).letters[0].facts, [
    "At least 1 RA- word is 5 letters.",
    "At least 1 RO- word is 5 letters.",
  ]);
});

test("found words the hints rule out are ignored", () => {
  const h = buildHints(puzzle(["anbc", "rabcd"]));
  const r = analyze(h, ["anbc", "anbc", "zzzz", "anbcdefg", "anxx"]);
  assert.equal(r.found, 1);
});

test("pangram note fires when every long word left must be a pangram", () => {
  const h = buildHints(puzzle(["abcdenr", "rabcdenx", "anbc", "anbce"]));
  // Two 7+ words; one is a pangram. Find the non-pangram long word.
  const r = analyze(h, ["rabcdenx"]);
  assert.deepEqual(r.notes, ["The last 7+ letter word is the remaining pangram."]);
  assert.equal(r.pangramsFound, 1); // rabcdenx contains all 7 letters too
});

test("totals and columns", () => {
  const h = buildHints(puzzle(["anbc", "anbcd", "rabcd"]));
  const r = analyze(h, ["anbcd"]);
  assert.equal(r.found, 1);
  assert.equal(r.pointsFound, 5);
  assert.deepEqual(
    r.columns.map((c) => [c.length, c.total, c.remaining]),
    [[4, 1, 1], [5, 2, 1]]
  );
});
