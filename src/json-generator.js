// JSON generator (roadmap.md §5, §20): builds pet.json from the atlas
// layout instead of hand-writing it per character.

const { DEFAULT_PERSONALITY } = require("./animation-map");

// Sensible per-animation fps/loop defaults (roadmap.md §5's example),
// overridable per row via row.fps/row.loop.
const ANIMATION_DEFAULTS = {
  idle: { fps: 5, loop: true },
  walk: { fps: 8, loop: true },
  sleep: { fps: 2, loop: true },
  thinking: { fps: 3, loop: true },
  eating: { fps: 5, loop: true },
  waving: { fps: 5, loop: true },
  success: { fps: 6, loop: false },
  error: { fps: 4, loop: false },
};

function generatePetJson({ id, displayName, description, layout, rows, personality }) {
  const animations = {};
  rows.forEach((row, i) => {
    const defaults = ANIMATION_DEFAULTS[row.name] || { fps: 6, loop: true };
    animations[row.name] = {
      row: i,
      frames: row.frames.length,
      fps: row.fps ?? defaults.fps,
      loop: row.loop ?? defaults.loop,
    };
  });

  return {
    id,
    displayName,
    description,
    version: "1.0.0",
    formatVersion: 1,
    sprite: {
      path: "spritesheet.webp",
      frameWidth: layout.cellWidth,
      frameHeight: layout.cellHeight,
      columns: layout.columns,
      rows: layout.rows,
      scale: 1,
    },
    animations,
    personality: { ...DEFAULT_PERSONALITY, ...personality },
  };
}

module.exports = { generatePetJson };
