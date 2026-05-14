import { api } from "./http";
import type {
  CloneRequest,
  CreateProjectRequest,
  DockerfileOverrides,
  DockerfilePreviewResponse,
  LintRequest,
  LintResponse,
  MessageResponse,
  Project,
  ProjectListResponse,
  ProjectSortBy,
  ProjectStats,
  SortOrder,
  SourceAnalysisResponse,
  UpdateProjectRequest,
} from "@/types/api";

export interface ListProjectsParams {
  page?: number;
  per_page?: number;
  sort_by?: ProjectSortBy;
  order?: SortOrder;
}

export const projectsApi = {
  list: (params: ListProjectsParams = {}) =>
    api.get<ProjectListResponse>("/projects", { query: { ...params } }),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (body: CreateProjectRequest) => api.post<Project>("/projects", body),
  update: (id: string, body: UpdateProjectRequest) =>
    api.patch<Project>(`/projects/${id}`, body),
  remove: (id: string) => api.del<MessageResponse>(`/projects/${id}`),

  // source acquisition + detection
  upload: (id: string, file: File, onProgress?: (pct: number) => void) =>
    uploadWithProgress(id, file, onProgress),
  clone: (id: string, body: CloneRequest) =>
    api.post<SourceAnalysisResponse>(`/projects/${id}/clone`, body),
  detect: (id: string) => api.post<SourceAnalysisResponse>(`/projects/${id}/detect`),

  // dockerfile
  previewDockerfile: (id: string, overrides?: DockerfileOverrides) =>
    api.post<DockerfilePreviewResponse>(`/projects/${id}/dockerfile/preview`, overrides ?? {}),
  lintDockerfile: (id: string, body: LintRequest = {}) =>
    api.post<LintResponse>(`/projects/${id}/dockerfile/lint`, body),

  stats: (id: string) => api.get<ProjectStats>(`/projects/${id}/stats`),
};

// Upload uses XHR so we can report progress (fetch lacks upload progress).
function uploadWithProgress(
  id: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<SourceAnalysisResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/projects/${id}/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as SourceAnalysisResponse);
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const data = JSON.parse(xhr.responseText);
          message = data?.message ?? data?.detail ?? message;
        } catch {
          /* keep default */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(form);
  });
}
