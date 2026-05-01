import { Project, StyleKit, UploadedFile } from '@/types';
import { projectService, fileService, styleKitService } from './db';

export interface ExportData {
  version: string;
  exportedAt: number;
  projects: Project[];
  files: UploadedFile[];
  styleKits?: StyleKit[];
}

export const importExportService = {
  async exportProject(projectId: string): Promise<string> {
    const project = await projectService.getById(projectId);
    if (!project) throw new Error('项目不存在');

    const files = await fileService.getByProject(projectId);
    const styleKit = project.styleKitId
      ? await styleKitService.getById(project.styleKitId)
      : undefined;
    const data: ExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      projects: [project],
      files,
      styleKits: styleKit ? [styleKit] : undefined,
    };

    return JSON.stringify(data, null, 2);
  },

  async exportAll(): Promise<string> {
    const projects = await projectService.getAll();
    const allFiles: UploadedFile[] = [];

    for (const project of projects) {
      const files = await fileService.getByProject(project.id);
      allFiles.push(...files);
    }

    const data: ExportData = {
      version: '1.0',
      exportedAt: Date.now(),
      projects,
      files: allFiles,
      styleKits: await styleKitService.getAll(),
    };

    return JSON.stringify(data, null, 2);
  },

  async importData(jsonString: string): Promise<{ success: number; failed: number }> {
    const data = JSON.parse(jsonString) as ExportData;

    if (!data.version || !data.projects) {
      throw new Error('无效的导入文件格式');
    }

    let success = 0;
    let failed = 0;

    for (const project of data.projects) {
      try {
        const newId = crypto.randomUUID();
        const newProject: Project = {
          ...project,
          id: newId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await projectService.create(newProject);

        const importedStyleKit = data.styleKits?.find((styleKit) => styleKit.id === project.styleKitId);
        if (importedStyleKit) {
          const existing = await styleKitService.getById(importedStyleKit.id);
          if (!existing) {
            await styleKitService.create(importedStyleKit);
          }
        }

        const projectFiles = data.files?.filter(f => f.projectId === project.id) || [];
        for (const file of projectFiles) {
          await fileService.add({
            ...file,
            projectId: newId,
          });
        }

        success++;
      } catch (error) {
        console.error('导入项目失败:', error);
        failed++;
      }
    }

    return { success, failed };
  },

  downloadJSON(data: string, filename: string) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
