import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
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
    ChevronsRight,
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

function tabIsLocked(tab: WorkbenchTab) {
    return !!tab.pinned;
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

const TAB_GAP_PX = 6;
const OVERFLOW_BTN_PX = 28;
const TAB_STRIP_PAD_X = 16;

function computeTabSplit(
    tabs: WorkbenchTab[],
    widths: number[],
    availableWidth: number,
    activeId: string | null,
): { visible: WorkbenchTab[]; overflow: WorkbenchTab[] } {
    if (tabs.length === 0) return { visible: [], overflow: [] };

    const totalWidth = widths.reduce(
        (sum, w, i) => sum + w + (i > 0 ? TAB_GAP_PX : 0),
        0,
    );
    if (totalWidth <= availableWidth) {
        return { visible: tabs, overflow: [] };
    }

    const budget = availableWidth - OVERFLOW_BTN_PX - TAB_GAP_PX;
    let count = 0;
    let used = 0;
    for (let i = 0; i < tabs.length; i++) {
        const w = widths[i] + (count > 0 ? TAB_GAP_PX : 0);
        if (used + w <= budget) {
            used += w;
            count++;
        } else {
            break;
        }
    }
    if (count === 0) count = 1;

    let visible = tabs.slice(0, count);
    const activeIndex = activeId
        ? tabs.findIndex((t) => t.id === activeId)
        : -1;
    if (activeIndex >= count && count > 0) {
        visible = [...visible.slice(0, -1), tabs[activeIndex]];
    }

    const visibleIds = new Set(visible.map((t) => t.id));
    const overflow = tabs.filter((t) => !visibleIds.has(t.id));
    return { visible, overflow };
}

function tabSplitEqual(
    a: { visible: WorkbenchTab[]; overflow: WorkbenchTab[] },
    b: { visible: WorkbenchTab[]; overflow: WorkbenchTab[] },
): boolean {
    if (
        a.visible.length !== b.visible.length ||
        a.overflow.length !== b.overflow.length
    ) {
        return false;
    }
    return (
        a.visible.every((t, i) => t.id === b.visible[i]?.id) &&
        a.overflow.every((t, i) => t.id === b.overflow[i]?.id)
    );
}

function TabChipLabel({
    tab,
    isActive,
    onClose,
}: {
    tab: WorkbenchTab;
    isActive: boolean;
    onClose?: (e: React.MouseEvent) => void;
}) {
    return (
        <>
            {tab.status ? (
                <StatusDot status={tab.status as BuildStatus} />
            ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line2" />
            )}
            <span className="truncate">{tab.title}</span>
            {!tab.pinned && onClose && (
                <span
                    role="presentation"
                    data-tab-close
                    onClick={onClose}
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
}

export function TabBar() {
    const allTabs = useTabsStore((s) => s.tabs);
    const tabs = useMemo(
        () =>
            allTabs.filter(
                (t) => t.kind !== 'dashboard' && t.kind !== 'settings',
            ),
        [allTabs],
    );
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

    const barRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLButtonElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const tabAreaRef = useRef<HTMLDivElement>(null);
    const tabListRef = useRef<HTMLDivElement>(null);
    const measureRefs = useRef(new Map<string, HTMLDivElement>());
    const tabsRef = useRef(tabs);
    const activeIdRef = useRef(activeId);
    tabsRef.current = tabs;
    activeIdRef.current = activeId;

    const [tabSplit, setTabSplit] = useState<{
        visible: WorkbenchTab[];
        overflow: WorkbenchTab[];
    }>(() => ({ visible: tabs, overflow: [] }));

    const getTabStripBudget = useCallback(() => {
        const bar = barRef.current;
        if (!bar) return 0;
        const logoW = logoRef.current?.getBoundingClientRect().width ?? 0;
        const actionsW = actionsRef.current?.getBoundingClientRect().width ?? 0;
        return Math.max(
            0,
            bar.getBoundingClientRect().width - logoW - actionsW - TAB_STRIP_PAD_X,
        );
    }, []);

    const remeasureTabs = useCallback(() => {
        const currentTabs = tabsRef.current;
        const currentActiveId = activeIdRef.current;

        if (currentTabs.length === 0) {
            setTabSplit((prev) => {
                const next = { visible: currentTabs, overflow: [] as WorkbenchTab[] };
                return tabSplitEqual(prev, next) ? prev : next;
            });
            return;
        }

        const available = getTabStripBudget();
        const listWidth = tabListRef.current?.clientWidth ?? 0;
        const budget =
            listWidth > 0 ? Math.min(available, listWidth) : available;
        const widths = currentTabs.map(
            (t) => measureRefs.current.get(t.id)?.offsetWidth ?? 220,
        );
        const next = computeTabSplit(
            currentTabs,
            widths,
            budget,
            currentActiveId,
        );

        setTabSplit((prev) => (tabSplitEqual(prev, next) ? prev : next));
    }, [getTabStripBudget]);

    const tabMeasureKey = useMemo(
        () =>
            tabs
                .map(
                    (t) =>
                        `${t.id}\t${t.title}\t${t.pinned ? 1 : 0}\t${t.status ?? ''}`,
                )
                .join('\n'),
        [tabs],
    );

    const visibleKey = useMemo(
        () => tabSplit.visible.map((t) => t.id).join('\0'),
        [tabSplit.visible],
    );

    useLayoutEffect(() => {
        remeasureTabs();
        const bar = barRef.current;
        if (!bar) return;
        const ro = new ResizeObserver(remeasureTabs);
        ro.observe(bar);
        return () => ro.disconnect();
    }, [remeasureTabs, tabMeasureKey, activeId, explorerWidth, explorerOpen]);

    useLayoutEffect(() => {
        const list = tabListRef.current;
        if (!list || list.scrollWidth <= list.clientWidth + 1) return;

        setTabSplit((prev) => {
            if (prev.visible.length <= 1) return prev;

            const currentTabs = tabsRef.current;
            const currentActiveId = activeIdRef.current;
            let visible = [...prev.visible];

            const dropIdx =
                visible[visible.length - 1]?.id === currentActiveId
                    ? visible.length - 2
                    : visible.length - 1;
            if (dropIdx < 0) return prev;

            visible = visible.filter((_, i) => i !== dropIdx);

            if (
                currentActiveId &&
                !visible.some((t) => t.id === currentActiveId)
            ) {
                const activeTab = currentTabs.find(
                    (t) => t.id === currentActiveId,
                );
                if (activeTab) {
                    visible = [...visible.slice(0, -1), activeTab];
                }
            }

            const visibleIds = new Set(visible.map((t) => t.id));
            const next = {
                visible,
                overflow: currentTabs.filter((t) => !visibleIds.has(t.id)),
            };
            return tabSplitEqual(prev, next) ? prev : next;
        });
    }, [visibleKey, tabMeasureKey, explorerWidth, explorerOpen]);

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
            <TabChipLabel tab={tab} isActive={isActive} onClose={(e) => onClose(e, tab.id)} />
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

    const visibleSortableIds = useMemo(
        () =>
            tabSplit.visible
                .filter((t) => !tabIsLocked(t))
                .map((t) => t.id),
        [tabSplit.visible],
    );

    const hiddenTabs = useMemo(() => {
        const visibleIds = new Set(tabSplit.visible.map((t) => t.id));
        return tabs.filter((t) => !visibleIds.has(t.id));
    }, [tabs, tabSplit.visible]);

    return (
        <div
            ref={barRef}
            className="flex h-[42px] w-full min-w-0 shrink-0 items-center overflow-hidden border-b border-line bg-chrome"
        >
            <div
                className="pointer-events-none fixed -left-[9999px] top-0 flex gap-1.5 opacity-0"
                aria-hidden
            >
                {tabs.map((tab) => (
                    <div
                        key={`measure-${tab.id}`}
                        ref={(el) => {
                            if (el) {
                                measureRefs.current.set(tab.id, el);
                            } else {
                                measureRefs.current.delete(tab.id);
                            }
                        }}
                        className={cn(
                            tabClassActive(false),
                            'inline-flex max-w-[220px] shrink-0',
                        )}
                    >
                        <TabChipLabel tab={tab} isActive={false} />
                    </div>
                ))}
            </div>

            <button
                ref={logoRef}
                type="button"
                onClick={() => navigate('/')}
                title="DockerForge"
                className={cn(
                    'flex h-full shrink-0 items-center gap-2.5 border-r border-line transition-colors hover:bg-surface2',
                    explorerOpen ? 'px-3' : 'w-[42px] justify-center',
                )}
                style={explorerOpen ? { width: explorerWidth } : undefined}
            >
                <LogoBadge crop="icon" className="shadow-none" />
                {explorerOpen && (
                    <span className="shrink-0 leading-none">
                        <Wordmark />
                    </span>
                )}
            </button>

            <div className="flex w-0 min-w-0 flex-1 overflow-hidden">
                <DndContext
                    sensors={tabSensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToHorizontalAxis]}
                    onDragEnd={handleTabDragEnd}
                >
                    <SortableContext
                        items={visibleSortableIds}
                        strategy={horizontalListSortingStrategy}
                    >
                        <div
                            ref={tabAreaRef}
                            className="relative flex w-0 min-w-0 flex-1 items-center gap-1.5 overflow-hidden px-2 py-1.5"
                        >
                            <div
                                ref={tabListRef}
                                className="flex w-0 min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
                            >
                                {tabSplit.visible.map((tab) => renderTab(tab))}
                            </div>
                            {hiddenTabs.length > 0 && (
                                <OverflowTabsMenu
                                    className="shrink-0"
                                    tabs={hiddenTabs}
                                    activeId={activeId}
                                    onSelect={(tab) => {
                                        setActive(tab.id);
                                        navigate(tab.path);
                                    }}
                                    onClose={onClose}
                                />
                            )}
                        </div>
                    </SortableContext>
                </DndContext>
            </div>

            <div
                ref={actionsRef}
                className="flex h-full shrink-0 items-center gap-2 border-l border-line px-2.5"
            >
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

function OverflowTabsMenu({
    tabs,
    activeId,
    onSelect,
    onClose,
    className,
}: {
    tabs: WorkbenchTab[];
    activeId: string | null;
    onSelect: (tab: WorkbenchTab) => void;
    onClose: (e: React.MouseEvent, id: string) => void;
    className?: string;
}) {
    return (
        <Dropdown.Root>
            <Dropdown.Trigger asChild>
                <button
                    type="button"
                    title="More tabs"
                    className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line2/70 text-dim transition-colors hover:border-line2 hover:bg-surface/40 hover:text-text',
                        className,
                    )}
                >
                    <ChevronsRight className="h-3.5 w-3.5" />
                </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
                <Dropdown.Content
                    align="start"
                    sideOffset={4}
                    className="z-50 max-h-64 min-w-[12rem] overflow-y-auto rounded-lg border border-line2 bg-surface2 p-1 shadow-xl animate-fade-in"
                >
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeId;
                        return (
                            <Dropdown.Item
                                key={tab.id}
                                onSelect={() => onSelect(tab)}
                                className={cn(
                                    'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none transition-colors',
                                    isActive
                                        ? 'bg-surface2 text-text'
                                        : 'text-muted data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan',
                                )}
                            >
                                {tab.status ? (
                                    <StatusDot
                                        status={tab.status as BuildStatus}
                                    />
                                ) : (
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line2" />
                                )}
                                <span className="min-w-0 flex-1 truncate">
                                    {tab.title}
                                </span>
                                {!tab.pinned && (
                                    <span
                                        role="presentation"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClose(e, tab.id);
                                        }}
                                        onPointerDown={(e) =>
                                            e.stopPropagation()
                                        }
                                        className="grid h-4 w-4 shrink-0 place-items-center rounded text-dim opacity-0 transition-opacity hover:bg-line2 hover:text-text group-data-[highlighted]:opacity-100"
                                    >
                                        <X className="h-3 w-3" />
                                    </span>
                                )}
                            </Dropdown.Item>
                        );
                    })}
                </Dropdown.Content>
            </Dropdown.Portal>
        </Dropdown.Root>
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
