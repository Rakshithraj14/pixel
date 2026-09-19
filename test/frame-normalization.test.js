const test = require("node:test");
const assert = require("node:assert/strict");
const { median, placeInCell } = require("../src/frame-normalization");

test("median: odd and even length arrays", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([5]), 5);
});

test("placeInCell: baseline alignment bottom-aligns with a margin", () => {
  const cellW = 100;
  const cellH = 200;
  const frame = { width: 40, height: 150 };
  const { left, top } = placeInCell(frame, cellW, cellH, "baseline");
  assert.equal(left, 30); // horizontally centered: (100-40)/2
  const expectedMargin = Math.round(cellH * 0.06);
  assert.equal(top, cellH - expectedMargin - frame.height);
});

test("placeInCell: baseline keeps two different-height frames on the same feet line", () => {
  const cellW = 100;
  const cellH = 200;
  const short = placeInCell({ width: 40, height: 100 }, cellW, cellH, "baseline");
  const tall = placeInCell({ width: 40, height: 150 }, cellW, cellH, "baseline");
  // bottom edge (top + height) must match for both, even though heights differ
  assert.equal(short.top + 100, tall.top + 150);
});

test("placeInCell: center alignment centers both axes", () => {
  const { left, top } = placeInCell({ width: 40, height: 60 }, 100, 200, "center");
  assert.equal(left, 30);
  assert.equal(top, 70);
});
