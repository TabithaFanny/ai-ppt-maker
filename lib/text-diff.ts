/**
 * 轻量级文本差异对比
 * 用于 AI 编辑面板的 diff 预览
 */

export interface TextSegment {
  text: string;
  type: 'same' | 'added' | 'removed';
}

/**
 * 简单的词级别 diff — 对短文本足够用
 * 将文本按空格/标点拆分为 token，逐个对比
 */
export function computeTextDiff(oldText: string, newText: string): TextSegment[] {
  if (oldText === newText) {
    return [{ text: oldText, type: 'same' }];
  }

  // 按字符逐个对比（对中文更友好）
  const segments: TextSegment[] = [];

  let i = 0;
  let j = 0;

  while (i < oldText.length && j < newText.length) {
    if (oldText[i] === newText[j]) {
      // 找到相同前缀
      let same = '';
      while (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
        same += oldText[i];
        i++;
        j++;
      }
      segments.push({ text: same, type: 'same' });
    } else {
      // 不同：分别收集删除和新增
      // 尝试找到下一个匹配点
      const nextMatchInNew = newText.indexOf(oldText[i], j);
      const nextMatchInOld = oldText.indexOf(newText[j], i);

      if (nextMatchInNew !== -1 && (nextMatchInOld === -1 || nextMatchInNew - j <= nextMatchInOld - i)) {
        // newText 中间有新增内容
        segments.push({ text: newText.slice(j, nextMatchInNew), type: 'added' });
        j = nextMatchInNew;
      } else if (nextMatchInOld !== -1) {
        // oldText 中间有被删除的内容
        segments.push({ text: oldText.slice(i, nextMatchInOld), type: 'removed' });
        i = nextMatchInOld;
      } else {
        // 剩余全部不同
        segments.push({ text: oldText.slice(i), type: 'removed' });
        segments.push({ text: newText.slice(j), type: 'added' });
        return segments;
      }
    }
  }

  // 处理尾部
  if (i < oldText.length) {
    segments.push({ text: oldText.slice(i), type: 'removed' });
  }
  if (j < newText.length) {
    segments.push({ text: newText.slice(j), type: 'added' });
  }

  return segments;
}

/**
 * 格式化位置坐标为百分比字符串
 */
export function formatPosition(pos: { x: number; y: number; width: number; height: number }): string {
  return `${Math.round(pos.x * 100)}%, ${Math.round(pos.y * 100)}% · ${Math.round(pos.width * 100)}×${Math.round(pos.height * 100)}%`;
}
