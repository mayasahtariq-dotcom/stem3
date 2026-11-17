"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Badge, Home, League, Mascot, Path, Quest, Stats, Term } from "./types";

export const useHome = () => useQuery({ queryKey: ["home"], queryFn: () => api<Home>("/home") });
export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: () => api<Stats>("/game/stats") });
export const usePath = (id?: string) => useQuery({ queryKey: ["path", id], enabled: !!id, queryFn: () => api<Path>(`/courses/${id}/path`) });
export const useQuests = () => useQuery({ queryKey: ["quests"], queryFn: () => api<Quest[]>("/game/quests") });
export const useLeague = () => useQuery({ queryKey: ["league"], queryFn: () => api<League>("/game/league") });
export const useBadges = () => useQuery({ queryKey: ["badges"], queryFn: () => api<Badge[]>("/game/badges") });
export const useMascot = () => useQuery({ queryKey: ["mascot"], queryFn: () => api<Mascot>("/game/mascot") });
export const useTerms = (courseId?: string) => useQuery({ queryKey: ["terms", courseId], enabled: !!courseId,
  queryFn: () => api<Term[]>(`/courses/${courseId}/terms`) });
