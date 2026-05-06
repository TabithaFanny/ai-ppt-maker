'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useStore } from '@/lib/store';
import { Send, Sparkles, Check, X, Edit3, Save, Loader2, FileText, ImageIcon, Layers } from 'lucide-react';
import type { WorkbenchMessage, GenSlidePrompt, DeckBrief } from '@/types';
import type { SlideRole } from '@/types/stylekit';

type WorkbenchAiStatus = NonNullable<WorkbenchMessage['metadata']>['aiStatus'];

function extractDeckPlan(text: string): { deckPlan?: Record<string, unknown>; hasDeckPlan: boolean } {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) return { hasDeckPlan: false };
  try {
    const parsed = JSON.parse(match[1].trim());
    if (parsed.deckPlan) return { deckPlan: parsed.deckPlan, hasDeckPlan: true };
  } catch { /* ignore */ }
  return { hasDeckPlan: false };
}

function toGenSlidePrompt(partial: Partial<GenSlidePrompt> & { id: string; index: number; title: string; type: SlideRole }): GenSlidePrompt {
  return {
    id: partial.id,
    index: partial.index,
    title: partial.title,
    type: partial.type,
    referenceSlideIds: partial.referenceSlideIds ?? [],
    contentGoal: partial.contentGoal ?? '',
    elements: partial.elements ?? [],
    layoutStructure: partial.layoutStructure ?? '',
    colorRules: partial.colorRules ?? { primary: '#1e40af', secondary: '#60a5fa', background: '#ffffff', text: '#0f172a' },
    assetReferences: partial.assetReferences ?? [],
    globalStylePrompt: partial.globalStylePrompt ?? '',
    visualPrompt: partial.visualPrompt ?? '',
    imagePrompt: partial.imagePrompt,
    chartPrompt: partial.chartPrompt,
    speakerNotePrompt: partial.speakerNotePrompt,
    status: partial.status ?? 'pending',
  };
}

function deckPlanToGenSlidePrompts(deckPlan: Record<string, unknown>): GenSlidePrompt[] {
  const plans = (deckPlan.slidePlans as Array<Record<string, unknown>>) || [];
  const title = (deckPlan.title as string) || '未命名 PPT';
  return plans.map((plan, i) =>
    toGenSlidePrompt({
      id: `gen-${Date.now()}-${i}`,
      index: (plan.index as number) ?? i + 1,
      title: (plan.title as string) || `${title} — 第 ${i + 1} 页`,
      type: (plan.role as SlideRole) || 'content',
      referenceSlideIds: [],
      contentGoal: (plan.contentGoal as string) || '',
      visualPrompt: (plan.visualPrompt as string) || '',
      status: 'pending',
    })
  );
}

/** Convert new v2 brief (status + contentPlan) to GenSlidePrompt[] */
function v2BriefToGenSlidePrompts(brief: Record<string, unknown>): GenSlidePrompt[] {
  const contentPlan = (brief.contentPlan || {}) as Record<string, unknown>;
  const structure = contentPlan.structure as Array<Record<string, unknown>> || [];
  if (!structure.length) return [];

  return structure.map((item, i) =>
    toGenSlidePrompt({
      id: `gen-v2-${Date.now()}-${i}`,
      index: i + 1,
      title: (item.title as string) || `第 ${i + 1} 页`,
      type: 'content' as SlideRole,
      referenceSlideIds: [],
      contentGoal: (item.goal as string) || '',
      visualPrompt: (brief.globalStylePrompt as string) || '',
      status: 'pending',
    })
  );
}

/** Convert v2 deckGenerationBrief.finalDeckOutline to GenSlidePrompt[] */
function deckBriefToGenSlidePrompts(brief: Record<string, unknown>): GenSlidePrompt[] {
  const genBrief = (brief.generationBrief || brief) as Record<string, unknown>;
  const outline = genBrief.finalDeckOutline as Array<Record<string, unknown>>;
  if (!outline?.length) return [];

  return outline.map((plan, i) =>
    toGenSlidePrompt({
      id: `gen-brief-${Date.now()}-${i}`,
      index: (plan.slideIndex as number) ?? i + 1,
      title: (plan.title as string) || `第 ${i + 1} 页`,
      type: (plan.section as SlideRole) || 'content',
      referenceSlideIds: [],
      contentGoal: (plan.coreMessage as string) || '',
      visualPrompt: (plan.visualStrategy as string) || (plan.layoutStrategy as string) || '',
      status: 'pending',
    })
  );
}

const THINKING_PHRASES = [
  '正在理解你的需求...',
  '分析参考 PPT 风格...',
  '拆解内容诉求...',
  '规划页面结构...',
  '匹配最佳模板方向...',
  '整理元素布局方案...',
  '生成页面 Prompt...',
  '检查风格一致性...',
  '优化配色与排版...',
  '即将完成，请稍候...',
];

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 3000);
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => { clearInterval(phraseTimer); clearInterval(dotTimer); };
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-[#64748b]">
      <Loader2 size={12} className="animate-spin text-[#2563eb]" />
      <span>{THINKING_PHRASES[phraseIndex]}{dots}</span>
    </div>
  );
}

export default function WorkbenchChat() {
  const store = useStore();
  const {
    workbenchMessages, addWorkbenchMessage,
    referenceSlidePrompts, currentStyleKit,
    setGeneratedSlidePrompts,
    assetLibrary,
    extractedDocumentText,
    uploadedDocuments,
    masterTemplate,
    saveWorkbench,
    currentProject, setCurrentProject,
  } = store;
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workbenchMessages]);

  // Welcome message
  useEffect(() => {
    if (workbenchMessages.length === 0) {
      const hasAnalyzed = referenceSlidePrompts.length > 0;
      const analyzedCount = referenceSlidePrompts.length;
      const firstAnalyzed = referenceSlidePrompts[0];

      let welcome = '你好！我是 AI PPT 助手，帮你把参考 PPT 的风格变成新 PPT。';
      const followups: string[] = [];

      if (hasAnalyzed) {
        const titles = firstAnalyzed?.reusablePrompt?.slice(0, 30) || '风格已分析';
        welcome = `我已分析完 ${analyzedCount} 页参考 PPT。\n\n「${titles}...」\n\n现在告诉我你要做什么 PPT、给谁看、大约几页，我来帮你规划每一页。`;
        followups.push(
          `我需要做一份路演 PPT，约 ${Math.max(analyzedCount, 6)} 页`,
          `我想做产品介绍 PPT，约 ${Math.max(analyzedCount, 8)} 页`,
          '参考页的风格怎么样？'
        );
      } else {
        welcome = `你好！我是 AI PPT 助手，帮你把参考 PPT 的风格变成新 PPT。\n\n**使用步骤：**\n1. 左侧上传或拖入参考 PPT\n2. 我会分析设计风格\n3. 告诉我你的需求，我来规划每一页`;
        followups.push(
          '我想做一份路演 PPT',
          '有什么功能？'
        );
      }

      addWorkbenchMessage({
        id: 'welcome',
        role: 'assistant',
        content: welcome,
        timestamp: Date.now(),
        metadata: { suggestedFollowups: followups },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceSlidePrompts.length]);

  // Process the final structured result from the SSE stream
  const handleStreamResult = useCallback(async (data: Record<string, unknown>, thinkingId: string, streamedText: string) => {
    // New v2 format: data.slides
    if (data.slides && Array.isArray(data.slides) && data.slides.length > 0) {
      const prompts = data.slides.map((s: Record<string, unknown>, i: number) =>
        toGenSlidePrompt({
          id: (s.id as string) || `gen-${Date.now()}-${i}`,
          index: (s.index as number) || i + 1,
          title: (s.title as string) || `第 ${i + 1} 页`,
          type: (s.type as SlideRole) || 'content',
          referenceSlideIds: (s.referenceSlideIds as number[]) || [],
          contentGoal: (s.contentGoal as string) || '',
          elements: (s.elements as GenSlidePrompt['elements']) || [],
          layoutStructure: (s.layoutStructure as string) || '',
          colorRules: (s.colorRules as GenSlidePrompt['colorRules']) || {
            primary: '#1e40af', secondary: '#60a5fa', background: '#ffffff', text: '#0f172a'
          },
          assetReferences: (s.assetReferences as string[]) || [],
          globalStylePrompt: (s.globalStylePrompt as string) ||
            (data.deckBrief as Record<string, unknown>)?.globalStylePrompt as string || '',
          visualPrompt: (s.visualPrompt as string) || '',
          imagePrompt: s.imagePrompt as string | undefined,
          chartPrompt: s.chartPrompt as string | undefined,
          speakerNotePrompt: s.speakerNotePrompt as string | undefined,
          status: (s.status as GenSlidePrompt['status']) || 'pending',
        })
      );
      setGeneratedSlidePrompts(prompts);

      // Auto-update project title from deck brief topic
      const brief = data.deckBrief as DeckBrief | undefined;
      const topic = brief?.topic as string | undefined;
      const latestProject = useStore.getState().currentProject;
      if (topic && latestProject && latestProject.title.startsWith('PPT ')) {
        const { projectService } = await import('@/lib/db');
        await projectService.update(latestProject.id, { title: topic });
        setCurrentProject({ ...latestProject, title: topic });
      }

      addWorkbenchMessage({
        id: thinkingId,
        role: 'assistant',
        content: (data.assistantMessage as string) || streamedText || '',
        timestamp: Date.now(),
        metadata: {
          deckPlanUpdate: true,
          newSlidePrompts: prompts.map((p: GenSlidePrompt) => p.index),
          suggestedFollowups: (data.suggestedFollowups as string[]) || [],
          aiStatus: data.status as WorkbenchAiStatus,
          deckBrief: brief,
          summary: data.summary as string,
        },
      });
      return;
    }

    // Legacy format parsing
    const v2Brief = data.brief as Record<string, unknown> | undefined;
    let hasPlan = false;

    if (v2Brief?.status && v2Brief?.contentPlan) {
      const prompts = v2BriefToGenSlidePrompts(v2Brief);
      if (prompts.length > 0) { setGeneratedSlidePrompts(prompts); hasPlan = true; }
    } else if (v2Brief?.schemaVersion === 'ppt-assistant-brief-v1') {
      const outline = (v2Brief.generationBrief as Record<string, unknown>)?.finalDeckOutline as Array<Record<string, unknown>>;
      if (outline?.length) {
        const prompts = deckBriefToGenSlidePrompts(v2Brief);
        setGeneratedSlidePrompts(prompts);
        hasPlan = true;
      }
    } else {
      const { deckPlan, hasDeckPlan } = extractDeckPlan(streamedText);
      if (hasDeckPlan && deckPlan) {
        const prompts = deckPlanToGenSlidePrompts(deckPlan);
        setGeneratedSlidePrompts(prompts);
        hasPlan = true;
      }
    }

    addWorkbenchMessage({
      id: thinkingId,
      role: 'assistant',
      content: (data.assistantMessage as string) || streamedText || '收到，正在处理...',
      timestamp: Date.now(),
      metadata: {
        deckPlanUpdate: hasPlan,
        suggestedFollowups: (data.suggestedFollowups as string[]) || [],
      },
    });
  }, [addWorkbenchMessage, setGeneratedSlidePrompts, setCurrentProject]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    const userMsg: WorkbenchMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addWorkbenchMessage(userMsg);

    // Show streaming placeholder immediately
    const thinkingId = crypto.randomUUID();
    setThinkingMessageId(thinkingId);
    addWorkbenchMessage({
      id: thinkingId,
      role: 'assistant',
      content: '正在思考并规划页面...',
      timestamp: Date.now(),
    });

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const res = await fetch('/api/workbench-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...workbenchMessages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          styleKit: currentStyleKit,
          referenceSlidePrompts,
          assetLibrary,
          extractedDocumentText,
          masterPrompt: masterTemplate?.masterPrompt || undefined,
        }),
      });

      if (!res.ok) {
        addWorkbenchMessage({
          id: thinkingId,
          role: 'assistant',
          content: '抱歉，AI 服务暂时不可用，请稍后重试。',
          timestamp: Date.now(),
        });
        return;
      }

      // Consume SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let sseBuffer = '';
      let streamedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const payload = JSON.parse(dataStr);

              if (currentEvent === 'text') {
                streamedText += payload.content;
                // Update the thinking message in-place with streamed text
                addWorkbenchMessage({
                  id: thinkingId,
                  role: 'assistant',
                  content: streamedText,
                  timestamp: Date.now(),
                });
              } else if (currentEvent === 'result') {
                // Final structured result — process slides and metadata
                const data = payload;
                handleStreamResult(data, thinkingId, streamedText);
              } else if (currentEvent === 'error') {
                addWorkbenchMessage({
                  id: thinkingId,
                  role: 'assistant',
                  content: streamedText || `抱歉，对话出错：${payload.message}`,
                  timestamp: Date.now(),
                });
              }
            } catch {
              // skip malformed SSE data
            }
            currentEvent = '';
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        addWorkbenchMessage({
          id: thinkingId,
          role: 'assistant',
          content: '已取消生成。',
          timestamp: Date.now(),
        });
      } else {
        addWorkbenchMessage({
          id: thinkingId,
          role: 'assistant',
          content: '抱歉，连接失败。请检查网络后重试。',
          timestamp: Date.now(),
        });
      }
    } finally {
      setSending(false);
      setThinkingMessageId(null);
      abortControllerRef.current = null;
      saveWorkbench().catch(() => {});
    }
  }, [input, sending, workbenchMessages, currentStyleKit, referenceSlidePrompts, addWorkbenchMessage, setGeneratedSlidePrompts, assetLibrary, extractedDocumentText, masterTemplate, saveWorkbench, handleStreamResult]);

  const handleQuickReply = useCallback((text: string) => {
    setInput(text);
    inputRef.current?.focus();
  }, []);

  const lastMsg = workbenchMessages[workbenchMessages.length - 1];
  const followups = lastMsg?.metadata?.suggestedFollowups || [];

  // Detect if last message is a work order (contains style analysis cues)
  const isWorkOrder = lastMsg?.content?.includes('风格分析完成') || lastMsg?.content?.includes('建议的适配方向');

  // Template selection card: shown on first interaction (before first user message)
  const showTemplateCard = workbenchMessages.length <= 1;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-[var(--color-border)] bg-[#f8fafc] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#dbeafe] text-[#1d4ed8]">
            <Sparkles size={15} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-[var(--color-text-primary)]">AI PPT 助手</h3>
            <p className="text-[10px] text-[#64748b]">根据参考页风格，为你规划新 PPT 的页面结构和内容方向</p>
          </div>
          {referenceSlidePrompts.length > 0 && (
            <span className="ml-auto rounded-full border border-[#bfdbfe] bg-white px-2 py-1 text-[10px] font-medium text-[#1d4ed8]">
              {referenceSlidePrompts.length} 页已分析
            </span>
          )}
        </div>
      </div>

      {/* Template recommendation card — shown before first user message */}
      {showTemplateCard && (
        <div className="border-b border-[var(--color-border)] bg-gradient-to-br from-[#eff6ff] to-white px-4 py-4">
          <div className="rounded-2xl border border-[#bfdbfe] bg-white/90 p-4 shadow-sm">
            <p className="mb-2 text-[11px] font-semibold text-[#1d4ed8]">
            {referenceSlidePrompts.length > 0
              ? `参考 PPT 已分析完成（${referenceSlidePrompts.length} 页），请确认规划方向：`
              : '请确认你的 PPT 规划方向：'}
            </p>
            <p className="mb-3 text-[10px] leading-relaxed text-[#64748b]">
              你可以直接告诉我目标受众、场景和页数，我会先生成右侧的新 PPT Prompt 列表，再逐页生成结果。
            </p>
            <div className="space-y-2">
            {[
              referenceSlidePrompts.length > 0
                ? `我需要做一份路演 PPT，约 ${Math.max(referenceSlidePrompts.length, 6)} 页，面向投资人`
                : '我需要做一份路演 PPT，约 8-10 页，面向投资人',
              referenceSlidePrompts.length > 0
                ? `我想做产品介绍 PPT，约 ${Math.max(referenceSlidePrompts.length, 8)} 页`
                : '我想做产品介绍 PPT，约 10-12 页',
              referenceSlidePrompts.length > 0
                ? `我要做政务汇报 PPT，约 ${Math.max(referenceSlidePrompts.length, 10)} 页`
                : '我要做政务汇报 PPT，约 12-15 页',
              referenceSlidePrompts.length > 0
                ? '参考页的风格怎么样？总结一下整体风格'
                : '我想先上传参考 PPT 看看效果',
            ].map((text, i) => (
              <button
                key={i}
                onClick={() => handleQuickReply(text)}
                className="block w-full rounded-xl border border-[#dbeafe] bg-[#f8fbff] px-3 py-2 text-left text-[11px] text-[#1d4ed8] transition-colors hover:bg-[#eff6ff]"
              >
                {text}
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 space-y-3">
        {workbenchMessages.map((msg) => {
          if (msg.id === 'welcome') return null;

          // Skip rendering placeholder-only thinking messages
          if (msg.id === thinkingMessageId && sending && msg.content === '正在思考并规划页面...') {
            return (
              <div key={msg.id} className="mr-8 rounded-2xl rounded-tl-sm border border-[#dbeafe] bg-white px-3 py-3 shadow-sm">
                <ThinkingIndicator />
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`text-xs ${
                msg.role === 'user'
                  ? 'ml-10 rounded-2xl rounded-tr-sm border border-[#bfdbfe] bg-[#eff6ff] px-3 py-3 text-[#0f172a] shadow-sm'
                  : msg.role === 'assistant'
                    ? 'mr-8 rounded-2xl rounded-tl-sm border border-[#e2e8f0] bg-white px-3 py-3 shadow-sm'
                    : 'text-center text-gray-400 italic text-[10px]'
              }`}
            >
              <div className="mb-1 flex items-center gap-2 text-[10px] text-[#94a3b8]">
                <span className={`inline-flex h-5 items-center rounded-full px-2 ${msg.role === 'user' ? 'bg-white text-[#1d4ed8]' : 'bg-[#f8fafc] text-[#475569]'}`}>
                  {msg.role === 'user' ? '你' : '助手'}
                </span>
              </div>
              <div className="leading-relaxed">
                {msg.role === 'assistant' ? (
                  <div className="prose prose-xs prose-slate max-w-none [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0.5 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:my-1 [&_ul]:text-xs [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:text-xs [&_ol]:my-1 [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:text-[#0f172a] [&_code]:text-[10px] [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_hr]:my-2 [&_hr]:border-slate-200 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2 [&_blockquote]:text-slate-500 [&_blockquote]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>

              {/* Work order action buttons */}
              {isWorkOrder && msg.id === lastMsg?.id && (
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => handleQuickReply('同意，开始生成新 PPT。我需要做一份 [请描述主题]，大约 [页数] 页，面向 [受众]')}
                    className="flex w-full items-center gap-1 rounded-xl bg-green-50 px-3 py-2 text-left text-[10px] text-green-700 hover:bg-green-100"
                  >
                    <Check size={10} />
                    同意这个风格，开始生成
                  </button>
                  <button
                    onClick={() => handleQuickReply('我想微调一下风格：')}
                    className="flex w-full items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-left text-[10px] text-[#1e40af] hover:bg-blue-100"
                  >
                    <Edit3 size={10} />
                    微调风格偏好
                  </button>
                  <button
                    onClick={() => handleQuickReply('请保存这个风格作为模板')}
                    className="flex w-full items-center gap-1 rounded-xl bg-gray-50 px-3 py-2 text-left text-[10px] text-gray-600 hover:bg-gray-100"
                  >
                    <Save size={10} />
                    保存为模板
                  </button>
                  <button
                    onClick={() => handleQuickReply('换一个参考 PPT 或调整分析方向')}
                    className="flex w-full items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-left text-[10px] text-red-600 hover:bg-red-100"
                  >
                    <X size={10} />
                    调整方向
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested follow-ups */}
      {followups.length > 0 && !isWorkOrder && !sending && (
        <div className="border-t border-[var(--color-border)] bg-white px-4 py-3 space-y-2">
          <p className="px-1 text-[10px] font-medium text-[#64748b]">建议的下一步</p>
          {followups.map((f, i) => (
            <button
              key={i}
              onClick={() => handleQuickReply(f)}
              className="block w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-left text-[10px] text-[#1e40af] transition-colors hover:bg-[#eff6ff]"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] bg-white p-3">
        <div className="rounded-2xl border border-[#dbeafe] bg-[#f8fbff] p-2 shadow-sm">
          {/* Context reference chips */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
            {uploadedDocuments.length > 0 ? uploadedDocuments.map((doc) => (
              <button
                key={doc.docId}
                onClick={() => setInput((prev) => prev + (prev ? ' ' : '') + `[引用上传文档: ${doc.name}]`)}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                title={`引用文档: ${doc.name} (${doc.text.length}字)`}
              >
                <FileText size={10} />
                {doc.name.length > 10 ? doc.name.slice(0, 10) + '...' : doc.name}
              </button>
            )) : extractedDocumentText ? (
              <button
                onClick={() => setInput((prev) => prev + (prev ? ' ' : '') + '[引用上传文档]')}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                title="在消息中引用已上传的文档内容"
              >
                <FileText size={10} />
                文档
              </button>
            ) : null}
            {assetLibrary.length > 0 && (
              <button
                onClick={() => setInput((prev) => prev + (prev ? ' ' : '') + `[引用资产库: ${assetLibrary.map(a => a.name).join(', ')}]`)}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-700 transition-colors hover:bg-violet-100"
                title="在消息中引用资产库内容"
              >
                <ImageIcon size={10} />
                资产库({assetLibrary.length})
              </button>
            )}
            {referenceSlidePrompts.length > 0 && (
              <button
                onClick={() => setInput((prev) => prev + (prev ? ' ' : '') + `[引用参考PPT: ${referenceSlidePrompts.length}页已分析]`)}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
                title="在消息中引用参考PPT风格"
              >
                <Layers size={10} />
                参考页({referenceSlidePrompts.length})
              </button>
            )}
            <span className="ml-auto text-[10px] text-[#94a3b8]">Enter 发送</span>
          </div>
          <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={referenceSlidePrompts.length > 0 ? '告诉我你要做什么 PPT，可点击上方标签引用上下文...' : '先上传参考 PPT，再告诉我你的需求'}
            disabled={sending}
            className="flex-1 rounded-xl border border-[#dbeafe] bg-white px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1e40af] disabled:opacity-50"
          />
          {sending ? (
            <button
              onClick={() => {
                abortControllerRef.current?.abort();
                abortControllerRef.current = null;
              }}
              className="rounded-xl bg-red-500 px-3 py-2 text-white shadow-sm hover:bg-red-600 transition-colors"
              title="停止生成"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              title="发送消息"
              className="rounded-xl bg-[#1e40af] px-3 py-2 text-white shadow-[0_8px_18px_rgba(37,99,235,0.24)] hover:bg-[#1e40af]/90 disabled:opacity-40 transition-colors"
            >
              <Send size={14} />
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}