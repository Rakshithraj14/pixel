DeskForge Character Asset Pipeline

Goal

Build a reliable pipeline that converts an AI-generated character/animation image into a clean, runtime-ready:

spritesheet.webp

pet.json

The pipeline must work for both:

Curated/famous characters.

User-uploaded photos converted into custom DeskForge characters.

The key principle is:

The AI generates the artwork. DeskForge owns the normalization, frame detection, sprite-sheet construction, validation, and JSON generation.

Do not depend on the AI model to produce a technically perfect game-ready sprite sheet.

1. Target Architecture

                    Character Request
                           |
              +------------+-------------+
              |                          |
        Famous Character           User Photo
              |                          |
              +------------+-------------+
                           |
                           v
                  Image Generation
                  / Image Editing
                           |
                           v
                AI Source Image (PNG)
                           |
                           v
              Source Image Normalizer
                           |
                           v
               Frame Detection / Crop
                           |
                           v
                Frame Quality Checker
                           |
                           v
             Frame Normalization Engine
                           |
                           v
                 Sprite Atlas Builder
                           |
                           v
                    spritesheet.webp
                           |
                           +----------------+
                           |                |
                           v                v
                     JSON Generator     Validator
                           |                |
                           +-------+--------+
                                   |
                                   v
                             DeskForge Pet

2. Separate AI Generation From Sprite Processing

The biggest lesson from the current Chopper test is that the AI-generated image can look good while the final processed WebP can still be broken.

Current observed pipeline:

AI image
   |
   | good character frames
   v
processor
   |
   | incorrect frame/row handling
   v
broken spritesheet.webp

Therefore, the image model should not be responsible for:

exact pixel dimensions

exact frame coordinates

atlas packing

final WebP layout

JSON generation

animation metadata

runtime compatibility

Those should be handled deterministically by DeskForge tooling.

3. Define the Canonical DeskForge Asset Contract

Before implementing processing, define one internal format.

Recommended structure:

character/
├── pet.json
├── spritesheet.webp
├── preview.png
└── source/
    └── source.png

For a larger development package:

character/
├── pet.json
├── spritesheet.webp
├── preview.png
├── source/
│   └── source.png
└── frames/
    ├── idle/
    ├── walk/
    ├── sleep/
    ├── thinking/
    ├── eating/
    ├── waving/
    ├── success/
    └── error/

The frames/ directory is useful during development but does not have to ship with the final character.

4. Canonical Animation Set

DeskForge should have a standard set of animation identifiers.

Recommended V1:

idle
walk
sleep
thinking
eating
waving
success
error

Do not require every character to have every animation.

Instead, define fallbacks.

Recommended fallback priority:

missing animation
       |
       v
same character's idle
       |
       v
global default animation
       |
       v
global default character

This prevents a character package from breaking because one animation is missing.

5. Use a Global Character Definition

Every character should have a predictable JSON contract.

Recommended pet.json:

{
  "id": "chopper",
  "displayName": "Chopper",
  "description": "A tiny reindeer doctor companion with a big pink hat, always ready to help.",
  "version": "1.0.0",
  "formatVersion": 1,
  "sprite": {
    "path": "spritesheet.webp",
    "frameWidth": 96,
    "frameHeight": 96,
    "columns": 5,
    "rows": 8,
    "scale": 1
  },
  "animations": {
    "idle": {
      "row": 0,
      "frames": 5,
      "fps": 5,
      "loop": true
    },
    "walk": {
      "row": 1,
      "frames": 5,
      "fps": 8,
      "loop": true
    },
    "sleep": {
      "row": 2,
      "frames": 5,
      "fps": 2,
      "loop": true
    },
    "thinking": {
      "row": 3,
      "frames": 5,
      "fps": 3,
      "loop": true
    },
    "eating": {
      "row": 4,
      "frames": 5,
      "fps": 5,
      "loop": true
    },
    "waving": {
      "row": 5,
      "frames": 5,
      "fps": 5,
      "loop": true
    },
    "success": {
      "row": 6,
      "frames": 5,
      "fps": 6,
      "loop": false
    },
    "error": {
      "row": 7,
      "frames": 5,
      "fps": 4,
      "loop": false
    }
  },
  "personality": {
    "playful": 0.8,
    "lazy": 0.4,
    "friendly": 1.0,
    "moodswing": 0.2
  }
}

The exact frame dimensions should be selected by the DeskForge renderer rather than copied blindly from an AI image.

6. Decide the Sprite Grid

There are two possible approaches.

Option A — Fixed global grid

Every DeskForge character uses the same:

frameWidth
frameHeight

Example:

96 × 96

Advantages:

simple renderer

simple collision/hitbox logic

simple atlas processing

easy animation switching

predictable memory usage

Disadvantage:

some characters may have very different proportions

Option B — Per-character frame dimensions

Each character can have its own:

"frameWidth": 96,
"frameHeight": 112

Advantages:

preserves character proportions

better for unusual characters

avoids excessive empty space

Disadvantage:

renderer is slightly more complex

Recommended for DeskForge

Use per-character frame dimensions, but require every frame inside one character to use the exact same dimensions.

Do not let individual frames have different sizes.

7. AI Generation Rules

The AI should generate a source animation sheet, not the final WebP.

Prompt requirements:

- same character in every frame
- same clothing
- same colors
- same proportions
- same face
- same accessories
- full body
- transparent background
- no text
- no labels
- no borders
- no additional characters
- consistent scale
- consistent camera/viewpoint

For animation:

5 sequential frames
left to right
progressive movement
same character
smooth pose transition

Generate one animation at a time when consistency is more important than convenience.

Example:

Master Chopper
      |
      +--> idle.png
      +--> walk.png
      +--> sleep.png
      +--> thinking.png
      +--> eating.png
      +--> waving.png
      +--> success.png
      +--> error.png

This is more reliable than asking one model call to produce dozens of frames.

8. Source Image Requirements

Before processing, convert the AI output into a standard internal image format.

Recommended:

PNG
RGBA
transparent background
sRGB

Do not process WebP as the source if avoidable.

Use:

AI output
   ↓
PNG RGBA
   ↓
processing
   ↓
WebP

This keeps transparency and intermediate processing predictable.

9. Background Removal

If the AI returns a solid background:

character + background

run background removal before frame detection.

The result should be:

transparent
      +
character

The processor should validate that the background is actually transparent.

Check:

alpha channel exists

background pixels have alpha 0

character pixels have alpha > 0

Do not simply remove a color by RGB if the image contains anti-aliased edges.

Use alpha-aware processing.

10. Frame Detection

This is the most important part of the pipeline.

Do NOT assume that the AI image is already a perfect grid.

The processor should detect individual character regions.

Conceptually:

source image

+---------------------------------------+
|   Chopper       Chopper       Chopper |
|                                       |
|   Chopper       Chopper       Chopper |
|                                       |
|   Chopper       Chopper       Chopper |
+---------------------------------------+

                ↓

       connected components

                ↓

        frame  frame  frame
        frame  frame  frame
        frame  frame  frame

Use alpha-connected components or another segmentation method.

Each detected character should become a candidate frame.

11. Remove Non-Character Artifacts

The processor must reject:

text

labels

borders

background decorations

shadows disconnected from the character

random particles

AI artifacts

duplicate fragments

Use bounding-box heuristics.

For each candidate:

x
y
width
height
area
alphaPixelCount

Reject candidates that are obviously too small or too large.

12. Group Frames Into Rows

After detecting individual frames, group them by their vertical position.

Example:

frame 1 y=100
frame 2 y=103
frame 3 y=98
frame 4 y=101

=> same animation row

Sort each row by:

x coordinate

Then you get:

Row 0:
frame0 frame1 frame2 frame3 frame4

Row 1:
frame0 frame1 frame2 frame3 frame4

Do not depend on AI labels such as:

1. IDLE
2. WALK
3. SLEEP

Labels are useful for humans but should not be part of the final atlas.

13. Normalize Every Frame

This is where your current pipeline needs the most attention.

For every detected frame:

Crop to character bounds.

Remove excess transparent padding.

Determine the character bounding box.

Scale while preserving aspect ratio.

Place the character in the canonical frame.

Center horizontally.

Align vertically using a baseline.

Keep consistent margins.

Example:

+----------------+
|                |
|     CHOPPER    |
|       /\       |
|      /  \      |
|                |
|______BASE______|
+----------------+

The important part is that every frame gets the same canvas dimensions.

14. Use Baseline Alignment

Centering by bounding box alone can cause animation jitter.

For example:

frame 1: feet at y=90
frame 2: feet at y=84
frame 3: feet at y=93

The character will appear to bounce unexpectedly.

Instead, calculate a baseline:

feet / lowest stable body point

and align all standing frames to the same baseline.

For sleeping animations, use a separate alignment mode because the character is lying down.

15. Normalize Scale

The character should not become larger or smaller between frames.

Calculate a reference character height.

Example:

referenceHeight = median(character heights)

Then scale every frame toward that reference.

Do not independently stretch width and height.

Always preserve aspect ratio.

16. Handle Special Animations

Some animations intentionally change the character's bounding box.

Examples:

idle
walking
thinking

are mostly upright.

But:

sleeping
jumping
power-up

can be much larger or lower.

Therefore, use an animation-level bounding box policy.

Example:

idle:
  baseline = standing

walk:
  baseline = standing

sleep:
  baseline = sleeping

success:
  center = normal

This prevents the processor from incorrectly shrinking or clipping dynamic poses.

17. Build the Final Atlas

Once all frames are normalized:

             columns = 5

       0       1       2       3       4

row 0 [idle] [idle] [idle] [idle] [idle]
row 1 [walk] [walk] [walk] [walk] [walk]
row 2 [sleep][sleep][sleep][sleep][sleep]
row 3 [think][think][think][think][think]
row 4 [eat]  [eat]  [eat]  [eat]  [eat]
row 5 [wave] [wave] [wave] [wave] [wave]
row 6 [succ] [succ] [succ] [succ] [succ]
row 7 [err]  [err]  [err]  [err]  [err]

If:

frameWidth = 96
frameHeight = 96
columns = 5
rows = 8

then:

atlasWidth = 96 × 5 = 480
atlasHeight = 96 × 8 = 768

The atlas should contain only frames and transparent pixels.

No labels.

No borders.

No extra spacing unless your renderer explicitly requires it.

18. Export to WebP

The final output should be:

spritesheet.webp

Recommended:

RGBA
lossless WebP

For pixel art, avoid lossy compression.

The final image should preserve:

hard pixel edges

transparency

exact colors

no compression artifacts

Do not resize the finished atlas using a smoothing filter.

If resizing is required, use nearest-neighbor scaling.

19. Validate the WebP

Before accepting the package, automatically check:

✓ file exists
✓ valid WebP
✓ RGBA
✓ expected width
✓ expected height
✓ expected frame dimensions
✓ expected row count
✓ expected column count
✓ no accidental opaque background
✓ no frame clipping
✓ no frame overflow

Also perform a visual validation render.

Generate a preview:

preview.png

showing:

animation name
frame 1 → frame 2 → frame 3 → frame 4 → frame 5

This makes debugging much easier.

20. Generate JSON Automatically

Do not manually write pet.json for every character.

The processor should generate it.

Input:

character ID
display name
description
frame size
animations
FPS
personality

Output:

pet.json

This eliminates mistakes such as:

spritesheet.webp

being referenced incorrectly.

21. JSON Validation

Validate the JSON before packaging.

Required:

id
displayName
description
version
formatVersion
sprite
animations

For every animation:

row
frames
fps
loop

Check:

row < totalRows
frames <= totalColumns
fps > 0
frameWidth > 0
frameHeight > 0

Also verify that the referenced sprite file actually exists.

22. Fallback System

This is important for your idea of supporting characters that do not have complete metadata.

DeskForge should always have a global default definition.

Example:

global-character.json

If a downloaded character has:

missing pet.json

or:

missing animations

DeskForge can fall back to:

global-character.json

Example:

{
  "sprite": {
    "path": "spritesheet.webp"
  },
  "animations": {
    "idle": {
      "row": 0,
      "frames": 5,
      "fps": 5,
      "loop": true
    }
  }
}

Then merge character-specific metadata over the global defaults.

Conceptually:

global defaults
      +
character metadata
      ↓
final runtime config

23. Package Validation

Before a character is accepted:

character.zip
│
├── pet.json
└── spritesheet.webp

Validate:

✓ ZIP < 5 MB
✓ pet.json exists
✓ spritesheet.webp exists
✓ both are in the expected package location
✓ JSON is valid
✓ WebP is valid
✓ dimensions match JSON
✓ animation rows exist
✓ frame counts match
✓ no missing referenced files

If invalid:

Package rejected

with a useful error:

Animation "walk" references row 8,
but spritesheet only contains 8 rows (0-7).

Do not allow broken assets into the DeskForge library.

24. Recommended Processing API

Build the processor as a standalone service/library.

Example:

POST /process

Input:

source.png

Configuration:

{
  "characterId": "chopper",
  "frameColumns": 5,
  "animations": [
    "idle",
    "walk",
    "sleep",
    "thinking",
    "eating",
    "waving",
    "success",
    "error"
  ]
}

Output:

spritesheet.webp
pet.json
preview.png

This service can later become the core of your MCP.

25. MCP Architecture

Eventually:

DeskForge
    |
    v
DeskForge MCP
    |
    +--> generate character
    |
    +--> process sprite sheet
    |
    +--> validate character
    |
    +--> generate JSON
    |
    +--> preview animation
    |
    +--> package character

Possible MCP operations:

generate_character
process_sprite_sheet
extract_frames
normalize_frames
build_atlas
validate_character
generate_pet_json
preview_animation
package_character

26. User Photo Pipeline

For a user-uploaded photo:

User photo
    ↓
subject/background segmentation
    ↓
character stylization
    ↓
master character
    ↓
animation generation
    ↓
frame extraction
    ↓
normalization
    ↓
atlas
    ↓
WebP + JSON

The uploaded photo should become the master reference.

Every animation should reference that master character so that the appearance remains consistent.

27. Quality Gates

Every character should pass four quality gates.

Gate 1 — Character consistency

Check:

face
hair/fur
clothing
colors
accessories
body proportions

Gate 2 — Frame consistency

Check:

same frame size
same scale
same baseline
no clipping
no excessive padding

Gate 3 — Animation consistency

Check:

correct order
smooth pose progression
correct frame count
correct FPS

Gate 4 — Package consistency

Check:

valid JSON
valid WebP
valid paths
valid dimensions
ZIP < 5 MB

Only after all four pass should the character be published.

28. Development Roadmap

Phase 1 — Manual Proof of Concept

Goal:

one Chopper character

Create:

idle
walk
sleep
thinking
eating
waving
success
error

Manually verify each animation.

Do not build the entire AI pipeline yet.

Phase 2 — Deterministic Sprite Processor

Build:

PNG
 ↓
background removal
 ↓
frame detection
 ↓
crop
 ↓
normalize
 ↓
atlas
 ↓
WebP

This phase should solve the current broken WebP problem.

Phase 3 — JSON Generator

Automatically create:

pet.json

from the processed atlas.

Phase 4 — Validator

Create a validator that catches:

invalid dimensions
missing rows
missing frames
invalid JSON
missing WebP
bad transparency
wrong paths

Phase 5 — Character Package Builder

Produce:

chopper/
├── pet.json
└── spritesheet.webp

Then:

chopper.zip

Phase 6 — DeskForge Integration

DeskForge downloads:

character.zip

Then:

validate
    ↓
install
    ↓
load pet.json
    ↓
load spritesheet.webp
    ↓
play animations

Phase 7 — AI Generation

Add:

Nano Banana

or another image model as the generation layer.

AI should produce the source artwork.

Your processor remains deterministic.

Phase 8 — MCP

Expose the complete pipeline through MCP:

create character
generate animations
process frames
build atlas
generate JSON
validate
package

This allows DeskForge's AI agent to create/manage characters programmatically.

29. Recommended Final Repository Structure

DeskForge/
├── apps/
│   └── desktop/
│
├── packages/
│   ├── character-runtime/
│   ├── character-schema/
│   ├── sprite-processor/
│   ├── character-validator/
│   └── character-packager/
│
├── mcp/
│   └── character-mcp/
│
├── characters/
│   ├── default-cat/
│   │   ├── pet.json
│   │   └── spritesheet.webp
│   │
│   └── chopper/
│       ├── pet.json
│       └── spritesheet.webp
│
└── README.md

30. Definition of Done

A character is considered production-ready when:

[✓] Character design is consistent
[✓] All required animations exist
[✓] Frames are correctly ordered
[✓] Frames have consistent dimensions
[✓] Character does not jitter
[✓] Character is not clipped
[✓] Background is transparent
[✓] Pixel edges are preserved
[✓] WebP is lossless
[✓] JSON is valid
[✓] JSON matches WebP dimensions
[✓] Missing animations have fallbacks
[✓] Package validates
[✓] Package is below size limit
[✓] DeskForge can load and animate it

31. Most Important Decision

Do not make this:

AI
 ↓
final WebP
 ↓
DeskForge

Make this:

AI
 ↓
raw source artwork
 ↓
DeskForge Sprite Processor
 ↓
normalized frames
 ↓
sprite atlas
 ↓
lossless WebP
 ↓
generated JSON
 ↓
validator
 ↓
DeskForge

This gives you control over the final asset regardless of whether the source comes from:

Nano Banana

ChatGPT image generation

Seedream

another image model

a user-uploaded image

a manually created sprite

an existing OpenPets/Codex-Pets character

The image model can change later without rewriting your DeskForge runtime.