// Canonical animation set and defaults for turning detected
// source rows into named animations.

const CANONICAL_ANIMATIONS = [
  "idle",
  "walk",
  "sleep",
  "thinking",
  "eating",
  "waving",
  "success",
  "error",
];

// Which alignment mode each animation should use when placing frames in a
// cell ("sleeping" needs a different bounding-box policy
// than standing poses). Anything not listed defaults to "baseline".
const ALIGNMENT_OVERRIDES = {
  sleep: "center",
};

function alignmentFor(name) {
  return ALIGNMENT_OVERRIDES[name] || "baseline";
}

const DEFAULT_PERSONALITY = {
  playful: 0.5,
  lazy: 0.5,
  friendly: 0.5,
  moodswing: 0.5,
};

// Turns a --row-map CLI value ("idle,success,sleep,eating,waving") into an
// ordered list of animation names, one per detected source row. Falls back
// to canonical positional order for any row past the end of an explicit map,
// and silently drops rows beyond the canonical set's length.
function resolveRowMap(rowMapArg, sourceRowCount) {
  const explicit = rowMapArg
    ? rowMapArg.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const names = [];
  for (let i = 0; i < sourceRowCount; i++) {
    const name = explicit[i] || CANONICAL_ANIMATIONS[i];
    if (!name) break; // more source rows than canonical animation slots
    names.push(name);
  }
  return names;
}

module.exports = {
  DEFAULT_PERSONALITY,
  alignmentFor,
  resolveRowMap,
};
