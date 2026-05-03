/**
 * 分级日志系统
 * 可通过 localStorage 开关各级日志输出
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const STORAGE_KEY = 'ai-ppt-log-level';
const DEFAULT_LEVEL: LogLevel = 'warn';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getLevel(): LogLevel {
  if (typeof window === 'undefined') return DEFAULT_LEVEL;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as LogLevel | null;
    if (stored && LEVELS[stored] !== undefined) return stored;
  } catch {}
  return DEFAULT_LEVEL;
}

export function setLogLevel(level: LogLevel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, level);
}

export function getLogLevel(): LogLevel {
  return getLevel();
}

function format(args: unknown[]): string {
  return args.map(a => {
    if (typeof a === 'object') {
      try { return JSON.stringify(a); } catch { return String(a); }
    }
    return String(a);
  }).join(' ');
}

export const logger = {
  debug(...args: unknown[]) {
    if (LEVELS[getLevel()] <= LEVELS.debug) {
      console.debug('[DEBUG]', format(args));
    }
  },
  info(...args: unknown[]) {
    if (LEVELS[getLevel()] <= LEVELS.info) {
      console.info('[INFO]', format(args));
    }
  },
  warn(...args: unknown[]) {
    if (LEVELS[getLevel()] <= LEVELS.warn) {
      console.warn('[WARN]', format(args));
    }
  },
  error(...args: unknown[]) {
    if (LEVELS[getLevel()] <= LEVELS.error) {
      console.error('[ERROR]', format(args));
    }
  },
};