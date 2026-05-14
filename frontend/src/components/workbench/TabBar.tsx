import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { X, LogOut, Settings, User as UserIcon, PanelLeft, PanelBottom, PanelRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { useTabsStore } from "@/store/tabs";
import { useAuthStore } from "@/store/auth";
import { useLayout } from "@/store/layout";
import { useCommandPalette } from "@/components/CommandPalette";
import { Tooltip } from "@/components/ui/Tooltip";
import { LogoBadge } from "@/components/Logo";
import { StatusDot } from "@/components/ui/Badge";
import type { BuildStatus } from "@/types/api";

export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  const navigate = useNavigate();
  const location = useLocation();
  const setPaletteOpen = useCommandPalette((s) => s.setOpen);

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
    else if (id === activeId) navigate("/");
  };

  return (
    <div className="flex h-[42px] shrink-0 items-stretch border-b border-line bg-chrome">
      <button
        onClick={() => navigate("/")}
        className="grid w-[42px] place-items-center border-r border-line transition-colors hover:bg-surface2"
        title="DockerForge"
      >
        <LogoBadge className="h-7 w-7 shadow-none" />
      </button>

      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActive(tab.id);
                navigate(tab.path);
              }}
              className={cn(
                "group relative flex max-w-[220px] items-center gap-2 border-r border-line px-3.5 text-[13px] transition-colors",
                isActive ? "bg-bg text-text" : "text-muted hover:bg-surface2/60",
              )}
            >
              {isActive && <span className="absolute inset-x-0 top-0 h-0.5 bg-cyan" />}
              {tab.status ? (
                <StatusDot status={tab.status as BuildStatus} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-line2" />
              )}
              <span className="truncate">{tab.title}</span>
              {!tab.pinned && (
                <span
                  onClick={(e) => onClose(e, tab.id)}
                  className="grid h-4 w-4 shrink-0 place-items-center rounded text-dim opacity-0 transition-all hover:bg-line2 hover:text-text group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-l border-line px-2.5">
        <LayoutToggles />
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden items-center gap-1.5 rounded-md border border-line2 bg-bg2 px-2 py-1 font-mono text-2xs text-dim transition-colors hover:border-cyan-dim md:flex"
        >
          <span className="text-cyan">⌘P</span> files
          <span className="mx-0.5 text-line2">·</span>
          <span className="text-cyan">⌘K</span> commands
        </button>
        <UserMenu />
      </div>
    </div>
  );
}

function LayoutToggles() {
  const { explorerOpen, dockOpen, inspectorOpen, toggleExplorer, toggleDock, toggleInspector } = useLayout();
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <Tooltip content={label}>
      <button
        onClick={onClick}
        className={cn(
          "grid h-6 w-6 place-items-center rounded transition-colors",
          active ? "text-cyan" : "text-dim hover:text-muted",
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
  return (
    <div className="hidden items-center gap-0.5 sm:flex">
      {btn(explorerOpen, toggleExplorer, <PanelLeft className="h-3.5 w-3.5" />, "Toggle Explorer")}
      {btn(dockOpen, toggleDock, <PanelBottom className="h-3.5 w-3.5" />, "Toggle Panel")}
      {btn(inspectorOpen, toggleInspector, <PanelRight className="h-3.5 w-3.5" />, "Toggle Inspector")}
    </div>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const initial = (user?.username || user?.email || "?").charAt(0).toUpperCase();

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
            <div className="mt-0.5 truncate font-mono text-2xs text-dim">{user?.email}</div>
          </div>
          <Dropdown.Separator className="my-1 h-px bg-line" />
          <MenuItem onSelect={() => navigate("/settings")} icon={<Settings className="h-4 w-4" />}>
            Settings
          </MenuItem>
          <MenuItem
            onSelect={() => void logout().then(() => navigate("/login", { replace: true }))}
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
  tone?: "danger";
}) {
  return (
    <Dropdown.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm outline-none transition-colors",
        tone === "danger"
          ? "text-fail data-[highlighted]:bg-fail/10"
          : "text-text data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan",
      )}
    >
      {icon}
      {children}
    </Dropdown.Item>
  );
}
