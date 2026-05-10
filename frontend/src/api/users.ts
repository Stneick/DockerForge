import { api } from "./http";
import type {
  ChangePasswordRequest,
  MessageResponse,
  UpdateUserRequest,
  UserProfile,
} from "@/types/api";

export const usersApi = {
  me: () => api.get<UserProfile>("/users/me"),
  updateMe: (body: UpdateUserRequest) => api.patch<UserProfile>("/users/me", body),
  changePassword: (body: ChangePasswordRequest) =>
    api.post<MessageResponse>("/users/me/password", body),
};
