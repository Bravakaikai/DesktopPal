# Clean pug animation rig

Generated with the built-in imagegen tool, using `../dog-gait-base.png` as the identity/style reference. The original output is preserved at `../dog-rig-atlas-v1.png`. No CLI/API fallback was used.

The main body has no baked-in leg remnants. Each limb is a complete painted part, so a crossing cannot expose a clipped stump from the old pose. The compositing order is far hind leg, far front leg, body, near hind leg, near front leg. Joint weights blend continuously instead of cutting at the knee. `walk-footprints.json` verifies that every returning paw lands at least 32 source pixels ahead of its supporting partner.

Front shoulders, elbows and resting paws are aligned in parallel, with both elbows folding backward. Front feet include the body's 12 px rest offset, so idle no longer forces a crouch. A bounded extension (under 14%) accommodates the ends of a planted stride without adding permanent elbow slack; grounded paws remain level. `front-joints.json` records the joints through idle, walk and run, and the generator rejects opposing bends, excessive supporting-leg bowing or misaligned resting paws before deployment.

Rebuild:

```powershell
node scripts/prepare-dog-rig.cjs
node scripts/build-dog-gait.cjs --apply
node scripts/repair-drag-sprites.cjs --apply
node scripts/audit-pet-sprites.cjs
npm run build
```

The returned atlas contained a neutral checker matte rather than an alpha channel. Preparation removes only flood-connected neutral background, keeps enclosed eye highlights, extracts the five complete parts, and preserves their alpha for runtime compositing.

The cat and rabbit drag repairs use their existing pose artwork. They replace the discontinuous displacement across the image centre with a smooth field. The pig and fish frames were audited and did not need the same repair. Full frame audit results are in `blender/pet-layer-audit-after.json`.

All five pets now retain and reuse decoded image elements during playback, instead of repeatedly changing an image's source and waiting for it to decode. Only one image is attached as the current sprite; mirroring, naming and transparency continue to apply to that image.

## Generation prompt

Use case: precise-object-edit. Asset type: a clean 2D skeletal-animation sprite-parts atlas for this exact cute tan pug desktop pet. Use the attached dog as the identity/style reference: preserve its large expressive dark eyes, black pug muzzle, folded black ears, tan clay-textured fur and wrinkles, curled tail, three-quarter side view facing RIGHT. Create ONE transparent RGBA sprite-parts atlas in a strict 3-column by 2-row grid with generous transparent margins and NO grid lines, NO labels, NO text. Each cell has one detached animation part, fully painted to its hidden attachment root, no stumps or fragments from other parts. Top-left cell: complete head + neck + rounded torso + curled tail as ONE connected main-body part, with all four legs removed cleanly and a smoothly finished rounded furry belly beneath the torso; retain exact proportions and view of the original, do not enlarge head or change expression. Top-middle cell: complete NEAR front leg, tan shoulder/elbow/forearm to rounded three-toed paw, leg relaxed mostly vertical, paw facing right. Top-right cell: complete NEAR hind leg, plump tan thigh/hock/shin to rounded paw, mostly vertical, paw facing right. Bottom-left cell: complete FAR front leg, same structure and scale but naturally a little darker. Bottom-middle cell: complete FAR hind leg, same structure and scale but naturally a little darker. Bottom-right cell is entirely empty transparent. Legs are whole connected single parts with rounded fur-covered upper ends suitable for overlapping under the body, no white rectangular cuts, no severed appearance, no visible joint lines. All four legs must have matching anatomical lengths and paw style; hind upper thighs plumper than front shoulders. The main body should occupy most of its cell width; leg parts each around half a cell height with plenty of space around. No extra complete dog, no ground shadow, no checkerboard background, no captions. This is a game animation rig asset, not a diagram. Return actual transparent background.
