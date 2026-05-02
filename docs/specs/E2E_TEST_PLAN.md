# End-to-End Test Plan

> Phase 7 — Verification Document
> Status: Test plan only, not automated

---

## Test 1: Normal PPTX Template → Full Pipeline

**Purpose**: Verify the happy path from template upload to PPTX export.

**Steps**:
1. Upload a 5-slide blue-themed PPTX template
2. Wait for StyleKit extraction to complete
3. Verify StyleKit contains palette, typography, layoutPatterns
4. Enter UserInput: topic="AI 技术趋势", scenario="pitch", 6 pages
5. Trigger generation via generate-stream
6. Verify SSE events: planning → generating → complete
7. Verify DeckPlan has 6 SlidePlans with correct roles
8. Verify PPTJson has 6 Slides with positioned ContentBlocks
9. Switch to Element mode, verify LayoutGuide zones visible
10. Edit a title text, verify undo works (Ctrl+Z)
11. Export PPTX, verify file downloads

**Expected**: All steps succeed. PPTX opens in PowerPoint with blue theme.

**Failure signals**: Missing StyleKit, empty DeckPlan, missing ContentBlocks, undo fails, export error.

**Files**: `app/api/upload/route.ts`, `app/api/style-kit/extract/route.ts`, `app/api/generate-stream/route.ts`, `lib/deck-planner.ts`, `lib/deck-resolver.ts`, `components/EditStep.tsx`, `components/GenerateStep.tsx`

---

## Test 2: Complex PPTX Template (Many Images)

**Purpose**: Verify image handling through the pipeline.

**Steps**:
1. Upload a PPTX with 10+ embedded images
2. Verify StyleKit extraction completes (images don't crash parser)
3. Generate PPT with image-heavy scenario
4. Verify image blocks in PPTJson have base64 or URL content
5. Export PPTX, verify images appear in exported file

**Expected**: Images extracted, stored, and re-exported correctly.

**Failure signals**: Parser crash, missing images in export, huge file size.

**Files**: `app/api/upload/route.ts`, `app/api/extract-assets/route.ts`, `lib/export-pptx.ts`

---

## Test 3: Pure Text Template (No Images)

**Purpose**: Verify pipeline works without images.

**Steps**:
1. Upload a PPTX with only text (no images, no charts)
2. Verify StyleKit extraction works
3. Generate PPT, verify all ContentBlocks are type 'text' or 'list'
4. Export PPTX, verify text is editable (not flattened to image)

**Expected**: All text remains editable in exported PPTX.

**Failure signals**: Text exported as image, missing text blocks.

**Files**: `lib/export-pptx.ts`

---

## Test 4: Error File Upload

**Purpose**: Verify graceful error handling for invalid files.

**Steps**:
1. Upload a .txt file renamed as .pptx
2. Upload a corrupted PPTX (truncated zip)
3. Upload a file exceeding size limit
4. Upload a valid PDF (should work with fallback)

**Expected**: Clear error messages for invalid files. PDF processed with limitations.

**Failure signals**: Unhandled exception, cryptic error message, silent failure.

**Files**: `app/api/upload/route.ts`

---

## Test 5: AI Output Anomaly

**Purpose**: Verify Zod validation catches malformed AI responses.

**Steps**:
1. Mock generateDeckPlan to return invalid JSON (missing slidePlans)
2. Verify Zod validation catches it and retries
3. Mock generatePPTJson to return slides with negative positions
4. Verify auto-fixer clamps positions to 0-1

**Expected**: Validation errors caught, retries attempted, auto-fix applied.

**Failure signals**: Uncaught parse error, invalid data stored, crash on export.

**Files**: `lib/claude.ts`, `lib/schemas.ts`, `lib/auto-fixer.ts`

---

## Test 6: Export Failure Recovery

**Purpose**: Verify export failures are handled gracefully.

**Steps**:
1. Mock pptxgen.writeFile to throw an error
2. Verify error toast shown to user
3. Verify isGenerating state resets
4. Verify user can retry export

**Expected**: Error shown, state reset, retry works.

**Failure signals**: Stuck in generating state, no error feedback, crash.

**Files**: `components/GenerateStep.tsx`, `lib/export-pptx.ts`

---

## Test 7: Undo/Redo Edge Cases

**Purpose**: Verify undo/redo handles edge cases.

**Steps**:
1. Generate PPT, make 5 edits
2. Undo 5 times (stack limit test)
3. Redo 3 times
4. Make a new edit (should clear redo stack)
5. Undo the new edit, verify redo stack is empty
6. Verify max 50 entries (make 60 edits, undo 60 times — only 50 should work)

**Expected**: Undo/redo works correctly within limits.

**Failure signals**: Undo doesn't restore state, redo stack not cleared, crash at limit.

**Files**: `lib/edit-history.ts`, `lib/edit-patch.ts`, `lib/store.ts`

---

## Test 8: StyleKit Influence Verification

**Purpose**: Verify StyleKit actually affects output.

**Steps**:
1. Upload a red-themed template → extract StyleKit
2. Generate PPT with topic "产品发布"
3. Upload a blue-themed template → extract StyleKit
4. Generate PPT with same topic "产品发布"
5. Compare: colors, fonts, layout patterns should differ

**Expected**: Different StyleKits produce visually different outputs.

**Failure signals**: Same output regardless of template.

**Files**: `lib/render-style.ts`, `lib/render-spec.ts`, `lib/deck-resolver.ts`
