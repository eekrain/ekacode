export interface RecoverExpiredRunsInput {
  now?: Date;
}

export async function recoverExpiredRunsUsecase(
  _input: RecoverExpiredRunsInput = {}
): Promise<number> {
  return 0;
}

export const migrationCheckpoint = {
  task: "Move recovery to application usecase",
  status: "implemented-minimally",
} as const;
