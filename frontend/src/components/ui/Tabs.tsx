import * as RT from "@radix-ui/react-tabs";

import { cn } from "@/lib/cn";

export const Tabs = RT.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RT.List>) {
  return (
    <RT.List
      className={cn("flex items-center gap-1 border-b border-line bg-bg2 px-2", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RT.Trigger>) {
  return (
    <RT.Trigger
      className={cn(
        "relative -mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted transition-colors",
        "hover:text-text data-[state=active]:border-cyan data-[state=active]:text-text",
        "focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof RT.Content>) {
  return (
    <RT.Content
      className={cn("focus-visible:outline-none data-[state=active]:animate-fade-in", className)}
      {...props}
    />
  );
}
