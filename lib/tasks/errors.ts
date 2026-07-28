export class TaskNotFoundError extends Error {
  readonly code = "NOT_FOUND";
}

export class TaskConflictError extends Error {
  readonly code = "CONFLICT";
}

export class RepositoryUnavailableError extends Error {
  readonly code = "REPOSITORY_UNAVAILABLE";
}

export class ConfigurationError extends Error {
  readonly code = "CONFIGURATION_ERROR";
}
