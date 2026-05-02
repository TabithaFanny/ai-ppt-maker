# DreamKit SPEC — AI PPT Generator 下一代架构

## 概述

DreamKit 是 AI PPT Generator 的下一代架构愿景。在完成 StyleKit（风格继承）、RenderSpec（渲染规范）、EditPatch（编辑补丁）三段式架构后，DreamKit 进一步抽象设计流程，将 PPT 制作从"工具操作"提升为"设计对话"。

## 核心概念

### 1. 设计意图层 (Design Intent)

当前 StyleKit 描述的是"长什么样"（颜色、字体、间距），
DreamKit 进一步描述"为什么这么设计"（意图、策略、决策）。

```typescript
interface DesignIntent {
  // 设计目标
  goals: {
    primary: 'inform' | 'persuade' | 'inspire' | 'educate';
    secondary: string[];
  };

  // 视觉策略
  strategy: {
    hierarchy: 'clear' | 'dramatic' | 'subtle' | 'playful';
    rhythm: 'steady' | 'dynamic' | 'minimal';
    emphasis: 'color' | 'size' | 'space' | 'motion';
  };

  // 设计决策链（为什么选这个颜色/字体/布局）
  decisions: DesignDecision[];
}

interface DesignDecision {
  property: string;
  value: unknown;
  rationale: string;
  alternatives: { value: unknown; rejected_reason: string }[];
}
```

### 2. 多模态设计引擎

当前每条内容走单一文本生成路径。DreamKit 引入多模态路由：

```
用户输入
  ├── 文字内容 → LLM 生成
  ├── 数据结构 → 图表引擎 (ECharts/Vega)
  ├── 关键数据 → 可视化模板
  ├── 概念/隐喻 → AI 图片生成 (Midjourney/DALL-E)
  └── 版式结构 → 布局算法 (网格/自由/故事板)
```

### 3. 增量设计编辑协议

当前 EditPatch 只支持 7 种操作，且作用于 ContentBlock 级别。
DreamKit 扩展为三层编辑协议：

| 层级 | 作用于 | 示例 |
|------|--------|------|
| L1: 内容 | Text/Image/Chart | 修改文字、替换图片 |
| L2: 样式 | Font/Color/Layout | 改字号、换配色 |
| L3: 意图 | Goal/Strategy/Mood | "更有说服力"、"改成交互式" |

L3 编辑会自动级联到 L2 和 L1，确保设计一致性。

### 4. 设计系统图谱

StyleKit 是单点的风格快照。DreamKit 维护一个跨项目的设计系统图谱：

```typescript
interface DesignSystemGraph {
  nodes: DesignSystemNode[];
  edges: DesignSystemRelation[];
}

interface DesignSystemNode {
  id: string;
  type: 'palette' | 'typography' | 'layout' | 'effect' | 'pattern';
  properties: Record<string, unknown>;
  usageCount: number;
  successRate: number;
}

interface DesignSystemRelation {
  from: string;
  to: string;
  relation: 'complements' | 'conflicts' | 'derives' | 'replaces';
  strength: number;
}
```

基于此图谱可实现：
- **自动推荐**：根据已有设计推荐配色/字体组合
- **一致性检查**：新元素是否与现有设计系统冲突
- **设计债检测**：哪些页面偏离了设计系统

### 5. 实时协作时间线

当前版本仅支持单人编辑 + 版本历史。
DreamKit 引入类 Figma 的时间线模型：

```
Timeline {
  branches: Branch[]
  snapshots: Snapshot[]
  operations: Operation[]
  conflicts: Conflict[]

  // 自动合并策略
  mergeStrategy: 'last-write-wins' | 'three-way' | 'design-aware'
}
```

设计感知合并 (design-aware merge) 可智能处理样式冲突：
- 两人同时改配色 → 取最新
- 一人改配色、一人加内容 → 自动合并
- 一人改标题字号、一人改标题内容 → 自动合并

## 架构变化

### 当前 (v1.0)
```
UserInput → StyleKit → DeckPlan → PPTJson → RenderSpec → PPTX
                                                          → Preview
                                     EditPatch ↗
```

### DreamKit (v2.0)
```
UserInput → DesignIntent → MultiModalRouter
                     ↓
              DesignSystemGraph ←── Cross-project learning
                     ↓
     ┌── StyleKit ── DeckPlan ── PPTJson
     │        ↕          ↕           ↕
     │   LayoutPlan  SlideRole   ContentBlock
     │        ↕          ↕           ↕
     └── RenderSpec ── DesignCheck ── Preview
              ↕
           Export (PPTX/PDF/Web)
              ↕
         Collaboration Timeline
```

## 实施路线

| 阶段 | 内容 | 优先级 |
|------|------|--------|
| G1 | DesignIntent 类型定义 + 意图编辑 UI | P1 |
| G2 | 图表引擎集成 (ECharts 数据驱动模板) | P1 |
| G3 | L3 编辑协议 (意图级编辑 → 级联到样式) | P2 |
| G4 | 设计系统图谱 (跨项目学习) | P2 |
| G5 | 实时协作时间线基础 | P3 |
| G6 | 多模态路由 (内容类型自动分发) | P3 |

## 技术储备

- **图表引擎**: ECharts 5.x (Apache 2.0)，数据驱动模板
- **设计系统图谱**: 使用 Neo4j 或纯 JSON graph，初始约 100-500 节点/项目
- **协作**: CRDT (Yjs) 用于实时协作，OT 用于服务端合并
- **多模态**: 路由层抽象，后端接入不同模型（GPT-4V/Midjourney/Stable Diffusion）

## 非目标

- 不是设计工具（不替代 Figma/Canva）
- 不是协作平台（不替代 Google Slides）
- 不是 AI 设计生成器（不替代 Midjourney）
- 是 **PPT 制作的设计增强层** — 让非设计师也能做出有意图的演示文稿

---

*撰写时间: 2026-05-01*
