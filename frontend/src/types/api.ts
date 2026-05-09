// TypeScript mirror of the DockerForge FastAPI schemas.
// Source of truth: backend at .../DockerForge/backend. Keep field names exact.

export type SupportedLanguage =
  | "python"
  | "node"
  | "go"
  | "java"
  | "c"
  | "cpp"
  | "rust";

export type BuildStatus =
  | "pending"
  | "building"
  | "success"
  | "failed"
  | "cancelled";

export type TriggerType = "manual" | "retry";
export type SourceType = "upload" | "git" | "none";
export type LintLevel = "error" | "warning" | "info" | "style";
export type LogStream = "stdout" | "stderr";

// ---- shared ----
export interface EnvVar {
  key: string;
  value: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

export interface MessageResponse {
  message: string;
}

// ---- auth / user ----
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  total_projects: number;
  total_builds: number;
  created_at: string;
  updated_at: string;
}

export interface AuthUserResponse {
  user: UserProfile;
  token_type: string;
  expires_in: number;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// ---- projects ----
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  language: SupportedLanguage | null;
  framework: string | null;
  dependency_file: string | null;
  startup_command: string | null;
  entry_point: string | null;
  binary_name: string | null;
  build_output_dir: string | null;
  build_package: string | null;
  base_image: string | null;
  env_vars: EnvVar[];
  port: number | null;
  source_type: SourceType;
  repo_url: string | null;
  source_uploaded: boolean;
  total_builds: number;
  last_build_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string | null;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  language?: SupportedLanguage | null;
  framework?: string | null;
  dependency_file?: string | null;
  startup_command?: string | null;
  entry_point?: string | null;
  binary_name?: string | null;
  build_output_dir?: string | null;
  build_package?: string | null;
  base_image?: string | null;
  env_vars?: EnvVar[];
  port?: number | null;
}

export interface ProjectListResponse {
  items: Project[];
  pagination: Pagination;
}

export type ProjectSortBy = "created_at" | "updated_at" | "name";
export type SortOrder = "asc" | "desc";

// ---- source detection ----
export interface SourceAnalysisResponse {
  detected_language: SupportedLanguage | null;
  detected_framework: string | null;
  confidence: number; // 0.0 - 1.0
  detected_dependency_file: string | null;
  suggested_startup_command: string | null;
  detected_entry_point: string | null;
  detected_binary_name: string | null;
  detected_build_output_dir: string | null;
  detected_build_package: string | null;
  detected_base_image: string | null;
  detected_port: number | null;
  detected_files: string[];
  has_existing_dockerfile: boolean;
  note: string | null;
  warnings: string[];
}

export interface CloneRequest {
  repo_url: string;
  branch?: string;
  access_token?: string | null;
}

// ---- dockerfile ----
export interface DockerfileOverrides {
  base_image?: string | null;
  language?: SupportedLanguage | null;
  framework?: string | null;
  dependency_file?: string | null;
  startup_command?: string | null;
  entry_point?: string | null;
  binary_name?: string | null;
  build_output_dir?: string | null;
  build_package?: string | null;
  port?: number | null;
  env_vars?: EnvVar[];
}

export interface DockerfilePreviewResponse {
  dockerfile_content: string;
  dockerignore_content: string;
  base_image: string;
  warnings: string[];
}

export interface LintRequest {
  dockerfile?: string | null;
}

export interface LintIssue {
  code: string;
  message: string;
  level: LintLevel;
  line: number;
  column: number;
}

export interface LintResponse {
  issues: LintIssue[];
}

// ---- stats ----
export interface CacheBucketStats {
  count: number;
  avg_duration_seconds: number | null;
  min_duration_seconds: number | null;
  max_duration_seconds: number | null;
}

export interface ProjectStats {
  total_builds: number;
  successful_builds: number;
  failed_builds: number;
  cancelled_builds: number;
  success_rate: number; // 0.0 - 1.0
  avg_duration_seconds: number | null;
  fastest_build_seconds: number | null;
  slowest_build_seconds: number | null;
  avg_image_size_bytes: number | null;
  last_build_at: string | null;
  cached_builds: CacheBucketStats;
  no_cache_builds: CacheBucketStats;
}

// ---- builds ----
export interface TriggerBuildRequest {
  custom_dockerfile?: string | null;
  custom_dockerignore?: string | null;
  image_tag?: string | null;
  env_vars?: EnvVar[];
  build_args?: EnvVar[];
  no_cache?: boolean;
}

export interface Build {
  id: string;
  project_id: string;
  status: BuildStatus;
  image_tag: string | null;
  dockerfile_content: string | null;
  dockerignore_content: string | null;
  trigger_type: TriggerType;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  image_cleaned_at: string | null;
  no_cache: boolean;
}

export interface ImageLayer {
  instruction: string;
  size_bytes: number;
  size_human: string;
  created_at: string | null;
}

export interface BuildDetail extends Build {
  image_size_bytes: number | null;
  image_size_human: string | null;
  layers: ImageLayer[] | null;
  build_config: Record<string, unknown> | null;
}

export interface BuildListResponse {
  items: Build[];
  pagination: Pagination;
}

export interface LogEntry {
  line: number;
  message: string;
  stream: LogStream;
  timestamp: string;
}

export interface BuildLogsResponse {
  build_id: string;
  status: BuildStatus;
  logs: LogEntry[];
}

export type LayerDiffStatus = "unchanged" | "changed" | "added" | "removed";

export interface LayerComparison {
  instruction: string;
  size_a: number | null;
  size_b: number | null;
  diff_bytes: number;
  status: LayerDiffStatus;
}

export interface BuildComparisonResponse {
  build_a: BuildDetail;
  build_b: BuildDetail;
  size_diff_bytes: number;
  size_diff_human: string;
  duration_diff_seconds: number;
  layer_comparison: LayerComparison[];
}

// ---- registry / push ----
export interface PushBuildRequest {
  target_tag: string;
  repository: string;
  username: string;
  password: string;
}

// ---- streaming events (SSE) ----
export interface BuildStreamEvent {
  status: BuildStatus;
  log: LogEntry | null;
}

export interface PushStreamEvent {
  status?: string;
  message?: string;
  dockerforge_status?: string;
  error?: string;
  // raw docker push progress fields may also appear
  [key: string]: unknown;
}

// ---- languages ----
export interface FrameworkResponse {
  name: string;
  display_name: string;
  default_entry_point: string | null;
  default_startup_command: string;
  default_port: number | null;
  note: string | null;
}

export interface LanguageResponse {
  name: SupportedLanguage;
  display_name: string;
  default_base_image: string;
  supports_multi_stage: boolean;
  frameworks: FrameworkResponse[];
}

export interface LanguageListResponse {
  languages: LanguageResponse[];
}

// ---- settings ----
export interface AppSettings {
  build_timeout_seconds: number;
  build_memory_limit: string;
  image_cleanup_enabled: boolean;
  image_ttl_seconds: number;
  max_upload_size_mb: number;
  git_clone_timeout_seconds: number;
  build_log_stream_ttl_seconds: number;
  build_log_stream_max_entries: number;
  hadolint_timeout_seconds: number;
  updated_at: string;
}

export interface UpdateAppSettingsRequest {
  build_timeout_seconds?: number;
  build_memory_limit?: string;
  image_cleanup_enabled?: boolean;
  image_ttl_seconds?: number;
  max_upload_size_mb?: number;
  git_clone_timeout_seconds?: number;
  build_log_stream_ttl_seconds?: number;
  build_log_stream_max_entries?: number;
  hadolint_timeout_seconds?: number;
}
