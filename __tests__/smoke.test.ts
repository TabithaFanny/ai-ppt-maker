/**
 * Smoke tests — verify core modules load and function correctly
 */

// ---- lib/logger ----
import { logger, setLogLevel, getLogLevel } from '../lib/logger';

describe('logger', () => {
  it('exports all log level methods', () => {
    expect(logger.debug).toBeInstanceOf(Function);
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
  });

  it('getLogLevel returns default warn on server', () => {
    expect(getLogLevel()).toBe('warn');
  });

  it('setLogLevel exists', () => {
    expect(setLogLevel).toBeInstanceOf(Function);
  });

  it('logger methods do not throw', () => {
    expect(() => logger.debug('smoke')).not.toThrow();
    expect(() => logger.info('smoke')).not.toThrow();
    expect(() => logger.warn('smoke')).not.toThrow();
    expect(() => logger.error('smoke')).not.toThrow();
  });
});

// ---- lib/api-client ----
import { isMockMode, getAiMode, getErrorMessage, AIError } from '../lib/api-client';

describe('api-client', () => {
  it('AIError extends Error with detail', () => {
    const err = new AIError({
      provider: 'test',
      stage: 'smoke',
      message: 'test error',
      fallbackUsed: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AIError');
    expect(err.detail.provider).toBe('test');
    expect(err.detail.stage).toBe('smoke');
  });

  it('getAiMode returns a valid mode', () => {
    expect(['mock', 'real', 'auto']).toContain(getAiMode());
  });

  it('isMockMode returns boolean', () => {
    expect(typeof isMockMode()).toBe('boolean');
  });

  describe('getErrorMessage', () => {
    it('returns Chinese messages for known codes', () => {
      expect(getErrorMessage('minimax', 401)).toBe('MiniMax API Key 无效或已过期');
      expect(getErrorMessage('deepseek', 429)).toBe('DeepSeek 请求频率超限，请稍后重试');
      expect(getErrorMessage('openai', 500)).toBe('OpenAI 服务器内部错误');
    });

    it('returns network error for no status', () => {
      expect(getErrorMessage('minimax', 0)).toBe('网络连接失败，请检查网络设置');
    });

    it('includes status in fallback for unknown codes', () => {
      const msg = getErrorMessage('minimax', 418);
      expect(msg).toContain('418');
    });
  });
});

// ---- lib/api-response ----
import { ok, fail } from '../lib/api-response';

describe('api-response', () => {
  it('ok returns success response', async () => {
    const res = ok({ id: 1 });
    expect(res).toBeInstanceOf(Response);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: 1 });
  });

  it('ok returns 200 by default', () => {
    const res = ok({ x: 1 });
    expect(res.status).toBe(200);
  });

  it('fail returns error response', async () => {
    const res = fail('Not found', 404);
    expect(res).toBeInstanceOf(Response);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not found');
  });

  it('fail returns 500 by default', () => {
    const res = fail('error');
    expect(res.status).toBe(500);
  });
});

// ---- lib/schemas ----
import {
  PPTJsonSchema,
  StyleConfigSchema,
  DeckPlanSchema,
  EditPatchSchema,
  validateAIOutput,
} from '../lib/schemas';

describe('schemas', () => {
  describe('PPTJsonSchema', () => {
    it('rejects non-object input', () => {
      const result = PPTJsonSchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('rejects empty object', () => {
      const result = PPTJsonSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('StyleConfigSchema', () => {
    it('rejects empty object', () => {
      const result = StyleConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('accepts valid style config', () => {
      const valid = {
        overallStyle: 'business' as const,
        palette: { primary: '#1a73e8', secondary: '#ffffff', accent: '#ff5722', background: '#f5f5f5', text: '#333333' },
        typography: { titleFont: 'Arial', bodyFont: 'Arial', titleSize: 32, bodySize: 16 },
        layout: { type: 'single' as const, spacing: 20, padding: 40 },
        designPrinciples: ['clarity', 'consistency'],
      };
      const result = StyleConfigSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('validateAIOutput', () => {
    it('returns success for valid data', () => {
      const valid = {
        overallStyle: 'business',
        palette: { primary: '#1a73e8', secondary: '#ffffff', accent: '#ff5722', background: '#f5f5f5', text: '#333333' },
        typography: { titleFont: 'Arial', bodyFont: 'Arial', titleSize: 32, bodySize: 16 },
        layout: { type: 'single', spacing: 20, padding: 40 },
        designPrinciples: ['clarity'],
      };
      const result = validateAIOutput(StyleConfigSchema, valid, 'test');
      expect(result.success).toBe(true);
    });

    it('returns error for invalid data', () => {
      const result = validateAIOutput(StyleConfigSchema, {}, 'test');
      expect(result.success).toBe(false);
    });
  });
});

// ---- lib/text-diff ----
import { computeTextDiff } from '../lib/text-diff';

describe('text-diff', () => {
  it('returns same segment for identical text', () => {
    const result = computeTextDiff('hello', 'hello');
    expect(result).toEqual([{ text: 'hello', type: 'same' }]);
  });

  it('detects additions', () => {
    const result = computeTextDiff('hello', 'hello world');
    const additions = result.filter((d) => d.type === 'added');
    expect(additions.length).toBeGreaterThan(0);
  });

  it('detects deletions', () => {
    const result = computeTextDiff('hello world', 'hello');
    const deletions = result.filter((d) => d.type === 'removed');
    expect(deletions.length).toBeGreaterThan(0);
  });

  it('handles empty strings', () => {
    expect(() => computeTextDiff('', '')).not.toThrow();
    expect(() => computeTextDiff('a', '')).not.toThrow();
    expect(() => computeTextDiff('', 'b')).not.toThrow();
  });
});

// ---- lib/auto-fixer ----
import { autoFixPPTJson } from '../lib/auto-fixer';

describe('auto-fixer', () => {
  it('preserves valid pptJson structure', () => {
    const valid = {
      metadata: {
        projectId: 'test-1',
        title: 'Test',
        category: 'tech',
        audience: 'general',
        createdAt: '2025-01-01',
      },
      designSystem: {
        palette: { primary: '#000', secondary: '#fff', accent: '#f00', background: '#eee', text: '#111' },
        typography: { titleFont: 'Arial', bodyFont: 'Arial', titleSize: 32, bodySize: 16 },
      },
      roles: { designer: 'AI', contentStrategist: 'AI', visualDirector: 'AI' },
      slides: [
        {
          id: '1',
          layout: 'content' as const,
          title: 'Slide 1',
          content: [],
          mainConclusion: 'OK',
        },
      ],
    };
    const { pptJson, result } = autoFixPPTJson(valid, []);
    expect(pptJson.metadata.title).toBe('Test');
    expect(pptJson.slides).toHaveLength(1);
    expect(result).toHaveProperty('fixed');
  });
});
