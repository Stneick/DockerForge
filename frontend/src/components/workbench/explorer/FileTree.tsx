import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';
import { getFileIcon, getFolderIcon } from './fileTreeIcons';
import { normalizeTreeChildren, type ExplorerTreeNode } from './types';

const INDENT_BASE = 10;
const INDENT_STEP = 16;

const isChildLevel = (level: number) => level > 0;

const rowClass = (isSelected: boolean, isDir: boolean, level: number) =>
  cn(
    'flex w-full min-w-0 cursor-pointer items-center truncate rounded-md pr-2.5 text-left transition-colors',
    isChildLevel(level)
      ? 'min-h-[28px] gap-1.5 py-1.5'
      : 'min-h-[32px] gap-2 py-2',
    isDir
      ? 'text-text hover:bg-surface2/80'
      : 'text-muted hover:bg-surface2/80 hover:text-text',
    isSelected && 'bg-cyan/10 text-cyan',
  );

const labelClass = (level: number) =>
  cn('truncate', isChildLevel(level) ? 'text-xs' : 'text-sm');

const chevronClass = (level: number) =>
  cn('shrink-0 text-dim', isChildLevel(level) ? 'h-3.5 w-3.5' : 'h-4 w-4');

const fileIconClass = (level: number) =>
  isChildLevel(level) ? 'size-3.5 shrink-0 text-cyan' : 'size-4 shrink-0 text-cyan';

const folderIconClass = (level: number) =>
  isChildLevel(level)
    ? 'size-3.5 shrink-0 text-docker'
    : 'size-4 shrink-0 text-docker';

function nodePath(basePath: string, name: string) {
  return basePath ? `${basePath}/${name}` : name;
}

function getAncestorPaths(selectedPath: string | null): Set<string> {
  if (!selectedPath) return new Set();
  const parts = selectedPath.split('/');
  const ancestors = new Set<string>();
  for (let i = 1; i < parts.length; i++) {
    ancestors.add(parts.slice(0, i).join('/'));
  }
  return ancestors;
}

interface TreeNodeProps {
  node: ExplorerTreeNode;
  basePath: string;
  level: number;
  selectedPath: string | null;
  onSelect: (path: string, node: ExplorerTreeNode) => void;
  openFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  wrapRow?: (node: ExplorerTreeNode, row: ReactNode) => ReactNode;
}

function TreeNode({
  node,
  basePath,
  level,
  selectedPath,
  onSelect,
  openFolders,
  onToggleFolder,
  wrapRow,
}: TreeNodeProps) {
  const children = normalizeTreeChildren(node.children);
  const path = node.id ?? nodePath(basePath, node.name);
  const isDir = node.type === 'directory' || children.length > 0;
  const isOpen = openFolders.has(path);
  const isSelected = selectedPath === path;
  const indentPx = INDENT_BASE + level * INDENT_STEP;

  const handleActivate = () => {
    if (isDir) onToggleFolder(path);
    else onSelect(path, node);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  if (isDir) {
    const folderRow = (
      <div
        role="button"
        tabIndex={0}
        className={rowClass(isSelected, true, level)}
        style={{ paddingLeft: indentPx }}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
      >
        {isOpen ? (
          <ChevronDown className={chevronClass(level)} />
        ) : (
          <ChevronRight className={chevronClass(level)} />
        )}
        {node.icon ?? getFolderIcon(folderIconClass(level))}
        <span className={labelClass(level)}>{node.name}</span>
        {node.trailing}
      </div>
    );

    return (
      <div className="select-none">
        {wrapRow ? wrapRow(node, folderRow) : folderRow}
        {isOpen && children.length > 0 && (
          <div>
            {children.map((child, i) => (
              <TreeNode
                key={child.id ?? `${path}-${child.name}-${i}`}
                node={child}
                basePath={path}
                level={level + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                openFolders={openFolders}
                onToggleFolder={onToggleFolder}
                wrapRow={wrapRow}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const row = (
    <div
      role="button"
      tabIndex={0}
      className={rowClass(isSelected, false, level)}
      style={{ paddingLeft: 6 + level * INDENT_STEP }}
      onClick={() => onSelect(path, node)}
      onKeyDown={handleKeyDown}
    >
      <span
        className={cn('shrink-0', isChildLevel(level) ? 'w-3.5' : 'w-4')}
        aria-hidden
      />
      {node.icon ?? getFileIcon(node.name, fileIconClass(level))}
      <span className={cn('flex-1', labelClass(level))}>{node.name}</span>
      {node.trailing}
    </div>
  );

  return wrapRow ? <>{wrapRow(node, row)}</> : row;
}

export interface FileTreeProps {
  tree: ExplorerTreeNode[];
  selectedPath: string | null;
  onSelect: (path: string, node: ExplorerTreeNode) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  wrapRow?: (node: ExplorerTreeNode, row: ReactNode) => ReactNode;
}

export function FileTree({
  tree,
  selectedPath,
  onSelect,
  isLoading,
  emptyMessage = 'Nothing here yet',
  className,
  wrapRow,
}: FileTreeProps) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(() =>
    getAncestorPaths(selectedPath),
  );
  const initialExpandDone = useRef(false);

  useEffect(() => {
    if (!initialExpandDone.current && selectedPath) {
      initialExpandDone.current = true;
      setOpenFolders(getAncestorPaths(selectedPath));
    }
  }, [selectedPath]);

  useEffect(() => {
    if (selectedPath) {
      setOpenFolders((prev) => {
        const next = new Set(prev);
        for (const p of getAncestorPaths(selectedPath)) next.add(p);
        return next;
      });
    }
  }, [selectedPath]);

  const toggleFolder = useCallback((path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center py-8 text-sm text-dim',
          className,
        )}
      >
        Loading…
      </div>
    );
  }

  if (!tree.length) {
    return (
      <div
        className={cn(
          'flex cursor-default select-none items-center justify-center py-8 text-center text-sm text-dim',
          className,
        )}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col gap-0.5 overflow-auto py-2', className)}>
      {tree.map((node, i) => (
        <TreeNode
          key={node.id ?? `${node.name}-${i}`}
          node={node}
          basePath=""
          level={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          openFolders={openFolders}
          onToggleFolder={toggleFolder}
          wrapRow={wrapRow}
        />
      ))}
    </div>
  );
}
