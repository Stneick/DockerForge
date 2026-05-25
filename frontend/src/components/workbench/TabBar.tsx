import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {
    DndContext,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import {
    SortableContext,
    arrayMove,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    X,
    LogOut,
    Settings,
    User as UserIcon,
    PanelLeft,
    PanelBottom,
    PanelRight,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { useTabsStore } from '@/store/tabs';
import { useAuthStore } from '@/store/auth';
import { useLayout } from '@/store/layout';
import { useFilePalette } from '@/components/FilePalette';
import { MOD_KEY, formatShortcut } from '@/lib/keyboard';
import { Tooltip } from '@/components/ui/Tooltip';
import { LogoBadge, Wordmark } from '@/components/Logo';
import { StatusDot } from '@/components/ui/Badge';
import type { BuildStatus } from '@/types/api';
import type { WorkbenchTab } from '@/store/tabs';
import { SortableWorkbenchTab } from './SortableWorkbenchTab';

function isDashboardTab(tab: WorkbenchTab) {
    return tab.kind === 'dashboard' || tab.id === '/';
}

function tabIsLocked(tab: WorkbenchTab) {
    return isDashboardTab(tab) || !!tab.pinned;
}

const tabClassBase =
    'group flex h-7 min-w-0 items-center gap-2 overflow-hidden rounded-md border px-2.5 text-[13px] font-medium transition-colors';

function tabClassActive(isActive: boolean) {
    return cn(
        tabClassBase,
        isActive
            ? 'border-line2 bg-surface2 text-text shadow-[inset_0_1px_0_rgb(var(--text)/0.04)]'
            : 'border-line2/70 bg-transparent text-muted hover:border-line2 hover:bg-surface/40 hover:text-text',
    );
}

export function TabBar() {
    const tabs = useTabsStore((s) => s.tabs);
    const activeId = useTabsStore((s) => s.activeId);
    const setActive = useTabsStore((s) => s.setActive);
    const closeTab = useTabsStore((s) => s.closeTab);
    const reorderSortableTabs = useTabsStore((s) => s.reorderSortableTabs);
    const navigate = useNavigate();
    const location = useLocation();
    const setFilePaletteOpen = useFilePalette((s) => s.setOpen);
    const explorerOpen = useLayout((s) => s.explorerOpen);
    const explorerWidth = useLayout((s) => s.explorerWidth);

    const sortableTabIds = useMemo(
        () => tabs.filter((t) => !tabIsLocked(t)).map((t) => t.id),
        [tabs],
    );

    const tabSensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    );

    // Keep the active tab in sync with the current URL.
    const path = location.pathname + location.search;
    useEffect(() => {
        const match = tabs.find((t) => t.id === path || t.path === path);
        if (match && match.id !== activeId) setActive(match.id);
    }, [path, tabs, activeId, setActive]);

    const onClose = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const next = closeTab(id);
        if (next) navigate(next);
        else if (id === activeId) navigate('/');
    };

    const handleTabDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;

            const currentOrder = sortableTabIds;
            const oldIndex = currentOrder.indexOf(String(active.id));
            const newIndex = currentOrder.indexOf(String(over.id));
            if (oldIndex < 0 || newIndex < 0) return;

            reorderSortableTabs(arrayMove(currentOrder, oldIndex, newIndex));
        },
        [reorderSortableTabs, sortableTabIds],
    );

    const renderTab = (tab: WorkbenchTab) => {
        const isActive = tab.id === activeId;
        const locked = tabIsLocked(tab);

        const content = (
            <>
                {tab.status ? (
                    <StatusDot status={tab.status as BuildStatus} />
                ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line2" />
                )}
                <span className="truncate">{tab.title}</span>
                {!tab.pinned && (
                    <span
                        role="presentation"
                        data-tab-close
                        onClick={(e) => onClose(e, tab.id)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={cn(
                            'grid h-4 w-4 shrink-0 place-items-center rounded text-dim transition-colors hover:bg-line2 hover:text-text',
                            isActive
                                ? 'text-muted'
                                : 'opacity-70 group-hover:opacity-100',
                        )}
                    >
                        <X className="h-3 w-3" />
                    </span>
                )}
            </>
        );

        if (locked) {
            return (
                <button
                    key={tab.id}
                    type="button"
                    data-tab-chip
                    onClick={() => {
                        setActive(tab.id);
                        navigate(tab.path);
                    }}
                    className={cn(tabClassActive(isActive), 'max-w-[220px] shrink-0 cursor-pointer')}
                >
                    {content}
                </button>
            );
        }

        return (
            <SortableWorkbenchTab
                key={tab.id}
                id={tab.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActive(tab.id);
                        navigate(tab.path);
                    }
                }}
                onClick={() => {
                    setActive(tab.id);
                    navigate(tab.path);
                }}
                className={tabClassActive(isActive)}
            >
                {content}
            </SortableWorkbenchTab>
        );
    };

    return (
        <div className="flex h-[42px] shrink-0 items-center border-b border-line bg-chrome">
            <button
                type="button"
                onClick={() => navigate('/')}
                title="DockerForge — Dashboard"
                className={cn(
                    'flex h-full shrink-0 items-center gap-2.5 border-r border-line transition-colors hover:bg-surface2',
                    explorerOpen ? 'px-3' : 'w-[42px] justify-center',
                )}
                style={explorerOpen ? { width: explorerWidth } : undefined}
            >
                <LogoBadge className="h-7 w-7 shrink-0 shadow-none" />
                {explorerOpen && (
                    <span className="min-w-0 truncate text-left">
                        <Wordmark />
                    </span>
                )}
            </button>

            <DndContext
                sensors={tabSensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToHorizontalAxis]}
                onDragEnd={handleTabDragEnd}
            >
                <SortableContext
                    items={sortableTabIds}
                    strategy={horizontalListSortingStrategy}
                >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 py-1.5">
                        {tabs.map((tab) => renderTab(tab))}
                    </div>
                </SortableContext>
            </DndContext>

            <div className="flex h-full shrink-0 items-center gap-2 border-l border-line px-2.5">
                <LayoutToggles />
                <button
                    type="button"
                    onClick={() => setFilePaletteOpen(true)}
                    className="hidden items-center gap-1.5 rounded-md border border-line2 bg-bg2 px-2 py-1 font-mono text-2xs text-dim transition-colors hover:text-text md:flex"
                >
                    <span className="text-cyan">{formatShortcut(MOD_KEY, "P")}</span>
                    quick open
                </button>
                <UserMenu />
            </div>
        </div>
    );
}

function LayoutToggles() {
    const {
        explorerOpen,
        dockOpen,
        inspectorOpen,
        toggleExplorer,
        toggleDock,
        toggleInspector,
    } = useLayout();
    const btn = (
        active: boolean,
        onClick: () => void,
        icon: React.ReactNode,
        label: string,
    ) => (
        <Tooltip content={label}>
            <button
                onClick={onClick}
                className={cn(
                    'grid h-6 w-6 place-items-center rounded transition-colors',
                    active ? 'text-cyan' : 'text-dim hover:text-muted',
                )}
            >
                {icon}
            </button>
        </Tooltip>
    );
    return (
        <div className="hidden items-center gap-0.5 sm:flex">
            {btn(
                explorerOpen,
                toggleExplorer,
                <PanelLeft className="h-3.5 w-3.5" />,
                'Toggle Explorer',
            )}
            {btn(
                dockOpen,
                toggleDock,
                <PanelBottom className="h-3.5 w-3.5" />,
                'Toggle Panel',
            )}
            {btn(
                inspectorOpen,
                toggleInspector,
                <PanelRight className="h-3.5 w-3.5" />,
                'Toggle Inspector',
            )}
        </div>
    );
}

function UserMenu() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const navigate = useNavigate();
    const initial = (user?.username || user?.email || '?')
        .charAt(0)
        .toUpperCase();

    return (
        <Dropdown.Root>
            <Dropdown.Trigger asChild>
                <button className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-docker to-cyan-dim text-xs font-bold text-white outline-none ring-cyan/50 focus-visible:ring-2">
                    {initial}
                </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
                <Dropdown.Content
                    align="end"
                    sideOffset={8}
                    className="z-50 w-56 overflow-hidden rounded-lg border border-line2 bg-surface2 p-1 shadow-xl animate-fade-in"
                >
                    <div className="px-2.5 py-2">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <UserIcon className="h-3.5 w-3.5 text-cyan" />
                            {user?.username}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-2xs text-dim">
                            {user?.email}
                        </div>
                    </div>
                    <Dropdown.Separator className="my-1 h-px bg-line" />
                    <MenuItem
                        onSelect={() => navigate('/settings')}
                        icon={<Settings className="h-4 w-4" />}
                    >
                        Settings
                    </MenuItem>
                    <MenuItem
                        onSelect={() =>
                            void logout().then(() =>
                                navigate('/login', { replace: true }),
                            )
                        }
                        icon={<LogOut className="h-4 w-4" />}
                        tone="danger"
                    >
                        Sign out
                    </MenuItem>
                </Dropdown.Content>
            </Dropdown.Portal>
        </Dropdown.Root>
    );
}

function MenuItem({
    children,
    icon,
    onSelect,
    tone,
}: {
    children: React.ReactNode;
    icon: React.ReactNode;
    onSelect: () => void;
    tone?: 'danger';
}) {
    return (
        <Dropdown.Item
            onSelect={onSelect}
            className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors',
                tone === 'danger'
                    ? 'text-fail data-[highlighted]:bg-fail/10'
                    : 'text-text data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan',
            )}
        >
            {icon}
            {children}
        </Dropdown.Item>
    );
}
