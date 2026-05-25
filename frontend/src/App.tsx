import { Navigate, Route, Routes } from "react-router-dom";

import { useAuthStore } from "@/store/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { CommandPalette } from "@/components/CommandPalette";
import { FilePalette } from "@/components/FilePalette";
import { ShortcutsHelp } from "@/components/ShortcutsHelp";
import { Shell } from "@/components/workbench/Shell";
import { CenteredSpinner } from "@/components/ui/Skeleton";

import { AuthPage } from "@/pages/auth/AuthPage";
import { DashboardPage } from "@/pages/Dashboard";
import { NewProjectPage } from "@/pages/NewProject";
import { ProjectDetailPage } from "@/pages/ProjectDetail";
import { BuildDetailPage } from "@/pages/BuildDetail";
import { BuildComparePage } from "@/pages/BuildCompare";
import { SettingsPage } from "@/pages/Settings";

/** Redirect already-authenticated users away from auth pages. */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") {
    return (
      <div className="grid h-screen place-items-center bg-bg">
        <CenteredSpinner />
      </div>
    );
  }
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicOnly><AuthPage /></PublicOnly>}>
          <Route path="/login" />
          <Route path="/register" />
        </Route>

        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects/:id/builds/compare" element={<BuildComparePage />} />
          <Route path="/projects/:id/builds/:buildId" element={<BuildDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Palettes live above routes so they're available everywhere authed. */}
      <PaletteHost />
    </>
  );
}

/** Only mount the palette + shortcuts sheet when authenticated. */
function PaletteHost() {
  const status = useAuthStore((s) => s.status);
  if (status !== "authenticated") return null;
  return (
    <>
      <CommandPalette />
      <FilePalette />
      <ShortcutsHelp />
    </>
  );
}
