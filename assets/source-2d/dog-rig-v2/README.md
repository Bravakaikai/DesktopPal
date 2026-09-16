# Repainted stocky pug limbs

The walking source drawings had narrower shins and smaller paws than the existing seated pug. Version 2 replaces all four limb paintings using the seated pose as the proportion reference. Matching near/far front legs now share a 44 px placement width, and both hind legs share 46 px; the old widths were 32/26 px (front) and 38/27 px (hind). This is an artwork and placement change, with the existing gait timing and foot paths retained.

The built-in imagegen tool produced `../dog-legs-atlas-v2.png`, using `../dog-rig-atlas-v1.png` for identity/texture and `../../pets/dog/sit-00.png` for leg/paw proportions. Its RGBA alpha is retained by `scripts/prepare-dog-legs.cjs`. The body is copied unchanged from `../dog-rig-v1/body.png`. The precise prompt and input paths are recorded in `generation.json`; no CLI/API fallback was used.

Runtime idle, walk and run frames are staged in `../dog-gait-v6` and copied into `assets/pets/dog` by the apply step.

```powershell
node scripts/prepare-dog-legs.cjs
node scripts/build-dog-gait.cjs --apply
node scripts/check-dog-leg-width.cjs
node scripts/audit-pet-sprites.cjs
npm run build
```
