// React Query hooks layered on top of /lib/api.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const useModelStatus = () =>
  useQuery({ queryKey: ["model", "status"], queryFn: api.modelStatus });

export const useMCPServers = () =>
  useQuery({ queryKey: ["mcp", "servers"], queryFn: api.mcpServers });

export const useRuns = (limit = 20) =>
  useQuery({ queryKey: ["runs", limit], queryFn: () => api.runs(limit) });

export const useTimeline = (taskId: string | undefined) =>
  useQuery({
    queryKey: ["timeline", taskId],
    queryFn: () => api.timeline(taskId!),
    enabled: !!taskId,
  });

export const useProfile = () =>
  useQuery({ queryKey: ["profile"], queryFn: api.profile });

export const useCheckIns = (limit = 30) =>
  useQuery({ queryKey: ["check_ins", limit], queryFn: () => api.checkIns(limit) });

export const usePrompts = () =>
  useQuery({ queryKey: ["prompts"], queryFn: api.prompts, staleTime: Infinity });

export const useUpdateModel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.setModelSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model"] }),
  });
};

export const useReconnectMCP = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, password }: { name: string; password: string }) =>
      api.reconnectMCP(name, password),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mcp"] }),
  });
};

export const useSaveProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.saveProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
};

export const useAddCheckIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.addCheckIn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["check_ins"] }),
  });
};
