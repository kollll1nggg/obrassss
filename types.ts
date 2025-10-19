export enum Role {
  ADMIN_MASTER = 'ADMIN_MASTER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  READER = 'READER',
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: Role;
  birthdate?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface MediaItem {
  id: string;
  albumId?: string;
  url: string;
  type: 'image' | 'video';
  description: string;
  uploadedBy: string;
  createdAt: string;
  filter?: string;
  taggedUsers: string[];
}

export interface Album {
  id: string;
  title: string;
  isEventAlbum?: boolean;
  description: string;
  coverPhoto: string;
  createdBy: string;
  createdAt: string;
  permission: Role;
  visibleTo: string[];
  taggedUsers: string[];
  photos: MediaItem[];
}

export interface Story {
  id: string;
  userId: string;
  filePath: string;
  type: 'image' | 'video';
  createdAt: string;
  expiresAt: string;
}

export interface EventItem {
    id: string;
    date: string;
    title: string;
    location: string;
    albumId: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number; // in seconds
}