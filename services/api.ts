import { 
    users as mockUsers, 
    albums as mockAlbums,
    mediaItems as mockMediaItems,
    stories as mockStories,
    events as mockEvents,
    musicTracks as mockMusicTracks
} from '../data/mockData';
import { User, Role, Album, MediaItem, Story, EventItem, MusicTrack } from '../types';

// Make the mock data mutable for the simulation
let users = [...mockUsers];
let albums = [...mockAlbums];
let mediaItems = [...mockMediaItems];
let stories = [...mockStories];
let events = [...mockEvents];
let musicTracks = [...mockMusicTracks];


// Helper function to generate unique IDs
const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// API base handling:
// - If VITE_API_BASE is provided at build time, use it (example: https://api.obrasltda.com.br)
// - When running in development on localhost use the local backend at http://localhost:4000
// - Otherwise use relative '/api' so the app works behind a reverse proxy (nginx)
const VITE_API_BASE = (import.meta as any).env?.VITE_API_BASE as string | undefined;
const API_ORIGIN = VITE_API_BASE ?? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:4000' : '');
const API_BASE = API_ORIGIN + '/api';

const canView = (user: User | null, album: Album): boolean => {
    if (album.permission === Role.READER) return true;
    if (!user || user.status !== 'APPROVED') return false;

    const roleHierarchy = {
        [Role.READER]: 0,
        [Role.MEMBER]: 1,
        [Role.ADMIN]: 2,
        [Role.ADMIN_MASTER]: 3
    };

    return roleHierarchy[user.role] >= roleHierarchy[album.permission];
}

// --- Auth ---
export const login = async (name: string, pass: string): Promise<User | null> => {
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (user && user.status === 'APPROVED') {
        return user;
    }
    return null;
};

export const registerUser = async (name: string, pass: string): Promise<{ success: boolean; message: string; }> => {
    // Try to register the user on the backend; fall back to in-memory mock
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/register` , {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, pass }),
            });
            if (!resp.ok) {
                const body = await resp.json().catch(() => ({}));
                return { success: false, message: body.error || 'Registro falhou no servidor' };
            }
            const data = await resp.json();
            const created = data.user;
            users.unshift(created as unknown as User);
            return { success: true, message: 'Usuário registrado com sucesso.' };
        }
    } catch (e) {
        // ignore and fall back
    }

    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return { success: false, message: 'Nome de usuário já existe.' };
    }
    const newUser: User = {
        id: generateId('user'),
        name,
        email: `${name.toLowerCase().replace(/\s/g, '.')}@obras.com`,
        avatar: `https://i.pravatar.cc/150?u=${generateId('avatar')}`,
        role: Role.READER,
        status: 'PENDING',
    };
    users.push(newUser);
    return { success: true, message: 'Usuário registrado com sucesso.' };
};

// --- Users ---
export const getMockUsers = async (): Promise<User[]> => {
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE.replace(/\/api$/, '')}/api/users`);
            if (resp.ok) {
                const data = await resp.json();
                users = data.users as User[];
            }
        }
    } catch (e) {
        // ignore
    }
    return [...users];
};

export const getUser = async (userId: string): Promise<User | null> => {
    return users.find(u => u.id === userId) || null;
};

export const getUsersWithBirthdays = async (): Promise<User[]> => {
    return users.filter(u => u.birthdate && u.status === 'APPROVED');
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User | null> => {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return null;
    
    // Try to persist update to backend when available
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
            if (resp.ok) {
                const data = await resp.json();
                users[userIndex] = { ...users[userIndex], ...(data.user || {}) };
                return users[userIndex];
            }
        }
    } catch (e) {
        // ignore and fall back to local update
    }

    users[userIndex] = { ...users[userIndex], ...updates };
    return users[userIndex];
};

export const deleteUser = async (userId: string): Promise<boolean> => {
    const userToDelete = users.find(u => u.id === userId);
    if (userToDelete?.role === Role.ADMIN_MASTER) return false; 
    // Prefer to mark as REJECTED in the backend if available
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'REJECTED' }) });
            if (resp.ok) {
                // update local cache
                users = users.filter(u => u.id !== userId);
                return true;
            }
        }
    } catch (e) {
        // ignore and fall back to local deletion
    }
    const initialLength = users.length;
    users = users.filter(u => u.id !== userId);
    return users.length < initialLength;
};


// --- Media, Albums & Feed ---
export const getMediaForFeed = async (currentUser: User | null): Promise<MediaItem[]> => {
    // Try to fetch persisted media from the backend. If the backend is available
    // use that as the source of truth; otherwise fall back to the in-memory mock.
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/media/list`);
            if (resp.ok) {
                const data = await resp.json();
                const remote: MediaItem[] = (data.media || []).map((m: any) => ({
                    id: m.id || generateId('media'),
                    albumId: m.albumId || undefined,
                    url: m.url && m.url.startsWith('http') ? m.url : (API_ORIGIN ? `${API_ORIGIN}${m.url}` : m.url),
                    type: m.type || (m.url && /\.(mp4|webm|ogg|mov)$/i.test(m.url) ? 'video' : 'image'),
                    description: m.description || '',
                    uploadedBy: m.uploadedBy || 'server',
                    createdAt: m.uploadedAt || new Date().toISOString(),
                    taggedUsers: m.taggedUsers || [],
                }));
                // replace in-memory mediaItems so subsequent calls use the persisted set
                mediaItems = [...remote];
            }
        }
    } catch (e) {
        // ignore and use in-memory mock
    }

    const visibleAlbums = await getAllVisibleAlbums(currentUser);
    const visibleAlbumIds = new Set(visibleAlbums.map(a => a.id));

    const feedMedia = mediaItems.filter(item => {
        // Albumless photos are visible to all approved users
        if (!item.albumId) {
            return !!currentUser && currentUser.status === 'APPROVED';
        }
        // Photos in visible albums
        return visibleAlbumIds.has(item.albumId);
    });

    return feedMedia.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};


export const getAllVisibleAlbums = async (currentUser: User | null): Promise<Album[]> => {
    // Try to fetch persisted albums from backend when available
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/albums`);
            if (resp.ok) {
                const data = await resp.json();
                // replace local albums with persisted set
                albums = (data.albums || []).map((a: any) => ({ ...a }));
            }
        }
    } catch (e) {
        // ignore and use in-memory
    }
    return albums.filter(album => canView(currentUser, album))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};


export const getAlbumById = async (albumId: string, currentUser: User | null): Promise<Album | null> => {
    const album = albums.find(a => a.id === albumId);
    if (!album || !canView(currentUser, album)) {
        return null;
    }
    const albumPhotos = mediaItems.filter(m => m.albumId === albumId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { ...album, photos: albumPhotos };
};

export const getAlbumsForUser = async (userId: string, currentUser: User | null): Promise<{ albums: Album[] }> => {
    const userAlbums = albums.filter(a => a.createdBy === userId && canView(currentUser, a));
    return { albums: userAlbums };
};

export const getContentForUserProfile = async (userId: string, currentUser: User | null): Promise<{ taggedInAlbums: Album[], taggedInMedia: MediaItem[] }> => {
    const visibleAlbums = await getAllVisibleAlbums(currentUser);
    const visibleAlbumIds = new Set(visibleAlbums.map(a => a.id));

    const taggedInAlbums = visibleAlbums.filter(a => a.taggedUsers.includes(userId));
    const taggedInMedia = mediaItems
        .filter(m => m.taggedUsers.includes(userId) && (!m.albumId || visibleAlbumIds.has(m.albumId)))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
    return { taggedInAlbums, taggedInMedia };
};

export const addMediaItems = async (files: File[], uploadedBy: User, albumId?: string): Promise<MediaItem[]> => {
    // Try to upload to a local backend that saves files to /dados on disk.
    try {
    const serverUrl = `${API_BASE}/upload/media`;
        const form = new FormData();
        files.forEach(f => form.append('files', f));
        if (albumId) form.append('albumId', albumId);
        form.append('uploadedBy', uploadedBy.id);

        const resp = await fetch(serverUrl, { method: 'POST', body: form });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();

        const newMediaItems: MediaItem[] = data.files.map((f: any) => ({
            id: generateId('media'),
            albumId: albumId || undefined,
            url: f.url.startsWith('http') ? f.url : (API_ORIGIN ? `${API_ORIGIN}${f.url}` : f.url),
            type: f.type,
            description: '',
            uploadedBy: uploadedBy.id,
            createdAt: new Date().toISOString(),
            taggedUsers: [],
        }));
        mediaItems.unshift(...newMediaItems);
        return newMediaItems;
    } catch (e) {
        // Fallback to previous mock behavior if server is not available
        const newMediaItems: MediaItem[] = files.map(file => ({
            id: generateId('media'),
            albumId: albumId || undefined,
            url: URL.createObjectURL(file), // Mock URL
            type: file.type.startsWith('video/') ? 'video' : 'image',
            description: '',
            uploadedBy: uploadedBy.id,
            createdAt: new Date().toISOString(),
            taggedUsers: [],
        }));
        mediaItems.unshift(...newMediaItems);
        return newMediaItems;
    }
};

export const updateMediaItem = async (mediaId: string, updates: Partial<MediaItem>): Promise<MediaItem | null> => {
    const itemIndex = mediaItems.findIndex(m => m.id === mediaId);
    if (itemIndex === -1) return null;
    mediaItems[itemIndex] = { ...mediaItems[itemIndex], ...updates };
    return mediaItems[itemIndex];
};


export const deleteMediaItem = async (mediaId: string, albumId?: string | undefined): Promise<boolean> => {
    const initialLength = mediaItems.length;
    mediaItems = mediaItems.filter(m => m.id !== mediaId);
    return mediaItems.length < initialLength;
};

export const createAlbum = async (albumData: { title: string; description: string; permission: Role, isEventAlbum?: boolean }, createdBy: User): Promise<Album> => {
    const payload = {
        title: albumData.title,
        description: albumData.description,
        permission: albumData.permission,
        isEventAlbum: albumData.isEventAlbum || false,
        createdBy: createdBy.id
    };
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/albums`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (resp.ok) {
                const data = await resp.json();
                const newAlbum = data.album as Album;
                albums.unshift(newAlbum);
                return newAlbum;
            }
        }
    } catch (e) {
        // ignore and create locally
    }

    const newAlbum: Album = {
        id: generateId('album'),
        title: albumData.title,
        description: albumData.description,
        isEventAlbum: albumData.isEventAlbum || false,
        coverPhoto: `https://picsum.photos/seed/${generateId('cover')}/400/400`,
        createdBy: createdBy.id,
        createdAt: new Date().toISOString(),
        permission: albumData.permission,
        visibleTo: [],
        taggedUsers: [],
        photos: [],
    };
    albums.unshift(newAlbum);
    return newAlbum;
};

// --- Stories ---
export const getStories = async (): Promise<Story[]> => {
    // Try to read persisted stories
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/stories`);
            if (resp.ok) {
                const data = await resp.json();
                stories = (data.stories || []).map((s: any) => ({ ...s }));
            }
        }
    } catch (e) {
        // ignore
    }
    const now = new Date();
    return stories.filter(s => new Date(s.expiresAt) > now);
};

export const addStory = async (userId: string, file: File): Promise<Story> => {
    const now = new Date();
    // Try to upload story to backend
    try {
        const form = new FormData();
        form.append('file', file);
        form.append('userId', userId);
        const resp = await fetch(`${API_BASE}/upload/story`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error('Story upload failed');
        const data = await resp.json();
        const newStory: Story = {
            id: generateId('story'),
            userId,
            filePath: data.file.url.startsWith('http') ? data.file.url : (API_ORIGIN ? `${API_ORIGIN}${data.file.url}` : data.file.url),
            type: data.file.type,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        };
        // Persist the story metadata on the backend if available
        try {
            if (API_BASE) {
                await fetch(`${API_BASE}/stories`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, fileUrl: newStory.filePath, type: newStory.type }) });
            }
        } catch (e) {
            // ignore
        }
        stories.unshift(newStory);
        return newStory;
    } catch (e) {
        const newStory: Story = {
            id: generateId('story'),
            userId,
            filePath: URL.createObjectURL(file),
            type: file.type.startsWith('video/') ? 'video' : 'image',
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        };
        stories.unshift(newStory);
        return newStory;
    }
};

// --- Events ---
export const getEvents = async (): Promise<EventItem[]> => {
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/events`);
            if (resp.ok) {
                const data = await resp.json();
                events = (data.events || []).map((e: any) => ({ ...e }));
            }
        }
    } catch (e) {
        // ignore
    }
    return [...events].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const createEvent = async (
    eventData: { title: string; location: string; date: string; albumId?: string; createAlbumAutomatically?: boolean }, 
    createdBy: User
): Promise<EventItem> => {
    let finalAlbumId = eventData.albumId;

    if (eventData.createAlbumAutomatically) {
        const newAlbum = await createAlbum({ 
            title: eventData.title, 
            description: `Álbum para o evento "${eventData.title}"`, 
            permission: Role.MEMBER,
            isEventAlbum: true,
        }, createdBy);
        finalAlbumId = newAlbum.id;
    }

    if (!finalAlbumId) throw new Error("Um evento precisa de um álbum associado.");

    const newEvent: EventItem = {
        id: generateId('event'),
        title: eventData.title,
        location: eventData.location,
        date: eventData.date,
        albumId: finalAlbumId,
    };
    // persist on backend if available
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newEvent) });
            if (resp.ok) {
                const data = await resp.json();
                events.unshift(data.event);
                return data.event;
            }
        }
    } catch (e) {
        // ignore
    }
    events.unshift(newEvent);
    return newEvent;
};

export const updateEvent = async (eventId: string, updates: Partial<EventItem>, currentUser: User): Promise<EventItem | null> => {
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) return null;
    events[eventIndex] = { ...events[eventIndex], ...updates };
    return events[eventIndex];
};

export const deleteEvent = async (eventId: string, currentUser: User): Promise<boolean> => {
    const event = events.find(e => e.id === eventId);
    if (!event) return false;
    
    albums = albums.filter(a => a.id !== event.albumId);
    
    const initialLength = events.length;
    events = events.filter(e => e.id !== eventId);
    return events.length < initialLength;
};


// --- Admin Content Management ---
export const getAllAlbumsForAdmin = async (): Promise<Album[]> => {
    return albums.map(a => ({
        ...a,
        photos: mediaItems.filter(m => m.albumId === a.id)
            .sort((p1, p2) => new Date(p2.createdAt).getTime() - new Date(p1.createdAt).getTime()),
    })).sort((a1, a2) => new Date(a2.createdAt).getTime() - new Date(a1.createdAt).getTime());
};

export const getAllAlbumlessMediaForAdmin = async (): Promise<MediaItem[]> => {
    return mediaItems.filter(m => !m.albumId)
        .sort((p1, p2) => new Date(p2.createdAt).getTime() - new Date(p1.createdAt).getTime());
};

// --- Music ---
export const getMusicTracks = async (): Promise<MusicTrack[]> => {
    try {
        if (API_BASE) {
            const resp = await fetch(`${API_BASE}/music`);
            if (resp.ok) {
                const data = await resp.json();
                musicTracks = (data.music || []).map((m: any) => ({ ...m }));
            }
        }
    } catch (e) {
        // ignore
    }
    return [...musicTracks];
};

export const addMusicTrack = async (file: File): Promise<MusicTrack> => {
    try {
        const form = new FormData();
        form.append('file', file);
        const resp = await fetch(`${API_BASE}/upload/music`, { method: 'POST', body: form });
        if (!resp.ok) throw new Error('Music upload failed');
        const data = await resp.json();
        const newTrack: MusicTrack = {
            id: generateId('music'),
            title: data.file.originalName.replace(/\.mp3$/i, ''),
            artist: 'Desconhecido',
            url: data.file.url.startsWith('http') ? data.file.url : (API_ORIGIN ? `${API_ORIGIN}${data.file.url}` : data.file.url),
            duration: data.file.duration || 0,
            hotcues: [],
        };
        // persist metadata on backend
        try {
            if (API_BASE) {
                await fetch(`${API_BASE}/music`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTrack) });
            }
        } catch (e) {
            // ignore
        }
        musicTracks.push(newTrack);
        return newTrack;
    } catch (e) {
        const newTrack: MusicTrack = {
            id: generateId('music'),
            title: file.name.replace(/\.mp3$/i, ''),
            artist: 'Desconhecido',
            url: URL.createObjectURL(file),
            duration: 0,
            hotcues: [],
        };
        musicTracks.push(newTrack);
        return newTrack;
    }
};

export const deleteMusicTrack = async (trackId: string): Promise<boolean> => {
    const initialLength = musicTracks.length;
    musicTracks = musicTracks.filter(t => t.id !== trackId);
    return musicTracks.length < initialLength;
};