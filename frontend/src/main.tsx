import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { App } from "./App";
import { applyTheme, loadThemeId } from "@/lib/themes";

// Paint the saved theme's tokens before first render.
applyTheme(loadThemeId());
import { queryClient } from "@/lib/queryClient";
import { setHealthHandler, setUnauthorizedHandler } from "@/api/http";
import { useAuthStore } from "@/store/auth";
import { useHealthStore } from "@/store/health";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ToastViewport } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// When the http layer exhausts refresh attempts, clear auth so guards redirect
// to /login and cached queries stop showing stale private data.
setUnauthorizedHandler(() => {
  useAuthStore.getState().clear();
  queryClient.clear();
});

// Track Docker daemon health from API traffic (503 → down, success → ok).
setHealthHandler((ok) => useHealthStore.getState().setDaemon(ok ? "ok" : "down"));

// Restore the session (probe /users/me) before the first render settles.
void useAuthStore.getState().bootstrap();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <ToastViewport />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
