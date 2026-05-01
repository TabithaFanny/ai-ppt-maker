'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { UserInput, ScenarioType, AudienceType, VisualPreference, PageRecommendation } from '@/types';
import { Plus, X, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';

// ... 场景/受众/偏好常量定义 (保持不变) ...

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
  { value: 'teacher', label: '老师' },
  { value: 'judge', label: '评委' },
  { value: 'client', label: '客户' },
  { value: 'leader', label: '领导' },
  { value: 'student', label: '同学' },
  { value: 'investor', label: '投资人' },
  { value: 'team', label: '团队' },
];

const VISUAL_PREFERENCES: { value: VisualPreference; label: string; description: string }[] = [
  { value: 'strong_consistency', label: '强一致', description: '严格遵循模板风格，不做改变' },
  { value: 'reference_based', label: '参考为主', description: '以模板为基础，适度创新' },
  { value: 'style_only', label: '只提风格', description: '不限制模板，AI 自由发挥' },
];

const PAGE_RECOMMENDATIONS: { value: PageRecommendation; label: string; pages: string }[] = [
  { value: 'light', label: '轻量汇报', pages: '6-8 页' },
  { value: 'standard', label: '标准答辩', pages: '10-15 页' },
  { value: 'full', label: '完整方案', pages: '20-30 页' },
];

export default function EnhancedRequirementsForm() {
  const { updateUserInput, setCurrentStep, currentProject } = useStore();
  const [formData, setFormData] = useState<UserInput>({
    topic: '',
    description: '',
    keyPoints: [''],
    pageCount: 20,
    template: undefined,
    scenario: undefined,
    audience: undefined,
    visualPreference: undefined,
    pageRecommendation: undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-recommend page count based on scenario
  useEffect(() => {
    if (formData.scenario && !formData.pageRecommendation) {
      const scenarioPageMap: Record<ScenarioType, PageRecommendation> = {
        course: 'standard',
        defense: 'light',
        pitch: 'light',
        report: 'standard',
        proposal: 'full',
        training: 'standard',
        research: 'full',
      };
      const recommended = scenarioPageMap[formData.scenario];
      setFormData(prev => ({ ...prev, pageRecommendation: recommended }));

      // Set default page count based on recommendation
      const pageCountMap: Record<PageRecommendation, number> = {
        light: 8,
        standard: 12,
        full: 25,
      };
      setFormData(prev => ({ ...prev, pageCount: pageCountMap[recommended] }));
    }
  }, [formData.scenario]);

  const addKeyPoint = () => {
    setFormData({ ...formData, keyPoints: [...formData.keyPoints, ''] });
  };

  const removeKeyPoint = (index: number) => {
    if (formData.keyPoints.length > 1) {
      setFormData({
        ...formData,
        keyPoints: formData.keyPoints.filter((_, i) => i !== index),
      });
    }
  };

  const updateKeyPoint = (index: number, value: string) => {
    const newPoints = [...formData.keyPoints];
    newPoints[index] = value;
    setFormData({ ...formData, keyPoints: newPoints });
  };

  /** 根据表单数据构建 AI 生图的 Prompt 预览 */
  const buildAIPrompt = (data: typeof formData): string => {
    const parts: string[] = [];
    if (data.topic) parts.push(`主题：${data.topic}`);
    if (data.description) parts.push(`描述：${data.description}`);
    const scenarioLabel = SCENARIOS.find(s => s.value === data.scenario)?.label;
    const audienceLabel = AUDIENCES.find(a => a.value === data.audience)?.label;
    if (scenarioLabel) parts.push(`场景：${scenarioLabel}`);
    if (audienceLabel) parts.push(`受众：${audienceLabel}`);
    const keys = data.keyPoints.filter(k => k.trim());
    if (keys.length > 0) parts.push(`要点：${keys.join('、')}`);
    parts.push(`页数：${data.pageCount} 页`);
    const vpLabel = VISUAL_PREFERENCES.find(v => v.value === data.visualPreference)?.label;
    if (vpLabel) parts.push(`风格偏好：${vpLabel}`);
    if (data.specialRequirements) parts.push(`特殊要求：${data.specialRequirements}`);
    return `【需求概要】\n${parts.join('\n')}`;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.topic.trim()) newErrors.topic = '主题不能为空';
    if (formData.topic.length > 100) newErrors.topic = '主题不能超过100字';
    if (formData.description && formData.description.length > 500)
      newErrors.description = '描述不能超过500字';
    if (formData.keyPoints.filter((p) => p.trim()).length === 0)
      newErrors.keyPoints = '至少需要一个关键要点';
    if (!formData.scenario) newErrors.scenario = '请选择使用场景';
    if (!formData.audience) newErrors.audience = '请选择目标受众';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const cleanedInput = {
      ...formData,
      keyPoints: formData.keyPoints.filter((p) => p.trim()),
    };
    updateUserInput(cleanedInput);
    setCurrentStep(4);
  };

  const applyTemplate = (template: 'product' | 'academic' | 'business') => {
    const templates = {
      product: {
        topic: '产品介绍',
        description: '展示产品特性、优势和应用场景',
        keyPoints: ['产品概述', '核心功能', '技术优势', '应用案例', '未来规划'],
        pageCount: 15,
        scenario: 'pitch' as ScenarioType,
        audience: 'client' as AudienceType,
      },
      academic: {
        topic: '学术报告',
        description: '研究背景、方法、结果和结论',
        keyPoints: ['研究背景', '文献综述', '研究方法', '实验结果', '讨论与结论'],
        pageCount: 25,
        scenario: 'course' as ScenarioType,
        audience: 'teacher' as AudienceType,
      },
      business: {
        topic: '商业分析',
        description: '市场分析、竞争格局和战略建议',
        keyPoints: ['市场概况', '竞争分析', 'SWOT分析', '战略建议', '实施计划'],
        pageCount: 20,
        scenario: 'report' as ScenarioType,
        audience: 'leader' as AudienceType,
      },
    };
    setFormData({ ...formData, ...templates[template], template });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">定义你的 PPT 需求</h2>
        <p className="text-gray-600">告诉我们你的使用场景和受众，AI 会生成更精准的内容</p>
      </div>

      {/* Quick Templates */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">快速开始（可选）</label>
        <div className="flex gap-3">
          {(['product', 'academic', 'business'] as const).map((t) => (
            <button
              key={t}
              onClick={() => applyTemplate(t)}
              className={`flex-1 px-4 py-3 border rounded-lg text-left transition ${
                formData.template === t
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">
                {t === 'product' ? '产品介绍' : t === 'academic' ? '学术报告' : '商业分析'}
              </div>
              <div className="text-sm text-gray-500">
                {t === 'product' ? '融资路演、客户提案' : t === 'academic' ? '论文答辩、课堂展示' : '市场分析、战略规划'}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Scenario Selection */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          使用场景 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => setFormData({ ...formData, scenario: s.value })}
              className={`p-4 border rounded-lg text-left transition ${
                formData.scenario === s.value
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">{s.label}</div>
              <div className="text-xs text-gray-500 mt-1">{s.description}</div>
            </button>
          ))}
        </div>
        {errors.scenario && <p className="text-sm text-red-500">{errors.scenario}</p>}
      </section>

      {/* Audience Selection */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          目标受众 <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              onClick={() => setFormData({ ...formData, audience: a.value })}
              className={`px-4 py-2 rounded-full border transition ${
                formData.audience === a.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        {errors.audience && <p className="text-sm text-red-500">{errors.audience}</p>}
      </section>

      {/* Topic */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          PPT 主题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.topic}
          onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
          placeholder="例如：2024年毛绒玩具市场分析报告"
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        {errors.topic && <p className="text-sm text-red-500">{errors.topic}</p>}
      </section>

      {/* Description */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">详细描述（可选）</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="详细说明 PPT 的目的、重点内容和特殊要求"
          rows={3}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
        {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
      </section>

      {/* Key Points */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          关键要点 <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {formData.keyPoints.map((point, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={point}
                onChange={(e) => updateKeyPoint(index, e.target.value)}
                placeholder={`要点 ${index + 1}`}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {formData.keyPoints.length > 1 && (
                <button
                  onClick={() => removeKeyPoint(index)}
                  className="p-2 text-gray-400 hover:text-red-500 transition"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addKeyPoint}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
        >
          <Plus size={18} />
          添加要点
        </button>
        {errors.keyPoints && <p className="text-sm text-red-500">{errors.keyPoints}</p>}
      </section>

      {/* Page Count */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">页数</label>
          {formData.pageRecommendation && (
            <span className="text-sm text-gray-500">
              推荐：{PAGE_RECOMMENDATIONS.find(p => p.value === formData.pageRecommendation)?.pages}
            </span>
          )}
        </div>
        <input
          type="range"
          min="5"
          max="50"
          value={formData.pageCount}
          onChange={(e) => setFormData({ ...formData, pageCount: Number(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between text-sm text-gray-500">
          <span>5 页</span>
          <span className="font-medium text-gray-900">{formData.pageCount} 页</span>
          <span>50 页</span>
        </div>
      </section>

      {/* Visual Preference */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">视觉风格偏好</label>
        <div className="grid md:grid-cols-3 gap-3">
          {VISUAL_PREFERENCES.map((vp) => (
            <button
              key={vp.value}
              onClick={() => setFormData({ ...formData, visualPreference: vp.value })}
              className={`p-4 border rounded-lg text-left transition ${
                formData.visualPreference === vp.value
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-gray-900">{vp.label}</div>
              <div className="text-sm text-gray-500 mt-1">{vp.description}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Special Requirements */}
      <section className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">特殊要求（可选）</label>
        <textarea
          value={formData.specialRequirements}
          onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
          placeholder="例如：需要包含数据图表、强调视觉冲击力、使用深色主题等"
          rows={2}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </section>

      {/* AI Prompt 预览 */}
      {formData.topic && (
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-indigo-600" />
            <span className="text-sm font-semibold text-gray-800">AI 理解你的需求后将生成：</span>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-100 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
            {buildAIPrompt(formData)}
          </div>
          <p className="text-xs text-gray-400 mt-2">修改上方选项即可实时更新预览，你也可以直接在 Prompt 中润色</p>
        </section>
      )}

      {/* Navigation */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={() => setCurrentStep(2)}
          className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <ArrowLeft size={20} />
          上一步
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          下一步：编辑内容
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
