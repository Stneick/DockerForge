import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  Search,
  LayoutDashboard,
  FolderGit2,
} from 'lucide-react';

import { useBuilds, useProject, useProjects } from '@/api/hooks';
import { useBuildNumbers } from '@/hooks/useBuildNumbers';
import { cn } from '@/lib/cn';
import { useCommandPalette } from '@/components/CommandPalette';
import { BuildContextMenu } from '@/components/build/BuildContextMenu';
import { ProjectContextMenu } from '@/components/workbench/explorer/ProjectContextMenu';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLayout } from '@/store/layout';
import {
  FileTree,
  buildProjectTree,
  explorerPathFromLocation,
  navigateForTreeNode,
  type ExplorerNodeMeta,
} from './explorer/index';
import type { ExplorerTreeNode } from './explorer/types';

export function Explorer() {
  const explorerWidth = useLayout((s) => s.explorerWidth);
  const { data, isLoading } = useProjects({ per_page: 50, sort_by: 'updated_at' });
  const setPaletteOpen = useCommandPalette((s) => s.setOpen);
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeProjectId } = useParams();

  const buildNumbers = useBuildNumbers(activeProjectId ?? '');
  const { data: buildsData } = useBuilds(
    activeProjectId ?? '',
    { per_page: 8 },
    { enabled: !!activeProjectId },
  );

  const selectedPath = useMemo(
    () =>
      explorerPathFromLocation(
        location.pathname,
        location.search,
        data?.items ?? [],
      ),
    [location.pathname, location.search, data?.items],
  );

  const tree = useMemo(() => {
    if (!data?.items.length) return [];
    return data.items.map((project) => {
      const builds =
        project.id === activeProjectId ? buildsData?.items : undefined;
      return buildProjectTree(
        project,
        builds,
        (id: string) =>
          project.id === activeProjectId
            ? (buildNumbers.label(id) ?? undefined)
            : undefined,
      );
    });
  }, [data?.items, activeProjectId, buildsData?.items, buildNumbers]);

  const handleSelect = (_path: string, node: ExplorerTreeNode) => {
    const meta = node.meta as ExplorerNodeMeta | undefined;
    if (node.id?.endsWith('/empty')) return;
    navigateForTreeNode(meta, navigate);
  };

  return (
    <aside
      className="flex shrink-0 flex-col border-r border-line bg-chrome"
      style={{ width: explorerWidth }}
    >
      <button
        onClick={() => setPaletteOpen(true)}
        className="m-2 flex items-center gap-2 rounded-lg border border-line2 bg-bg2 px-2.5 py-1.5 text-xs text-dim transition-colors hover:border-cyan-dim"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="font-mono text-2xs text-cyan">⌘K</kbd>
      </button>

      <nav className="px-2 pb-1">
        <NavRow
          to="/"
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Dashboard"
          active={location.pathname === '/'}
        />
      </nav>

      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="label-mono">Explorer</span>
        <button
          onClick={() => navigate('/projects/new')}
          className="rounded p-0.5 text-dim transition-colors hover:bg-surface2 hover:text-cyan"
          title="New project"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 px-1.5 pb-3">
        {isLoading ? (
          <div className="space-y-1.5 px-1 py-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <FileTree
            tree={tree}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            emptyMessage="No projects yet"
            className="px-0.5"
            wrapRow={(node, row) => {
              const meta = node.meta as ExplorerNodeMeta | undefined;
              if (meta?.kind === 'project') {
                return (
                  <ProjectContextMenu projectId={meta.projectId}>
                    {row}
                  </ProjectContextMenu>
                );
              }
              if (meta?.kind === 'build') {
                return (
                  <BuildContextMenu
                    projectId={meta.projectId}
                    build={meta.build}
                  >
                    {row}
                  </BuildContextMenu>
                );
              }
              return row;
            }}
          />
        ) : (
          <button
            onClick={() => navigate('/projects/new')}
            className="mt-2 flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-line2 px-3 py-5 text-center text-xs text-dim transition-colors hover:border-cyan-dim hover:text-muted"
          >
            <FolderGit2 className="h-5 w-5" />
            No projects yet
            <span className="text-cyan">Create one →</span>
          </button>
        )}
      </div>

      {activeProjectId && <SourceFooter projectId={activeProjectId} />}
    </aside>
  );
}

function NavRow({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
        active ? 'bg-cyan/10 text-cyan' : 'text-muted hover:bg-surface2 hover:text-text',
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SourceFooter({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId, { enabled: !!projectId });
  if (!project) return null;
  const hasSource = project.source_uploaded || project.source_type !== 'none';
  return (
    <div className="border-t border-line px-3.5 py-3">
      <div className="label-mono mb-2">Source · detected</div>
      <div className="space-y-1 font-mono text-2xs">
        <Row k="src" v={project.source_type} />
        <Row k="lang" v={project.language ?? '—'} accent={!!project.language} />
        <Row k="fw" v={project.framework ?? '—'} accent={!!project.framework} />
        <Row k="deps" v={project.dependency_file ?? '—'} />
        {!hasSource && <div className="pt-1 text-warn">⚠ no source yet</div>}
      </div>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-9 shrink-0 text-dim">{k}</span>
      <span className={cn('truncate', accent ? 'text-cyan' : 'text-muted')}>{v}</span>
    </div>
  );
}
