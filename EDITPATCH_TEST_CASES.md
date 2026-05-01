# EditPatch Test Cases

> Phase 7 — Verification Document

---

## update_text

### Normal Cases

1. **UT-N1**: Update text in a single element
   - Action: Change "Hello" to "World" in element A
   - Expected: Element A.content = "World", other elements unchanged
   - Verify: applyPatch then reversePatch restores "Hello"

2. **UT-N2**: Update text with empty string
   - Action: Change "Hello" to ""
   - Expected: Element A.content = "" (auto-fixer may remove later)
   - Verify: Patch stores old and new values correctly

3. **UT-N3**: Undo/redo text update
   - Action: Update text, then undo, then redo
   - Expected: Original → Updated → Original → Updated

### Abnormal Cases

4. **UT-A1**: Invalid elementId
   - Action: createUpdateTextPatch with non-existent elementId
   - Expected: applyPatch returns PPTJson unchanged (no matching element)

5. **UT-A2**: Invalid slideId
   - Action: createUpdateTextPatch with non-existent slideId
   - Expected: applyPatch returns PPTJson unchanged (no matching slide)

6. **UT-A3**: Locked element
   - Action: Update text on element with `locked: true`
   - Expected: **Currently NOT checked** — patch applies anyway. This is a known gap.

---

## batch_update_text

### Normal Cases

1. **BT-N1**: Batch update 3 elements
   - Action: Update A→"X", B→"Y", C→"Z" in one patch
   - Expected: All three elements updated, others unchanged

2. **BT-N2**: Undo batch update
   - Action: Batch update, then undo
   - Expected: All three elements restored to original values

3. **BT-N3**: Batch update with partial overlap
   - Action: Batch update 2 elements on same slide
   - Expected: Both updated correctly

### Abnormal Cases

4. **BT-A1**: Empty updates array
   - Action: createBatchUpdateTextPatch with empty array
   - Expected: Patch created, applyPatch returns PPTJson unchanged

5. **BT-A2**: Duplicate elementIds
   - Action: Batch update same element twice
   - Expected: Second update wins (last-write-wins in map)

6. **BT-A3**: Mixed valid/invalid elementIds
   - Action: Batch update with one valid and one invalid ID
   - Expected: Valid element updated, invalid skipped

---

## move_element

### Normal Cases

1. **ME-N1**: Move element to new position
   - Action: Move element from (0.1, 0.1) to (0.5, 0.5)
   - Expected: Element.position = {x: 0.5, y: 0.5, width: ..., height: ...}

2. **ME-N2**: Undo move
   - Action: Move, then undo
   - Expected: Element restored to original position

3. **ME-N3**: Move to edge (0,0)
   - Action: Move element to (0, 0)
   - Expected: Element at top-left corner

### Abnormal Cases

4. **ME-A1**: Move to negative coordinates
   - Action: Move to (-0.1, -0.1)
   - Expected: **Currently NOT clamped** — position set to negative. Auto-fixer may fix on export.

5. **ME-A2**: Move beyond slide bounds
   - Action: Move to (0.9, 0.9) with element width 0.3
   - Expected: **Currently NOT clamped** — x+width > 1.0. Auto-fixer clamps on export.

6. **ME-A3**: Move locked element
   - Action: Move element with `locked: true`
   - Expected: **Currently NOT checked** — move applies anyway.

---

## resize_element

### Normal Cases

1. **RE-N1**: Resize element larger
   - Action: Resize from 0.2×0.2 to 0.4×0.4
   - Expected: Element dimensions updated

2. **RE-N2**: Resize element smaller
   - Action: Resize from 0.4×0.4 to 0.1×0.1
   - Expected: Element dimensions updated (minimum 0.05 enforced by ElementCanvas)

3. **RE-N3**: Undo resize
   - Action: Resize, then undo
   - Expected: Original dimensions restored

### Abnormal Cases

4. **RE-A1**: Resize to zero
   - Action: Resize to 0×0
   - Expected: **Currently NOT prevented** — ElementCanvas enforces MIN_SIZE=0.05, but patches bypass this.

5. **RE-A2**: Resize beyond slide bounds
   - Action: Resize element at (0.8, 0.8) to width=0.5, height=0.5
   - Expected: **Currently NOT clamped** — exceeds 1.0. Auto-fixer clamps on export.

6. **RE-A3**: Resize locked element
   - Action: Resize element with `locked: true`
   - Expected: **Currently NOT checked** — resize applies anyway.

---

## replace_layout

### Status: NOT IMPLEMENTED

The `replace_layout` operation is defined in the `EditPatch.operation` union type but has NO implementation in `applyPatchToSlide()`. The function falls through to `default: return slide`.

### Normal Cases (To Implement)

1. **RL-N1**: Replace layout type for a slide
   - Action: Change slide layout from 'content' to 'title'
   - Expected: Slide.layout updated, ContentBlocks repositioned

2. **RL-N2**: Undo layout replacement
   - Action: Replace layout, then undo
   - Expected: Original layout and positions restored

3. **RL-N3**: Replace layout with same type
   - Action: Replace 'content' with 'content'
   - Expected: No-op, PPTJson unchanged

### Abnormal Cases (To Implement)

4. **RL-A1**: Invalid layout type
   - Action: Replace with non-existent layout
   - Expected: Rejected or ignored

5. **RL-A2**: Replace layout on slide with locked elements
   - Action: Replace layout when slide has locked elements
   - Expected: Locked elements stay in place, others repositioned

6. **RL-A3**: Replace layout on single-element slide
   - Action: Replace layout on slide with only one element
   - Expected: Element repositioned according to new layout

---

## Current Implementation Gaps

| Gap | Severity | Fix |
|-----|----------|-----|
| No locked element protection | Medium | Add check in `applyPatch()` |
| No coordinate clamping in patches | Low | Auto-fixer handles on export |
| replace_layout not implemented | Low | Add implementation or remove from type |
| No bounds validation on resize | Low | Auto-fixer handles on export |
