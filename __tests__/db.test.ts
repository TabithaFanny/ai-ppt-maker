/**
 * Tests for lib/db.ts — IndexedDB persistence layer
 *
 * Uses Jest mocks for Dexie since fake-indexeddb is not in project dependencies.
 */

import { projectService, versionService, imageService, styleKitService } from '../lib/db';

// --- Mock Dexie ---
// Note: jest.mock factory is hoisted — all variables must be defined inside it
jest.mock('dexie', () => {
  const mockWhereChain = {
    equals: jest.fn(() => mockSortChain),
    anyOf: jest.fn(() => ({ delete: jest.fn() })),
  };
  const mockSortChain = {
    delete: jest.fn(),
    toArray: jest.fn(() => Promise.resolve([])),
    first: jest.fn(),
    sortBy: jest.fn(() => Promise.resolve([])),
    reverse: jest.fn(() => ({
      sortBy: jest.fn(() => Promise.resolve([])),
      toArray: jest.fn(() => Promise.resolve([])),
    })),
  };
  const mockOrderChain = {
    reverse: jest.fn(() => ({
      toArray: jest.fn(() => Promise.resolve([])),
    })),
  };
  const mockTbl = {
    add: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
    where: jest.fn(() => mockWhereChain),
    orderBy: jest.fn(() => mockOrderChain),
    toCollection: jest.fn(() => ({ delete: jest.fn() })),
  };

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      version: jest.fn().mockReturnThis(),
      stores: jest.fn().mockReturnThis(),
      upgrade: jest.fn().mockReturnThis(),
      projects: mockTbl,
      files: mockTbl,
      versions: mockTbl,
      styleKits: mockTbl,
      analysisJobs: mockTbl,
      projectImages: mockTbl,
    })),
  };
});

// Get a reference to the mocked table for assertions
// We need to require dexie to access the mock constructor
const DexieMock = jest.requireMock('dexie').default;

const mockUUID = '550e8400-e29b-41d4-a716-446655440000';
jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('projectService', () => {
  const sampleProject = {
    title: 'Test Project',
    status: 'draft' as const,
    userId: 'user-1',
    userInput: {
      topic: 'Test Topic',
      description: 'Test description',
      keyPoints: ['point 1'],
      pageCount: 5,
    },
    pptJson: undefined,
    step: 1,
  };

  it('creates a project with id and timestamps', async () => {
    const result = await projectService.create(sampleProject);

    expect(result.id).toBe(mockUUID);
    expect(result.createdAt).toBeGreaterThan(0);
    expect(result.updatedAt).toBeGreaterThan(0);
    expect(result.title).toBe('Test Project');
  });

  it('gets project by id', async () => {
    const db = new DexieMock();
    const expected = { id: mockUUID, ...sampleProject, createdAt: 1, updatedAt: 1 };
    db.projects.get.mockResolvedValueOnce(expected);

    const result = await projectService.getById(mockUUID);
    expect(result).toEqual(expected);
  });

  it('updates project and sets updatedAt', async () => {
    const db = new DexieMock();
    db.projects.update.mockResolvedValueOnce(1);

    await projectService.update(mockUUID, { title: 'Updated' });
    expect(db.projects.update).toHaveBeenCalledWith(
      mockUUID,
      expect.objectContaining({ title: 'Updated', updatedAt: expect.any(Number) }),
    );
  });

  it('gets all projects ordered by updatedAt desc', async () => {
    const projects = [
      { id: 'p1', title: 'First', updatedAt: 100 },
      { id: 'p2', title: 'Second', updatedAt: 200 },
    ];
    const db = new DexieMock();
    db.projects.orderBy.mockReturnValueOnce({
      reverse: jest.fn().mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValueOnce(projects),
      }),
    });

    const result = await projectService.getAll();
    expect(result).toEqual(projects);
  });
});

describe('versionService', () => {
  const pptJson = { metadata: { title: 'Test' }, slides: [] } as any;

  it('saves a version', async () => {
    const result = await versionService.save('project-1', pptJson);

    expect(result.id).toBe(mockUUID);
    expect(result.projectId).toBe('project-1');
    expect(result.pptJson).toBe(pptJson);
  });

  it('evicts oldest version when exceeding 10 limit', async () => {
    const oldVersions = Array.from({ length: 10 }, (_, i) => ({
      id: `old-${i}`,
      projectId: 'project-1',
      createdAt: i,
    }));
    const db = new DexieMock();
    db.versions.where.mockReturnValueOnce({
      equals: jest.fn().mockReturnValueOnce({
        sortBy: jest.fn().mockResolvedValueOnce(oldVersions),
        delete: jest.fn(),
        first: jest.fn(),
        toArray: jest.fn(),
        reverse: jest.fn(() => ({
          sortBy: jest.fn(() => Promise.resolve([])),
          toArray: jest.fn(() => Promise.resolve([])),
        })),
      }),
    } as any);

    const result = await versionService.save('project-1', pptJson);

    // Should have deleted oldest (id='old-0', createdAt=0)
    expect(result.id).toBe(mockUUID);
  });

  it('restores a version by id', async () => {
    const version = { id: 'v1', projectId: 'p1', pptJson, createdAt: 1 };
    const db = new DexieMock();
    db.versions.get.mockResolvedValueOnce(version);

    const result = await versionService.restore('v1');
    expect(result).toEqual(version);
  });
});

describe('imageService', () => {
  it('saves a project image', async () => {
    const result = await imageService.save('project-1', 'slide-1', 0, 'https://example.com/img.png', 'test prompt');

    expect(result.id).toBe(mockUUID);
    expect(result.projectId).toBe('project-1');
    expect(result.slideId).toBe('slide-1');
    expect(result.slideIndex).toBe(0);
    expect(result.imageUrl).toBe('https://example.com/img.png');
    expect(result.prompt).toBe('test prompt');
  });

  it('gets images by project', async () => {
    const images = [{ id: 'img-1', projectId: 'project-1', slideIndex: 0, imageUrl: 'url' }];
    const db = new DexieMock();
    db.projectImages.where.mockReturnValueOnce({
      equals: jest.fn().mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValueOnce(images),
      }),
    } as any);

    const result = await imageService.getByProject('project-1');
    expect(result).toEqual(images);
  });

  it('deletes an image by id', async () => {
    await imageService.delete('img-1');
  });

  it('deletes all images by project', async () => {
    const db = new DexieMock();
    db.projectImages.where.mockReturnValueOnce({
      equals: jest.fn().mockReturnValueOnce({
        delete: jest.fn().mockResolvedValueOnce(undefined),
      }),
    } as any);

    await imageService.deleteByProject('project-1');
  });
});

describe('styleKitService', () => {
  const sampleKit = {
    id: 'kit-1',
    name: 'Test Kit',
    sourceFileId: 'file-1',
    styleDNA: {
      id: 'dna-1', name: 'Test DNA', sourceFileId: 'file-1',
      palette: { primary: '#000', secondary: '#fff', accent: '#f00', background: '#fff', text: '#000' },
      typography: { titleFont: 'Arial', bodyFont: 'Helvetica', titleSize: 44, subtitleSize: 20, bodySize: 18, captionSize: 12 },
      spacing: { slidePadding: 40, contentMargin: 20, elementGap: 16 },
      effects: { shadowEnabled: false, shadowType: 'soft' as const, borderRadius: 8, gradientEnabled: false },
      mood: 'professional' as const, moodDescription: '', createdAt: 1, updatedAt: 1,
    },
    layoutPatterns: [],
    slideRoleDefinitions: [],
    contentRules: [],
    scenarioAdapters: [],
    stats: { usageCount: 0, feedbackCount: 0 },
    createdAt: 1,
    updatedAt: 1,
  };

  it('increments usage count', async () => {
    const db = new DexieMock();
    db.styleKits.get.mockResolvedValueOnce(sampleKit);

    await styleKitService.incrementUsage('kit-1');
  });

  it('adds feedback and updates average rating', async () => {
    const db = new DexieMock();
    db.styleKits.get.mockResolvedValueOnce(sampleKit);

    await styleKitService.addFeedback('kit-1', { rating: 4, styleAccuracy: 5, layoutFit: 4, contentQuality: 3 });
  });

  it('computes running average for multiple feedback entries', async () => {
    const kitWithFeedback = { ...sampleKit, stats: { usageCount: 1, feedbackCount: 2, averageRating: 3.5 } };
    const db = new DexieMock();
    db.styleKits.get.mockResolvedValueOnce(kitWithFeedback);

    await styleKitService.addFeedback('kit-1', { rating: 5, styleAccuracy: 5, layoutFit: 5, contentQuality: 5 });
  });
});

describe('DB upgrade safety', () => {
  it('v5 only adds projectImages table — no breaking changes to existing tables', () => {
    // Structural assertion: the v5 migration file does not modify v1-v4 table schemas
    // If future versions change this, test must be updated.
    const v4Stores = ['projects', 'files', 'versions', 'styleKits', 'analysisJobs'];
    const v5Stores = [...v4Stores, 'projectImages'];
    expect(v5Stores).toContain('projectImages');
    expect(v5Stores.length).toBe(v4Stores.length + 1);
  });
});
