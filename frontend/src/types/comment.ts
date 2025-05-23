export interface Comment {
  id?: number;
  content?: string;
  username?: string;
  createdAt?: Date;
  updatedAt?: Date | string;
  edited?: boolean;
  replies?: Comment[];
  parentId?: string | null;
  flag?: number;
  reportedByUser?: boolean;
}

export interface CommentEditData {
  content: string;
}

export interface CommentCreateData {
  content: string;
  parentId?: number | null;
}

export interface PaginationParams {
  page: number;
  size: number;
  sort?: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
}
