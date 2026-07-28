import "server-only";

import type { TaskRepository } from "@/types/task";
import { hasGoogleConfiguration } from "@/lib/server-config";
import { GoogleSheetsTaskRepository } from "@/lib/sheets/repository";
import { InMemoryTaskRepository } from "./in-memory-repository";

const globalForRepository = globalThis as typeof globalThis & { taskRepository?: TaskRepository };

export function getTaskRepository(): TaskRepository {
  if (globalForRepository.taskRepository) return globalForRepository.taskRepository;
  const useMemory = process.env.TASK_STORE_MODE === "memory" || (!hasGoogleConfiguration() && process.env.NODE_ENV !== "production");
  const repository = useMemory ? new InMemoryTaskRepository() : new GoogleSheetsTaskRepository();
  globalForRepository.taskRepository = repository;
  return repository;
}
