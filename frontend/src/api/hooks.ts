// TanStack Query hooks wrapping the resource modules. Components consume these
// rather than calling the api objects directly, so caching + invalidation live
// in one place.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { buildsApi, type ListBuildsParams } from "./builds";
import { languagesApi } from "./languages";
import { projectsApi, type ListProjectsParams } from "./projects";
import { qk } from "./queryKeys";
import { settingsApi } from "./settings";
import { usersApi } from "./users";
import type {
  CloneRequest,
  CreateProjectRequest,
  PushBuildRequest,
  TriggerBuildRequest,
  UpdateProjectRequest,
} from "@/types/api";

// ---- static / reference ----
export function useLanguages() {
  return useQuery({
    queryKey: qk.languages,
    queryFn: () => languagesApi.list(),
    staleTime: Infinity,
    select: (d) => d.languages,
  });
}

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: () => settingsApi.get() });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => qc.setQueryData(qk.settings, data),
  });
}

// ---- user ----
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: (user) => qc.setQueryData(qk.me, user),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: usersApi.changePassword });
}

// ---- projects ----
export function useProjects(params: ListProjectsParams = {}) {
  return useQuery({
    queryKey: qk.projects(params),
    queryFn: () => projectsApi.list(params),
  });
}

export function useProject(
  id: string,
  options?: Partial<UseQueryOptions<Awaited<ReturnType<typeof projectsApi.get>>>>,
) {
  return useQuery({
    queryKey: qk.project(id),
    queryFn: () => projectsApi.get(id),
    ...options,
  });
}

export function useProjectStats(id: string, enabled = true) {
  return useQuery({
    queryKey: qk.projectStats(id),
    queryFn: () => projectsApi.stats(id),
    enabled,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectRequest) => projectsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects() }),
  });
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProjectRequest) => projectsApi.update(id, body),
    onSuccess: (project) => {
      qc.setQueryData(qk.project(id), project);
      qc.invalidateQueries({ queryKey: qk.projects() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects() }),
  });
}

export function useCloneSource(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CloneRequest) => projectsApi.clone(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.project(id) }),
  });
}

export function useDetectSource(id: string) {
  return useMutation({ mutationFn: () => projectsApi.detect(id) });
}

// ---- builds ----
export function useBuilds(
  pid: string,
  params: ListBuildsParams = {},
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: qk.builds(pid, params),
    queryFn: () => buildsApi.list(pid, params),
    ...options,
  });
}

export function useBuild(
  pid: string,
  bid: string,
  options?: { refetchInterval?: number | false; enabled?: boolean },
) {
  return useQuery({
    queryKey: qk.build(pid, bid),
    queryFn: () => buildsApi.get(pid, bid),
    ...options,
  });
}

export function useBuildLogs(pid: string, bid: string, enabled = true) {
  return useQuery({
    queryKey: qk.buildLogs(pid, bid),
    queryFn: () => buildsApi.logs(pid, bid),
    enabled,
  });
}

export function useTriggerBuild(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TriggerBuildRequest) => buildsApi.trigger(pid, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.builds(pid) });
      qc.invalidateQueries({ queryKey: qk.project(pid) });
    },
  });
}

export function useRetryBuild(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bid: string) => buildsApi.retry(pid, bid),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.builds(pid) }),
  });
}

export function useCancelBuild(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bid: string) => buildsApi.cancel(pid, bid),
    onSuccess: (_d, bid) => {
      qc.invalidateQueries({ queryKey: qk.build(pid, bid) });
      qc.invalidateQueries({ queryKey: qk.builds(pid) });
    },
  });
}

export function useDeleteImage(pid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bid: string) => buildsApi.deleteImage(pid, bid),
    onSuccess: (_d, bid) => qc.invalidateQueries({ queryKey: qk.build(pid, bid) }),
  });
}

export function useCompareBuilds(pid: string, a: string, b: string, enabled = true) {
  return useQuery({
    queryKey: qk.compare(pid, a, b),
    queryFn: () => buildsApi.compare(pid, a, b),
    enabled: enabled && !!a && !!b,
  });
}

export function useCompareBuildConfig(pid: string, a: string, b: string, enabled = true) {
  return useQuery({
    queryKey: qk.compareConfig(pid, a, b),
    queryFn: () => buildsApi.compareConfig(pid, a, b),
    enabled: enabled && !!a && !!b,
  });
}

export function usePushBuild(pid: string, bid: string) {
  return useMutation({
    mutationFn: (body: PushBuildRequest) => buildsApi.push(pid, bid, body),
  });
}
