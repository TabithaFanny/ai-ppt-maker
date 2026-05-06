'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { UserInput, ScenarioType, AudienceType, VisualPreference } from '@/types';
import { Plus, X, Sparkles, ArrowRight, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { isMockMode } from '@/lib/api-client';
import { mockPPTJson } from '@/lib/ai-mock-data';

const SCENARIOS: { value: ScenarioType; label: string; description: string }[] = [
  { value: 'course', label: '课程展示', description: '教学课件、学术报告' },
  { value: 'defense', label: '项目答辩', description: '毕业答辩、比赛路演' },
  { value: 'pitch', label: '商业路演', description: '融资演讲、产品发布' },
  { value: 'report', label: '工作汇报', description: '季度总结、年度汇报' },
  { value: 'proposal', label: '品牌提案', description: '营销方案、活动策划' },
  { value: 'training', label: '培训课件', description: '企业内训、技能培训' },
  { value: 'research', label: '研究报告', description: '市场分析、学术论文' },
];

const AUDIENCES: { value: AudienceType; label: string }[] = [
  { value: 'teacher', label: '老师' }, { value: 'judge', label: '评委' }, { value: 'client', label: '客户' },
  { value: 'leader', label: '领导' }, { value: 'student', label: '同学' }, { value: 'investor', label: '投资人' }, { value: 'team', label: '团队' },
];

const VISUAL_PREFERENCES: { value: VisualPreference; label: string; description: string }[] = [
  { value: 'strong_consistency', label: '强一致', description: '严格遵循模板风格，不做改变' },
  { value: 'reference_based', label: '参考为主', description: '以模板为基础，适度创新' },
  { value: 'style_only', label: '只提风格', description: '不限制模板，AI 自由发挥' },
];

function buildAIPrompt(data: UserInput): string {
  const lines: string[] = [];
  if (data.topic) lines.push(`请基于以下需求，生成一份约 ${data.pageCount || 10} 页的中文演示文稿，主题为"${data.topic}"。`);
  if (data.description) lines.push(`\n详细描述：${data.description}`);
  if (data.scenario) {
    const label = SCENARIOS.find(s => s.value === data.scenario)?.label;
    if (label) lines.push(`\n使用场景：${label}`);
  }
  if (data.audience) {
    const label = AUDIENCES.find(a => a.value === data.audience)?.label;
    if (label) lines.push(`面向对象：${label}`);
  }
  const keys = data.keyPoints.filter(k => k.trim());
  if (keys.length > 0) {
    lines.push(`\n关键内容点：`);
    keys.forEach((k, i) => lines.push(`${i + 1}. ${k}`));
  }
  lines.push(`\n页数要求：约 ${data.pageCount || 10} 页`);
  if (data.visualPreference) {
    const label = VISUAL_PREFERENCES.find(v => v.value === data.visualPreference)?.label;
    if (label) lines.push(`视觉风格偏好：${label}`);
  }
  if (data.specialRequirements) lines.push(`\n特殊要求：${data.specialRequirements}`);
  lines.push(`\n请采用清晰的逻辑结构、图文结合的方式呈现，突出核心价值与实际应用成效。`);
  return lines.join('\n');
}

export default function EnhancedRequirementsForm() {
  const { updateUserInput, setCurrentStep, currentProject, updatePPTJson } = useStore();
  const [formData, setFormData] = useState<UserInput>({
    topic: '', description: '', keyPoints: [''],
    pageCount: 15, template: undefined, scenario: undefined,
    audience: undefined, visualPreference: undefined, pageRecommendation: undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [manualPrompt, setManualPrompt] = useState('');
  const [promptTouchedByUser, setPromptTouchedByUser] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const manualPromptRef = useRef<HTMLTextAreaElement>(null);

  // 表单变化时自动更新 prompt
  useEffect(() => {
    if (!promptTouchedByUser) {
      setGeneratedPrompt(buildAIPrompt(formData));
    }
  }, [formData, promptTouchedByUser]);

  const handlePromptEdit = useCallback((value: string) => {
    setManualPrompt(value);
    setPromptTouchedByUser(true);
  }, []);

  const regenerateFromForm = useCallback(() => {
    const newPrompt = buildAIPrompt(formData);
    setGeneratedPrompt(newPrompt);
    setManualPrompt(newPrompt);
    setPromptTouchedByUser(false);
  }, [formData]);

  // 初始化
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (currentProject?.userInput) {
      const ui = currentProject.userInput;
      setFormData(ui);
      const prompt = buildAIPrompt(ui);
      setGeneratedPrompt(prompt);
      setManualPrompt(prompt);
    } else {
      const initialPrompt = buildAIPrompt(formData);
      setGeneratedPrompt(initialPrompt);
      setManualPrompt(initialPrompt);
    }
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const activePrompt = promptTouchedByUser ? manualPrompt : generatedPrompt;

  const addKeyPoint = () => setFormData({ ...formData, keyPoints: [...formData.keyPoints, ''] });
  const removeKeyPoint = (i: number) => { if (formData.keyPoints.length > 1) setFormData({ ...formData, keyPoints: formData.keyPoints.filter((_, j) => j !== i) }); };
  const updateKeyPoint = (i: number, v: string) => { const kp = [...formData.keyPoints]; kp[i] = v; setFormData({ ...formData, keyPoints: kp }); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.topic.trim()) e.topic = '主题不能为空';
    if (formData.topic.length > 100) e.topic = '主题不能超过100字';
    if (!formData.scenario) e.scenario = '请选择使用场景';
    if (!formData.audience) e.audience = '请选择目标受众';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const cleanedInput = { ...formData, keyPoints: formData.keyPoints.filter(k => k.trim()) };
    updateUserInput(cleanedInput);

    // 保存最终 prompt
    const finalPrompt = promptTouchedByUser ? manualPrompt : generatedPrompt;

    setIsGenerating(true);
    setGenStatus('正在生成大纲...');

    try {
      if (isMockMode()) {
        // Mock 模式下直接返回 mockPPTJson
        await new Promise(r => setTimeout(r, 1500));
        setGenStatus('正在生成页面内容...');
        await new Promise(r => setTimeout(r, 1000));
        setGenStatus('正在整理版式...');
        await new Promise(r => setTimeout(r, 500));
        updatePPTJson(mockPPTJson);
        setIsGenerating(false);
        setCurrentStep(4);
        return;
      }

      // 真实模式：调 generate-stream
      const response = await fetch('/api/generate-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          styleConfig: currentProject?.styleConfig,
          styleKit: null,
          userInput: cleanedInput,
          finalPrompt,
        }),
      });

      if (!response.ok) throw new Error('生成失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let resultPPTJson = null;

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n').filter(l => l.startsWith('data: '))) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.stage === 'generating') setGenStatus('正在生成页面内容...');
            else if (data.stage === 'translating') setGenStatus('正在生成大纲...');
            if (data.stage === 'complete' && data.data) {
              resultPPTJson = data.data;
            }
          } catch { /* skip */ }
        }
      }

      if (resultPPTJson) {
        updatePPTJson(resultPPTJson);
      } else {
        throw new Error('未收到生成结果');
      }
    } catch (error) {
      console.error('生成失败:', error);
      // Mock fallback 无论是否 mock 模式
      if (isMockMode()) {
        updatePPTJson(mockPPTJson);
      } else {
        const { useToast } = await import('@/lib/toast');
        useToast.getState().show('error', '内容生成失败，请检查网络后重试');
        setIsGenerating(false);
        return;
      }
    }

    setIsGenerating(false);
    setCurrentStep(4);
  };

  // 生成中页面
  if (isGenerating) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
            <Loader2 size={32} className="text-[#1e40af] animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-[#0f172a] mb-3">正在生成你的 PPT 内容</h3>
          <div className="space-y-2 mb-6">
            {['正在生成大纲', '正在生成页面内容', '正在整理版式', '即将进入编辑器'].map((s) => (
              <div key={s} className={`flex items-center gap-2 text-sm ${genStatus.includes(s.slice(0, 4)) ? 'text-[#1e40af] font-medium' : 'text-gray-400'}`}>
                <div className={`w-2 h-2 rounded-full ${genStatus.includes(s.slice(0, 4)) ? 'bg-[#1e40af] animate-pulse' : 'bg-gray-200'}`} />
                {s}
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-[#1e40af] h-full rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* 左侧：表单 */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a] mb-1">告诉 AI 这份新 PPT 要讲什么</h2>
            <p className="text-sm text-[#64748b]">填写以下内容，AI 将根据你的需求生成对应结构的内容。</p>
          </div>

          {/* 主题 */}
          <section>
            <label htmlFor="ppt-topic" className="block text-sm font-medium text-gray-700 mb-1.5">PPT 主题 <span className="text-red-500">*</span></label>
            <input id="ppt-topic" type="text" value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })}
              placeholder="例如：社区治理 AI 平台解决方案介绍"
              className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" />
            {errors.topic && <p role="alert" className="text-xs text-red-500 mt-1">{errors.topic}</p>}
          </section>

          {/* 面向对象 */}
          <section aria-labelledby="audience-label">
            <label id="audience-label" className="block text-sm font-medium text-gray-700 mb-1.5">面向对象</label>
            <div role="radiogroup" aria-labelledby="audience-label" className="flex flex-wrap gap-2">
              {AUDIENCES.map(a => (
                <button key={a.value} onClick={() => setFormData({ ...formData, audience: a.value })}
                  className={`min-h-[44px] px-3 py-1.5 text-xs rounded-full border transition ${formData.audience === a.value ? 'border-[#1e40af] bg-blue-50 text-[#1e40af]' : 'border-[#e2e8f0] text-gray-600 hover:border-gray-300'}`}>{a.label}</button>
              ))}
            </div>
          </section>

          {/* 使用目标 */}
          <section aria-labelledby="scenario-label">
            <label id="scenario-label" className="block text-sm font-medium text-gray-700 mb-1.5">使用目标</label>
            <div role="radiogroup" aria-labelledby="scenario-label" className="grid grid-cols-2 gap-2">
              {SCENARIOS.slice(0, 6).map(s => (
                <button key={s.value} onClick={() => setFormData({ ...formData, scenario: s.value })}
                  className={`min-h-[44px] p-2.5 border rounded-xl text-left text-xs transition ${formData.scenario === s.value ? 'border-[#1e40af] bg-blue-50' : 'border-[#e2e8f0] hover:border-gray-300'}`}>
                  <div className="font-medium text-gray-900">{s.label}</div>
                  <div className="text-gray-500 mt-0.5">{s.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* 页数 */}
          <section>
            <label htmlFor="page-count" className="block text-sm font-medium text-gray-700 mb-1.5">页数</label>
            <input id="page-count" type="range" min="5" max="50" value={formData.pageCount} onChange={e => setFormData({ ...formData, pageCount: Number(e.target.value) })} className="w-full" />
            <div className="flex justify-between text-xs text-gray-500"><span>5</span><span className="font-medium text-gray-900">{formData.pageCount} 页</span><span>50</span></div>
          </section>

          {/* 关键内容点 */}
          <section>
            <label id="keypoints-label" className="block text-sm font-medium text-gray-700 mb-1.5">关键内容点 <span className="text-red-500">*</span></label>
            <div role="group" aria-labelledby="keypoints-label" className="space-y-2">
              {formData.keyPoints.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input id={`keypoint-${i}`} type="text" value={p} onChange={e => updateKeyPoint(i, e.target.value)} placeholder={`要点 ${i + 1}`}
                    className="flex-1 px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  {formData.keyPoints.length > 1 && <button onClick={() => removeKeyPoint(i)} className="p-2 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                </div>
              ))}
            </div>
            <button onClick={addKeyPoint} className="flex items-center gap-1 min-h-[44px] px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg mt-2"><Plus size={14} />添加要点</button>
          </section>

          {/* 导航按钮 */}
          <div className="flex gap-3 pt-4">
            <button onClick={() => setCurrentStep(2)} className="flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 border border-[#e2e8f0] rounded-xl hover:bg-gray-50 text-sm"><ArrowLeft size={16} />上一步</button>
            <button onClick={handleSubmit} className="flex-1 flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-[#1e40af] text-white text-sm font-medium rounded-xl hover:bg-[#1e40af]/90">下一步：编辑内容<ArrowRight size={16} /></button>
          </div>
        </div>

        {/* 右侧：AI 提示词预览 */}
        <div>
          <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-5 h-full">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-indigo-600" />
              <h3 className="text-base font-semibold text-gray-900">AI 提示词预览</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">你可以在生成前直接编辑提示词。</p>

            {promptTouchedByUser && (
              <div className="flex items-center justify-between mb-3 p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-xs text-amber-800">你已手动修改提示词，后续表单变更不会自动覆盖。</p>
                <button onClick={regenerateFromForm} className="flex items-center gap-1 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-100 rounded-lg whitespace-nowrap">
                  <RefreshCw size={12} />重新生成
                </button>
              </div>
            )}

            <label htmlFor="ai-prompt" className="sr-only">AI 提示词</label>
            <textarea
              id="ai-prompt"
              ref={manualPromptRef}
              value={activePrompt}
              onChange={e => handlePromptEdit(e.target.value)}
              rows={20}
              className="w-full p-3 border border-[#e2e8f0] rounded-xl text-sm font-mono leading-relaxed resize-none outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
