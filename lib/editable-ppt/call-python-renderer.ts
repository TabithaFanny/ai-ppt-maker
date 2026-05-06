/**
 * call-python-renderer.ts
 *
 * 封装 Python image2pptx.py 调用。
 * - 写 manifest.json 到 tmp 目录
 * - 调用 Python 脚本生成 PPTX
 * - 读取 PPTX 二进制并返回
 * - 清理临时文件
 *
 * 所有错误（Python 不存在、依赖未安装、脚本失败、manifest 非法）都被捕获
 * 并抛出带描述的 Error。
 */

import { execFile } from 'node:child_process';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EditablePptManifest } from './manifest-types';

// Resolve paths relative to project root
const PROJECT_ROOT = process.cwd();
const VENV_PYTHON = join(PROJECT_ROOT, 'scripts', '.venv', 'bin', 'python3');
const SCRIPT_PATH = join(PROJECT_ROOT, 'scripts', 'image2pptx.py');

export interface RenderResult {
  pptxBuffer: Buffer;
  summary: Record<string, unknown>;
}

/**
 * Call the Python PPTX renderer with a manifest.
 *
 * @param manifest - The structured manifest to render
 * @param fileName - Base filename for the output (without extension)
 * @returns Buffer containing the PPTX file and a summary object
 */
export async function callPythonRenderer(
  manifest: EditablePptManifest,
  fileName: string = 'output',
): Promise<RenderResult> {
  const tmpDir = join('/tmp', `editable-ppt-${randomUUID()}`);
  const manifestPath = join(tmpDir, 'manifest.json');
  const outputPath = join(tmpDir, `${fileName}.pptx`);
  const summaryPath = join(tmpDir, 'summary.json');

  try {
    // 1. Create tmp directory and write manifest
    await mkdir(tmpDir, { recursive: true });
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    // 2. Call Python script
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        VENV_PYTHON,
        [
          SCRIPT_PATH,
          'build',
          '--manifest', manifestPath,
          '--output', outputPath,
          '--summary', summaryPath,
        ],
        { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const msg = stderr || error.message;
            if (msg.includes('No such file') || msg.includes('not found')) {
              reject(new Error(
                `Python 环境未就绪。请运行: python3 -m venv scripts/.venv && scripts/.venv/bin/pip install python-pptx Pillow\n\n${msg}`
              ));
            } else if (msg.includes('ModuleNotFoundError')) {
              reject(new Error(
                `Python 依赖缺失。请运行: scripts/.venv/bin/pip install python-pptx Pillow\n\n${msg}`
              ));
            } else if (msg.includes('json.decoder.JSONDecodeError') || msg.includes('KeyError')) {
              reject(new Error(`Manifest 格式错误: ${msg}`));
            } else {
              reject(new Error(`Python 渲染失败: ${msg}`));
            }
            return;
          }
          resolve(stdout);
        },
      );
    });

    // 3. Read output files
    const pptxBuffer = await readFile(outputPath);
    let summary: Record<string, unknown> = {};
    try {
      const summaryText = await readFile(summaryPath, 'utf-8');
      summary = JSON.parse(summaryText);
    } catch {
      // Summary is optional — parse stdout as fallback
      try { summary = JSON.parse(stdout); } catch { /* ignore */ }
    }

    return { pptxBuffer, summary };
  } finally {
    // 4. Clean up tmp directory
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
