import { api } from "./http";
import type {
  AuthUserResponse,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
} from "@/types/api";

export const authApi = {
  register: (body: RegisterRequest) =>
    api.post<AuthUserResponse>("/auth/register", body, { skipRefresh: true }),
  login: (body: LoginRequest) =>
    api.post<AuthUserResponse>("/auth/login", body, { skipRefresh: true }),
  refresh: () => api.post<MessageResponse>("/auth/refresh", undefined, { skipRefresh: true }),
  logout: () => api.post<MessageResponse>("/auth/logout", undefined, { skipRefresh: true }),
};
