import { api } from "./http";
import type { AppSettings, UpdateAppSettingsRequest } from "@/types/api";

export const settingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (body: UpdateAppSettingsRequest) => api.patch<AppSettings>("/settings", body),
};
