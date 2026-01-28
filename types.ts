
export interface Folder {
  id: string;
  name: string;
  description: string;
  datecreated: string; // Changed from dateCreated
}

export interface ComicEntry {
  id: string;
  title: string;
  date: string; // ISO format
  imageurl: string; // Changed from imageUrl
  thumbnailurl?: string; // Changed from thumbnailUrl
  mimetype: string; // Changed from mimeType
  description: string;
  tags: string[];
  folderid?: string; // Changed from folderId
  layoutsize?: 'small' | 'medium' | 'large'; // Changed from layoutSize
}

export enum ViewMode {
  VIEWER = 'viewer',
  ADMIN = 'admin'
}
