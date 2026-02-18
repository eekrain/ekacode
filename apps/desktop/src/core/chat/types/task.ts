export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "open" | "in_progress" | "closed";
  priority: number;
  type?: "bug" | "feature" | "task" | "epic" | "chore";
  sessionId?: string;
  createdAt?: number;
  updatedAt?: number;
  closedAt?: number;
  closeReason?: string;
  summary?: string;
}

export interface TaskList {
  tasks: Task[];
  hasMore: boolean;
  total: number;
}
