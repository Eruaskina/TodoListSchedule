export enum TodoPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TodoStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum NavigationTab {
  TODOS = 'todos',
  KNOW_HOW = 'knowhow',
  SEARCH_TAGS = 'search',
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  status: TodoStatus;
  priority: TodoPriority;
  tags: string[];
  notes: string;
  linkedKnowHowIds: string[];
  deadline?: number | null;
  hourlyReminder?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface KnowHowItem {
  id: string;
  title: string;
  category?: string;
  content: string;
  tags: string[];
  relatedKnowHowIds: string[];
  imageIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredImage {
  id: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  blob: Blob;
  createdAt: number;
}

export interface ExportedImage {
  id: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  dataUrl: string;
  createdAt: number;
}

export interface WorkspaceExport {
  app: 'dizin-workspace';
  version: number;
  exportedAt: string;
  todos: TodoItem[];
  knowhows: KnowHowItem[];
  images: ExportedImage[];
  folders?: string[];
}
