import type { ReactNode } from 'react';
import { FileCode2, FileX2, Layers } from 'lucide-react';

import { StatusDot } from '@/components/ui/Badge';
import { shortId, timeAgo } from '@/lib/format';
import type { Build, Project } from '@/types/api';
import type { ExplorerTreeNode } from './types';

const PROJECT_FILES: {
  id: string;
  name: string;
  tab: string;
  ignore?: boolean;
  icon: ReactNode;
}[] = [
  { id: 'dockerfile', name: 'Dockerfile', tab: 'dockerfile', icon: <FileCode2 className="h-3.5 w-3.5" /> },
  {
    id: 'dockerignore',
    name: '.dockerignore',
    tab: 'dockerfile',
    ignore: true,
    icon: <FileX2 className="h-3.5 w-3.5" />,
  },
];

/** Tabs shown on project right-click (not listed in the tree). */
export const PROJECT_CONTEXT_TAB_IDS = ['setup', 'stats', 'settings'] as const;

export type ExplorerNodeMeta =
  | { kind: 'project'; projectId: string }
  | { kind: 'project-file'; projectId: string; tab: string; file?: string }
  | { kind: 'builds'; projectId: string }
  | { kind: 'build'; projectId: string; buildId: string; build: Build };

export type ExplorerTreeNodeWithMeta = ExplorerTreeNode & { meta?: ExplorerNodeMeta };

export function buildProjectTree(
  project: Project,
  builds: Build[] | undefined,
  buildLabel: (id: string) => string | undefined,
): ExplorerTreeNodeWithMeta {
  const rootId = `project/${project.id}`;

  const fileChildren: ExplorerTreeNodeWithMeta[] = PROJECT_FILES.map((f) => ({
    id: `${rootId}/${f.id}`,
    name: f.name,
    type: 'file' as const,
    icon: f.icon,
    meta: {
      kind: 'project-file' as const,
      projectId: project.id,
      tab: f.tab,
      ...(f.ignore ? { file: 'dockerignore' } : {}),
    },
  }));

  const buildChildren: ExplorerTreeNodeWithMeta[] =
    builds === undefined
      ? []
      : builds.length === 0
        ? [
            {
              id: `${rootId}/builds/empty`,
              name: 'no builds',
              type: 'file' as const,
              meta: { kind: 'builds', projectId: project.id },
            },
          ]
        : builds.map((b) => ({
            id: `${rootId}/builds/${b.id}`,
            name: buildLabel(b.id) ?? shortId(b.id),
            type: 'file' as const,
            icon: <StatusDot status={b.status} />,
            trailing: (
              <span className="ml-auto shrink-0 font-mono text-xs text-dim">
                {timeAgo(b.created_at)}
              </span>
            ),
            meta: {
              kind: 'build',
              projectId: project.id,
              buildId: b.id,
              build: b,
            },
          }));

  return {
    id: rootId,
    name: project.name,
    type: 'directory',
    meta: { kind: 'project', projectId: project.id },
    children: [
      ...fileChildren,
      {
        id: `${rootId}/builds`,
        name: 'builds',
        type: 'directory',
        icon: <Layers className="h-3.5 w-3.5 shrink-0 text-dim" />,
        meta: { kind: 'builds', projectId: project.id },
        children: buildChildren,
      },
    ],
  };
}

/** Map URL + projects to the selected tree path. */
export function explorerPathFromLocation(
  pathname: string,
  search: string,
  projects: Project[],
): string | null {
  const m = pathname.match(/^\/projects\/([^/]+)(?:\/builds\/([^/]+))?$/);
  if (!m) return pathname === '/' ? null : null;
  const [, projectId, buildId] = m;
  if (!projects.some((p) => p.id === projectId)) return `project/${projectId}`;

  const root = `project/${projectId}`;
  if (buildId) return `${root}/builds/${buildId}`;

  const params = new URLSearchParams(search);
  const tab = params.get('tab') ?? 'dockerfile';
  const file = params.get('file');
  if (tab === 'builds') return `${root}/builds`;
  if (file === 'dockerignore') return `${root}/dockerignore`;
  const fileNode = PROJECT_FILES.find((f) => f.tab === tab && !f.ignore);
  if (fileNode) return `${root}/${fileNode.id}`;
  if (
    (PROJECT_CONTEXT_TAB_IDS as readonly string[]).includes(tab)
  ) {
    return root;
  }
  return root;
}

export function navigateForTreeNode(
  meta: ExplorerNodeMeta | undefined,
  navigate: (path: string) => void,
) {
  if (!meta) return;
  switch (meta.kind) {
    case 'project':
      navigate(`/projects/${meta.projectId}`);
      break;
    case 'project-file': {
      const q = new URLSearchParams({ tab: meta.tab });
      if (meta.file) q.set('file', meta.file);
      navigate(`/projects/${meta.projectId}?${q}`);
      break;
    }
    case 'builds':
      navigate(`/projects/${meta.projectId}?tab=builds`);
      break;
    case 'build':
      navigate(`/projects/${meta.projectId}/builds/${meta.buildId}`);
      break;
  }
}
