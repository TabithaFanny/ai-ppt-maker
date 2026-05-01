# RenderSpec Invariants

> Phase 7 — Verification Document
> Rules that RenderSpec must satisfy

---

## Invariant Definitions

### I1: Element ID Uniqueness
- **Rule**: Every `RenderElement.id` must be unique within the entire RenderSpec.
- **Current check**: None.
- **Needed**: Validator in `buildRenderSpec()`.

### I2: Slide ID Legality
- **Rule**: Every `RenderSlide.id` must be a non-empty string.
- **Current check**: None (relies on PPTJson slide IDs being valid).
- **Needed**: None (downstream of PPTJson which is Zod-validated).

### I3: Coordinate Legality
- **Rule**: `resolvedPosition.x`, `y`, `width`, `height` must be non-negative finite numbers.
- **Current check**: None.
- **Needed**: Validator in `buildRenderSpec()`.

### I4: Size Legality
- **Rule**: `resolvedPosition.width` and `height` must be > 0.
- **Current check**: None.
- **Needed**: Validator in `buildRenderSpec()`.

### I5: Element Bounds
- **Rule**: `x + width <= 10` and `y + height <= 7.5` (standard 10x7.5 inch slide).
- **Current check**: `auto-fixer.ts` clamps PPTJson positions to 0-1 (relative), which maps to 0-10/0-7.5 (absolute).
- **Needed**: RenderSpec-level bounds check after auto-fix.

### I6: Element Type Legality
- **Rule**: `RenderElement.type` must be one of: 'heading', 'paragraph', 'bullet-list', 'image', 'chart', 'icon', 'decoration', 'caption'.
- **Current check**: Enforced by TypeScript type union + `mapContentType()` mapping.
- **Status**: ✅ Satisfied by construction.

### I7: Style Token Legality
- **Rule**: `resolvedStyle.fontFamily` must be non-empty. `fontSize` must be > 0. `color` must be a valid hex string.
- **Current check**: None.
- **Needed**: Validator in `buildRenderSpec()`.

### I8: Locked Element Protection
- **Rule**: Elements with `locked: true` in the source SlideElement cannot be modified by EditPatch.
- **Current check**: None. `applyPatch()` does not check `locked` flag.
- **Needed**: Check in `applyPatch()` and `reversePatch()`.

---

## Existing Validators

| Validator | Location | What It Checks |
|-----------|----------|----------------|
| Zod: PPTJsonSchema | `lib/schemas.ts` | PPTJson structure after AI generation |
| Zod: DeckPlanSchema | `lib/schemas.ts` | DeckPlan structure after AI generation |
| Zod: StyleConfigSchema | `lib/schemas.ts` | StyleConfig after AI style analysis |
| Structural: validateDeckPlan | `lib/deck-planner.ts` | First=cover, last=closing, all have titles |
| Residual: performResidualCheck | `lib/residual-checker.ts` | Empty blocks, text overflow, missing assets, layout consistency |
| Auto-fix: autoFixPPTJson | `lib/auto-fixer.ts` | Empty titles, empty conclusions, out-of-bounds positions |

---

## Missing Validators (To Add)

| Validator | Priority | Location To Add |
|-----------|----------|-----------------|
| I1: Element ID uniqueness | Medium | `lib/render-spec.ts` |
| I3: Coordinate legality | Low | `lib/render-spec.ts` |
| I4: Size legality | Low | `lib/render-spec.ts` |
| I5: Element bounds (RenderSpec) | Medium | `lib/render-spec.ts` |
| I7: Style token legality | Low | `lib/render-spec.ts` |
| I8: Locked element protection | Medium | `lib/edit-patch.ts` |

---

## Pre-Export Required Checks

Before PPTX export, the following MUST pass:

1. ✅ PPTJson has at least one slide
2. ✅ All slides have non-empty titles
3. ✅ No ContentBlock has empty content (after auto-fix)
4. ⚠️ No ContentBlock has out-of-bounds position (auto-fix handles, but no post-fix validation)
5. ⚠️ RenderSpec elements have valid absolute positions (no check)
6. ✅ StyleKit or StyleConfig is available
7. ✅ Export function has error handling
