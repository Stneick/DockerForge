import { useNavigate } from 'react-router-dom';
import * as Ctx from '@radix-ui/react-context-menu';
import {
  SlidersHorizontal,
  BarChart3,
  Settings as SettingsIcon,
  ExternalLink,
} from 'lucide-react';

const itemCls =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text outline-none transition-colors data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan';

export const PROJECT_CONTEXT_VIEWS = [
  { tab: 'setup', label: 'Configuration', icon: SlidersHorizontal },
  { tab: 'stats', label: 'Statistics', icon: BarChart3 },
  { tab: 'settings', label: 'Settings', icon: SettingsIcon },
] as const;

export function ProjectContextMenu({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  const openTab = (tab: string) => {
    navigate(`/projects/${projectId}?tab=${tab}`);
  };

  return (
    <Ctx.Root>
      <Ctx.Trigger asChild>{children}</Ctx.Trigger>
      <Ctx.Portal>
        <Ctx.Content className="z-50 w-52 overflow-hidden rounded-lg border border-line2 bg-surface2 p-1 shadow-xl animate-fade-in">
          <Ctx.Item
            className={itemCls}
            onSelect={() => navigate(`/projects/${projectId}`)}
          >
            <ExternalLink className="h-4 w-4" />
            Open project
          </Ctx.Item>

          <Ctx.Separator className="my-1 h-px bg-line" />

          {PROJECT_CONTEXT_VIEWS.map(({ tab, label, icon: Icon }) => (
            <Ctx.Item key={tab} className={itemCls} onSelect={() => openTab(tab)}>
              <Icon className="h-4 w-4" />
              {label}
            </Ctx.Item>
          ))}
        </Ctx.Content>
      </Ctx.Portal>
    </Ctx.Root>
  );
}
