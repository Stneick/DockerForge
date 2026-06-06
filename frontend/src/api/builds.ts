import { api } from "./http";
import type {
  Build,
  BuildComparisonResponse,
  BuildConfigComparisonResponse,
  BuildDetail,
  BuildListResponse,
  BuildLogsResponse,
  BuildStatus,
  MessageResponse,
  PushBuildRequest,
  TriggerBuildRequest,
} from "@/types/api";

export interface ListBuildsParams {
  page?: number;
  per_page?: number;
  status?: BuildStatus;
}

const base = (pid: string) => `/projects/${pid}/builds`;

export const buildsApi = {
  list: (pid: string, params: ListBuildsParams = {}) =>
    api.get<BuildListResponse>(base(pid), { query: { ...params } }),
  get: (pid: string, bid: string) => api.get<BuildDetail>(`${base(pid)}/${bid}`),
  trigger: (pid: string, body: TriggerBuildRequest) => api.post<Build>(base(pid), body),
  logs: (pid: string, bid: string) => api.get<BuildLogsResponse>(`${base(pid)}/${bid}/logs`),
  retry: (pid: string, bid: string) => api.post<Build>(`${base(pid)}/${bid}/retry`),
  cancel: (pid: string, bid: string) =>
    api.post<MessageResponse>(`${base(pid)}/${bid}/cancel`),
  deleteImage: (pid: string, bid: string) =>
    api.del<MessageResponse>(`${base(pid)}/${bid}/image`),
  compare: (pid: string, buildA: string, buildB: string) =>
    api.get<BuildComparisonResponse>(`${base(pid)}/compare`, {
      query: { build_a_id: buildA, build_b_id: buildB },
    }),
  compareConfig: (pid: string, buildA: string, buildB: string) =>
    api.get<BuildConfigComparisonResponse>(`${base(pid)}/compare/config`, {
      query: { build_a_id: buildA, build_b_id: buildB },
    }),
  push: (pid: string, bid: string, body: PushBuildRequest) =>
    api.post<MessageResponse>(`${base(pid)}/${bid}/push`, body),

  // URLs for the streaming/binary endpoints (consumed by the SSE reader / <a download>).
  eventsPath: (pid: string, bid: string) => `${base(pid)}/${bid}/events`,
  pushEventsPath: (pid: string, bid: string) => `${base(pid)}/${bid}/push/events`,
  downloadUrl: (pid: string, bid: string) => `/api/v1${base(pid)}/${bid}/download`,
};
