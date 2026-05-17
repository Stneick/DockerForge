import type { ReactNode } from 'react';

/** Explorer tree node — mirrors Unistream `TapFileTreeNode` shape. */
export interface ExplorerTreeNode {
  name: string;
  type: 'file' | 'directory';
  children?: ExplorerTreeNode[];
  /** Stable id for selection / expand (defaults to joined path segments). */
  id?: string;
  /** Override default file/folder icon. */
  icon?: ReactNode;
  /** Trailing adornment (e.g. build status). */
  trailing?: ReactNode;
  /** Navigation / actions (see `buildExplorerTree`). */
  meta?: unknown;
}

export function normalizeTreeChildren(
  children: ExplorerTreeNode['children'],
): ExplorerTreeNode[] {
  if (!children || !Array.isArray(children)) return [];
  return children;
}
