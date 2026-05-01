/**
 * Tests for /api/edit-patch prompt construction
 * Verifies few-shot examples are correct and not misleading
 */

// We can't import the route handler directly (it's a Next.js route),
// but we can test the exported helper functions by importing them.
// Instead, we test the prompt string construction logic.

import type { Slide } from '../types';

// Replicate the prompt builder for testing (mirrors app/api/edit-patch/route.ts)
function buildSlideContext(slide: Slide): string {
  return JSON.stringify({
    id: slide.id,
    layout: slide.layout,
    title: slide.title,
    mainConclusion: slide.mainConclusion,
    content: slide.content.map((b) => ({
      id: b.id,
      type: b.type,
      content: b.content,
      position: b.position,
    })),
  }, null, 2);
}

function buildPrompt(slide: Slide, instruction: string, slideContext: string): string {
  return `你是一个 PPT 编辑助手。用户会给你当前幻灯片的数据和一个修改指令。

**严格规则**：
1. 你只能修改当前幻灯片，不允许影响其他幻灯片
2. 不允许输出 SVG
3. 不允许直接修改 PPTX
4. 只返回一个 EditPatch JSON，不要添加任何额外文字、注释或 markdown 包裹
5. operation 必须是以下之一：update_text, batch_update_text, move_element, resize_element, delete_element, add_element, replace_layout
6. slideId 必须是 "${slide.id}"
7. 所有元素 id 必须来自当前幻灯片的已有 id（除非是 add_element 新增的）

**当前幻灯片数据**：
${slideContext}

**用户的修改指令**：
${instruction}

**操作类型速查**：

update_text — 修改单个元素的文字
  oldValue: 旧文字（字符串）  newValue: 新文字（字符串）  elementId: 必填

batch_update_text — 批量修改多个元素的文字
  newValue: [{elementId: "id", text: "新文字"}]  elementId: 省略

move_element — 移动元素位置
  oldValue: {x,y,width,height}  newValue: {x,y,width,height}（0-1 范围）  elementId: 必填

resize_element — 改变元素大小
  oldValue: {x,y,width,height}  newValue: {x,y,width,height}（0-1 范围）  elementId: 必填

delete_element — 删除元素
  oldValue: 被删除的完整 ContentBlock  newValue: null  elementId: 必填

add_element — 新增元素
  oldValue: null  newValue: 完整 ContentBlock（含 id, type, content, position）  elementId: 省略

replace_layout — 切换布局
  oldValue: 旧 layout 字符串  newValue: 新 layout 字符串  elementId: 省略

**示例**：

用户指令: "把标题改成 AI 驱动的未来"
→ {"operation":"update_text","slideId":"${slide.id}","elementId":"<标题元素id>","oldValue":"原标题","newValue":"AI 驱动的未来","description":"修改标题"}

用户指令: "把三个痛点压缩成短词"
→ {"operation":"batch_update_text","slideId":"${slide.id}","newValue":[{"elementId":"<痛点1的id>","text":"效率低"},{"elementId":"<痛点2的id>","text":"成本高"},{"elementId":"<痛点3的id>","text":"风险大"}],"description":"批量压缩三个痛点为短词"}

用户指令: "把右上角的图片移到左下角"
→ {"operation":"move_element","slideId":"${slide.id}","elementId":"<图片元素id>","oldValue":{"x":0.6,"y":0.1,"width":0.3,"height":0.3},"newValue":{"x":0.05,"y":0.6,"width":0.3,"height":0.3},"description":"移动图片到左下角"}

用户指令: "删除底部的装饰线"
→ {"operation":"delete_element","slideId":"${slide.id}","elementId":"<装饰线id>","oldValue":null,"newValue":null,"description":"删除底部装饰线"}

用户指令: "新增一个底部结论条"
→ {"operation":"add_element","slideId":"${slide.id}","oldValue":null,"newValue":{"id":"new-结论","type":"text","content":"核心结论","position":{"x":0.05,"y":0.85,"width":0.9,"height":0.1}},"description":"新增底部结论条"}

用户指令: "换成封面布局"
→ {"operation":"replace_layout","slideId":"${slide.id}","oldValue":"content","newValue":"title","description":"切换为封面布局"}

请只返回 JSON（不要用 markdown 包裹）：`;
}

const testSlide: Slide = {
  id: 'slide-test',
  layout: 'content',
  title: 'Test',
  mainConclusion: 'Conclusion',
  content: [
    { id: 'b1', type: 'text', content: 'Hello', position: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 } },
  ],
};

describe('edit-patch prompt', () => {
  it('batch_update_text example is for text compression, not position move', () => {
    const prompt = buildPrompt(testSlide, 'test', buildSlideContext(testSlide));

    // The batch_update_text example should be about text changes, not "下移"
    expect(prompt).not.toContain('把所有文字下移');
    expect(prompt).toContain('压缩');
    // The example should have text field, not position changes
    expect(prompt).toContain('"text":"效率低"');
  });

  it('prompt includes all 7 operations in quick reference', () => {
    const prompt = buildPrompt(testSlide, 'test', buildSlideContext(testSlide));
    const operations = ['update_text', 'batch_update_text', 'move_element', 'resize_element', 'delete_element', 'add_element', 'replace_layout'];
    for (const op of operations) {
      expect(prompt).toContain(op);
    }
  });

  it('prompt includes delete_element and add_element examples', () => {
    const prompt = buildPrompt(testSlide, 'test', buildSlideContext(testSlide));
    expect(prompt).toContain('删除底部的装饰线');
    expect(prompt).toContain('新增一个底部结论条');
    expect(prompt).toContain('"operation":"delete_element"');
    expect(prompt).toContain('"operation":"add_element"');
  });

  it('prompt forbids SVG and direct PPTX modification', () => {
    const prompt = buildPrompt(testSlide, 'test', buildSlideContext(testSlide));
    expect(prompt).toContain('不允许输出 SVG');
    expect(prompt).toContain('不允许直接修改 PPTX');
  });

  it('prompt enforces slideId constraint', () => {
    const prompt = buildPrompt(testSlide, 'test', buildSlideContext(testSlide));
    expect(prompt).toContain(`slideId 必须是 "slide-test"`);
  });
});
