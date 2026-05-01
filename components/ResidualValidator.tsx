'use client';

import { useState } from 'react';
import { ResidualCheck, ResidualIssue, performResidualCheck, getTotalIssueCount, getCriticalIssueCount } from '@/lib/residual-checker';
import { PPTJson } from '@/types';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface ResidualValidatorProps {
  pptJson: PPTJson;
  onIssueClick?: (slideId: string, elementId?: string) => void;
  onReCheck?: () => void;
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', label: '严重' },
  high: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', label: '高' },
  medium: { icon: Info, color: 'text-yellow-600', bg: 'bg-yellow-50', label: '中' },
  low: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', label: '低' },
};

const ISSUE_TYPE_LABELS: Record<ResidualIssue['type'], string> = {
  missing_asset: '缺少资源',
  inconsistent_layout: '布局不一致',
  text_overflow: '文字溢出',
  empty_block: '空内容块',
  style_deviation: '风格偏离',
};

export default function ResidualValidator({ pptJson, onIssueClick, onReCheck }: ResidualValidatorProps) {
  const [checks, setChecks] = useState<ResidualCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [expandedSlides, setExpandedSlides] = useState<Set<string>>(new Set());

  const runCheck = async () => {
    setIsChecking(true);
    try {
      // Simulate async for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      const results = performResidualCheck(pptJson);
      setChecks(results);

      // Auto-expand slides with issues
      setExpandedSlides(new Set(results.map(r => r.slideId)));

      onReCheck?.();
    } finally {
      setIsChecking(false);
    }
  };

  const toggleSlide = (slideId: string) => {
    const newExpanded = new Set(expandedSlides);
    if (newExpanded.has(slideId)) {
      newExpanded.delete(slideId);
    } else {
      newExpanded.add(slideId);
    }
    setExpandedSlides(newExpanded);
  };

  const totalIssues = getTotalIssueCount(checks);
  const criticalIssues = getCriticalIssueCount(checks);
  const slideIndexMap = new Map(pptJson.slides.map((s, i) => [s.id, i + 1]));

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div>
          <h4 className="font-medium">质量检查</h4>
          {checks.length > 0 && (
            <p className={`text-sm ${criticalIssues > 0 ? 'text-red-600' : 'text-green-600'}`}>
              发现 {totalIssues} 个问题 ({criticalIssues} 个严重)
            </p>
          )}
        </div>
        <button
          onClick={runCheck}
          disabled={isChecking}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
          {isChecking ? '检查中...' : '重新检查'}
        </button>
      </div>

      {/* Results */}
      {checks.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Info size={32} className="mx-auto mb-2 text-gray-300" />
          <p>点击「重新检查」开始质量检查</p>
          <p className="text-sm mt-1">AI 生成后自动检测遗漏元素</p>
        </div>
      ) : (
        <div className="divide-y">
          {checks.map((check) => {
            const slideNumber = slideIndexMap.get(check.slideId) || '?';
            const isExpanded = expandedSlides.has(check.slideId);
            const criticalCount = check.issues.filter(i => i.severity === 'critical').length;

            return (
              <div key={check.slideId}>
                {/* Slide header */}
                <button
                  onClick={() => toggleSlide(check.slideId)}
                  className="w-full p-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <span className="font-medium">第 {slideNumber} 页</span>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {check.issues.length} 问题
                    </span>
                  </div>
                </button>

                {/* Issues list */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {check.issues.map((issue, idx) => {
                      const config = SEVERITY_CONFIG[issue.severity];
                      const Icon = config.icon;

                      return (
                        <button
                          key={idx}
                          onClick={() => onIssueClick?.(check.slideId, issue.elementId)}
                          className={`w-full p-3 rounded border text-left ${config.bg} hover:opacity-80`}
                        >
                          <div className="flex items-start gap-2">
                            <Icon size={16} className={`mt-0.5 ${config.color}`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${config.color} bg-white`}>
                                  {config.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {ISSUE_TYPE_LABELS[issue.type]}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{issue.description}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-gray-500 mt-1">
                                  建议: {issue.suggestion}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
