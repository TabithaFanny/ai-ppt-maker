/**
 * API: /api/edit-patch
 * 接收当前 slide + 用户自然语言指令，返回 EditPatch JSON
 * AI 只允许修改当前 slide，不允许影响其他 slide
 * 支持 few-shot 示例 + 失败自动重试
 */

import { chatCompletion } from '@/lib/api-client';
import { EditPatchSchema, validateAIOutput } from '@/lib/schemas';
import { ok, fail } from '@/lib/api-response';
import type { Slide } from '@/types';

const MAX_RETRIES = 1;

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

function extractJson(response: string): string {
  let jsonStr = response.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return jsonStr;
}

function tryParseAndValidate(jsonStr: string, slideId: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return { success: false as const, error: 'AI 返回的内容不是有效 JSON' };
  }

  const validation = validateAIOutput(EditPatchSchema, parsed, 'EditPatch');
  if (!validation.success) {
    return { success: false as const, error: `AI 输出不符合 schema: ${validation.error}` };
  }

  if (validation.data.slideId !== slideId) {
    return { success: false as const, error: 'AI 尝试修改非当前幻灯片，已拒绝' };
  }

  return { success: true as const, data: validation.data };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slide, instruction } = body as { slide: Slide; instruction: string };

    if (!slide || !instruction) {
      return fail('缺少 slide 或 instruction 参数', 400);
    }

    if (!instruction.trim()) {
      return fail('修改指令不能为空', 400);
    }

    const slideContext = buildSlideContext(slide);
    const prompt = buildPrompt(slide, instruction, slideContext);

    let lastError = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await chatCompletion(
        attempt === 0 ? prompt : `${prompt}\n\n**注意：上次返回有误（${lastError}），请严格按 JSON 格式返回，不要添加任何额外文字。**`
      );

      const jsonStr = extractJson(response);
      const result = tryParseAndValidate(jsonStr, slide.id);

      if (result.success) {
        return ok(result.data);
      }

      lastError = result.error;

      // 如果不是 JSON 解析或 schema 错误，不重试
      if (!lastError.includes('JSON') && !lastError.includes('schema') && !lastError.includes('幻灯片')) {
        break;
      }
    }

    return fail(lastError, 422);
  } catch (error) {
    console.error('Edit patch error:', error);
    return fail(`编辑请求失败: ${error instanceof Error ? error.message : '未知错误'}`, 500);
  }
}
