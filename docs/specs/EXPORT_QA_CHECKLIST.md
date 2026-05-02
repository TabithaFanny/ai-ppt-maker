# Export QA Checklist

> Phase 7 — Verification Document
> Manual verification checklist for exported PPTX files

---

## Compatibility

| Check | PowerPoint | WPS | Keynote | Status |
|-------|-----------|-----|---------|--------|
| File opens without error | ☐ | ☐ | ☐ | Not tested (manual) |
| No corruption warning | ☐ | ☐ | ☐ | Not tested (manual) |
| Slides visible in navigator | ☐ | ☐ | ☐ | Not tested (manual) |

## Editability

| Check | Status |
|-------|--------|
| Title text is editable (click to select) | ☐ Not tested |
| Body text is editable | ☐ Not tested |
| Lists have proper bullet formatting | ☐ Not tested |
| Images are movable/resizable | ☐ Not tested |
| Charts are editable (if real chart) | ☐ Not tested |
| Shapes are shapes (not flattened images) | ☐ Not tested |
| No entire slide is a single image | ☐ Not tested |

## Typography

| Check | Status |
|-------|--------|
| Chinese characters render correctly | ☐ Not tested |
| Title font matches StyleKit | ☐ Not tested |
| Body font matches StyleKit | ☐ Not tested |
| Font sizes are reasonable | ☐ Not tested |
| Bold/italic styles preserved | ☐ Not tested |

## Layout

| Check | Status |
|-------|--------|
| Slide aspect ratio is 16:9 | ☐ Not tested |
| No elements extend beyond slide edges | ☐ Not tested |
| Elements positioned as expected | ☐ Not tested |
| Background color matches StyleKit | ☐ Not tested |
| Spacing between elements is reasonable | ☐ Not tested |

## File Properties

| Check | Status |
|-------|--------|
| File name is the presentation title | ✅ Yes (`${pptJson.metadata.title}.pptx`) |
| File name has no illegal characters | ⚠️ Not sanitized |
| File size is reasonable (< 50MB) | ☐ Not tested |
| No temp files or debug data included | ✅ N/A (pptxgenjs generates clean) |

## Error Handling

| Check | Status |
|-------|--------|
| Export failure shows user-friendly error | ✅ Toast notification |
| Generating state resets after error | ✅ `finally` block resets |
| User can retry after failure | ✅ Button re-enabled |
| Progress indicator during export | ✅ `progress.current/total` |

---

## Known Limitations

1. **Charts are text placeholders**: Chart blocks export as "[图表]" text, not real charts.
2. **Icon/decoration elements skipped**: These element types are not rendered in PPTX.
3. **No animations**: Exported PPTX has no transitions or animations.
4. **No speaker notes**: Speaker notes are not exported.
5. **No master slides**: Each slide is individually formatted, no slide master used.
6. **File name not sanitized**: Title with special characters may cause issues.

---

## Automated Checks (Could Be Added)

```typescript
// PPTX validation after export
- File size > 0
- File is valid zip (pptx = zip)
- Contains ppt/slides/slide1.xml etc.
- Slide count matches PPTJson.slides.length
- No placeholder text like "[图表]" in text blocks (warning only)
```
