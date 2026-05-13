import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/store/auth";
import { CenteredSpinner } from "@/components/ui/Skeleton";

/** Gate for authenticated routes. Waits for session bootstrap, then redirects
 *  unauthenticated users to /login (preserving where they were headed). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid h-screen place-items-center bg-bg">
        <CenteredSpinner label="restoring session…" />
      </div>
    );
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
