import { api } from "./http";
import type { LanguageListResponse } from "@/types/api";

export const languagesApi = {
  list: () => api.get<LanguageListResponse>("/languages"),
};
