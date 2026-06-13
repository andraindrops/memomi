export interface TodoTable {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  createdUserId: string;
  updatedUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DB {
  todo: TodoTable;
}
