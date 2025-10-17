import { User, Role, Album, MediaItem, Story } from '../types';
import { MOCK_USERS, MOCK_ALBUMS, MOCK_STORIES, MOCK_ALBUMLESS_MEDIA } from '../data/mockData';

// Simulate a database
let users: User[] = [...MOCK_USERS];
let albums: Album[] = [...MOCK_ALBUMS];
let stories: Story[] = [...MOCK_STORIES];
let albumlessMedia: MediaItem[] = [...MOCK_ALBUMLESS_MEDIA];

const simulateDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

const roleToLevel = (role: Role): number => {
    switch (role) {
        case Role.READER: return 0;
        case Role.MEMBER: return 1;
        case Role.ADMIN: return 2;
        case Role.ADMIN_MASTER: return 3;
        default: return -1;
    }
}

export const hasPermission = (userRole: Role, requiredRole: Role): boolean => {
    return roleToLevel(userRole) >= roleToLevel(requiredRole);
}

export const getMockUsers = async (): Promise<User[]> => {
    await simulateDelay(100);
    return [...users];
};

export const getUser = async (id: string): Promise<User | undefined> => {
    await simulateDelay(50);
    return users.find(u => u.id === id);
}

export const login = async (email: string, pass: string): Promise<User | null> => {
    await simulateDelay(500);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user || null;
};

export const getAlbumsForUser = async (userId: string, currentUser: User | null): Promise<{ albums: Album[], albumlessMedia: MediaItem[] }> => {
    await simulateDelay(300);
    const userAlbums = albums.filter(album => {
        if (album.createdBy !== userId) return false;
        if (currentUser) {
            return hasPermission(currentUser.role, album.permission);
        }
        return album.permission === Role.READER;
    });
    const userAlbumlessMedia = albumlessMedia.filter(media => media.uploadedBy === userId);
    return { albums: userAlbums, albumlessMedia: userAlbumlessMedia };
};

export const getAlbumsForFeed = async (currentUser: User | null, filters?: { taggedUserIds?: string[]; eventTitles?: string[] }): Promise<Album[]> => {
    await simulateDelay(600);
    let allVisibleAlbums;
    if (currentUser) {
        allVisibleAlbums = albums.filter(album => hasPermission(currentUser.role, album.permission));
    } else {
        allVisibleAlbums = albums.filter(album => album.permission === Role.READER);
    }
    
    // Create a virtual album for album-less media if they exist
    if (albumlessMedia.length > 0) {
        const virtualAlbum: Album = {
            id: 'album-virtual-albumless',
            title: 'Sem Álbum',
            description: 'Publicações que não pertencem a nenhum álbum.',
            coverPhoto: albumlessMedia.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.url || '',
            createdBy: '', // No specific creator
            createdAt: new Date().toISOString(),
            permission: Role.MEMBER,
            visibleTo: [],
            taggedUsers: [],
            photos: [...albumlessMedia],
        };
        // only show virtual album to members
        if (currentUser && hasPermission(currentUser.role, Role.MEMBER)) {
            allVisibleAlbums.push(virtualAlbum);
        }
    }
    
    let feedAlbums = allVisibleAlbums;

    if (filters?.taggedUserIds && filters.taggedUserIds.length > 0) {
        feedAlbums = feedAlbums.filter(album => 
            filters.taggedUserIds!.some(uid => album.taggedUsers.includes(uid))
        );
    }
    if (filters?.eventTitles && filters.eventTitles.length > 0) {
        feedAlbums = feedAlbums.filter(album => filters.eventTitles!.includes(album.title));
    }

    return feedAlbums.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const getStories = async (): Promise<Story[]> => {
    await simulateDelay(200);
    const now = new Date();
    return stories.filter(story => new Date(story.expiresAt) > now);
};

export const addStory = async (userId: string, file: File): Promise<Story> => {
    await simulateDelay(700);
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const newStory: Story = {
        id: `story-${Date.now()}`,
        userId,
        filePath: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 'video',
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
    };
    stories.unshift(newStory);
    return newStory;
};

export const createAlbum = async (data: { title: string, description: string, permission: Role }, currentUser: User): Promise<Album> => {
    await simulateDelay(500);
    const newAlbum: Album = {
        id: `album-${Date.now()}`,
        title: data.title,
        description: data.description,
        permission: data.permission,
        visibleTo: [],
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        coverPhoto: 'https://placehold.co/800x400/222/FFF?text=Novo+Álbum',
        taggedUsers: [],
        photos: [],
    };
    albums.unshift(newAlbum);
    return newAlbum;
};

const fileToUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const addMediaItems = async (files: File[], currentUser: User, albumId?: string): Promise<MediaItem[]> => {
    await simulateDelay(1000);
    
    const newMediaItems: MediaItem[] = [];
    for (const file of files) {
        const mediaUrl = await fileToUrl(file);
        const newMedia: MediaItem = {
            id: `media-${Date.now()}-${Math.random()}`,
            albumId: albumId,
            url: mediaUrl,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            description: '',
            uploadedBy: currentUser.id,
            createdAt: new Date().toISOString(),
            filter: undefined,
        };
        newMediaItems.push(newMedia);
    }
    
    if (albumId) {
        const targetAlbum = albums.find(a => a.id === albumId);
        if (!targetAlbum) throw new Error("Album not found");
        
        targetAlbum.photos.unshift(...newMediaItems);
        const firstImage = newMediaItems.find(item => item.type === 'image');
        if (targetAlbum.photos.length > 0 && targetAlbum.coverPhoto.includes('placehold.co') && firstImage) {
            targetAlbum.coverPhoto = firstImage.url;
        }
    } else {
        albumlessMedia.unshift(...newMediaItems);
    }

    return newMediaItems;
};

export const updateMediaItem = async (mediaId: string, newData: { url: string; description: string; filter?: string; createdAt?: string; taggedUsers?: string[]; albumId?: string; }): Promise<MediaItem | null> => {
    await simulateDelay(700);

    let mediaItem: MediaItem | undefined;
    let originalContainer: MediaItem[] | undefined;
    let originalIndex = -1;

    // Find the media item in albums
    for (const album of albums) {
        const index = album.photos.findIndex(p => p.id === mediaId);
        if (index !== -1) {
            mediaItem = album.photos[index];
            originalContainer = album.photos;
            originalIndex = index;
            break;
        }
    }

    // If not found in albums, check albumlessMedia
    if (!mediaItem) {
        const index = albumlessMedia.findIndex(p => p.id === mediaId);
        if (index !== -1) {
            mediaItem = albumlessMedia[index];
            originalContainer = albumlessMedia;
            originalIndex = index;
        }
    }

    if (!mediaItem || !originalContainer || originalIndex === -1) {
        return null; // Media item not found
    }
    
    const originalAlbumId = mediaItem.albumId;
    // Check if albumId is part of newData. If not, it doesn't change. Treat empty string as "no album".
    const newAlbumId = 'albumId' in newData ? (newData.albumId || undefined) : originalAlbumId;
    
    const albumHasChanged = 'albumId' in newData && newAlbumId !== originalAlbumId;

    // Create the updated media item object.
    const { albumId, ...restOfNewData } = newData;
    const updatedMediaItem: MediaItem = { ...mediaItem, ...restOfNewData, albumId: newAlbumId };

    if (albumHasChanged) {
        // 1. Remove from original location
        originalContainer.splice(originalIndex, 1);

        // 2. Add to new location
        if (!newAlbumId) { // Moving to albumless
            albumlessMedia.unshift(updatedMediaItem);
        } else { // Moving to a specific album
            const targetAlbum = albums.find(a => a.id === newAlbumId);
            if (targetAlbum) {
                targetAlbum.photos.unshift(updatedMediaItem);
            } else {
                // Fallback: if target album not found, move to albumless
                console.warn(`Target album ${newAlbumId} not found. Moving media ${mediaId} to albumless.`);
                updatedMediaItem.albumId = undefined;
                albumlessMedia.unshift(updatedMediaItem);
            }
        }
    } else {
        // Just update in place if album hasn't changed
        originalContainer[originalIndex] = updatedMediaItem;
    }

    return updatedMediaItem;
};

// Search Function
export const searchContent = async (query: string, currentUser: User | null): Promise<{ users: User[], albums: Album[], media: MediaItem[] }> => {
    await simulateDelay(500);
    const lowerCaseQuery = query.toLowerCase();

    if (!lowerCaseQuery) {
        return { users: [], albums: [], media: [] };
    }

    // 1. Search Users
    const foundUsers = users.filter(u => u.name.toLowerCase().includes(lowerCaseQuery));

    // 2. Search Albums and Media (respecting permissions)
    const allVisibleAlbums = currentUser ? albums.filter(a => hasPermission(currentUser.role, a.permission)) : albums.filter(a => a.permission === Role.READER);
    const allVisibleAlbumlessMedia = currentUser && hasPermission(currentUser.role, Role.MEMBER) ? albumlessMedia : [];
    
    const foundAlbums: Album[] = [];
    const foundMedia: MediaItem[] = [];
    const foundMediaIds = new Set<string>();

    // Search within albums
    for (const album of allVisibleAlbums) {
        const albumTitleMatch = album.title.toLowerCase().includes(lowerCaseQuery);
        const albumDescMatch = album.description.toLowerCase().includes(lowerCaseQuery);
        
        if (albumTitleMatch || albumDescMatch) {
            foundAlbums.push(album);
        }

        for (const media of album.photos) {
            if (foundMediaIds.has(media.id)) continue;
            
            const mediaDescMatch = media.description.toLowerCase().includes(lowerCaseQuery);
            const mediaDateMatch = media.createdAt.toLowerCase().includes(lowerCaseQuery);

            if (mediaDescMatch || mediaDateMatch) {
                foundMedia.push(media);
                foundMediaIds.add(media.id);
            }
        }
    }

    // Search within albumless media
    for (const media of allVisibleAlbumlessMedia) {
        if (foundMediaIds.has(media.id)) continue;
        
        const mediaDescMatch = media.description.toLowerCase().includes(lowerCaseQuery);
        const mediaDateMatch = media.createdAt.toLowerCase().includes(lowerCaseQuery);

        if (mediaDescMatch || mediaDateMatch) {
            foundMedia.push(media);
            foundMediaIds.add(media.id);
        }
    }

    return {
        users: foundUsers,
        albums: foundAlbums,
        media: foundMedia,
    };
};


// Admin Functions

export const updateUserRole = async (userId: string, newRole: Role): Promise<User | null> => {
    await simulateDelay(300);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
        const adminMasters = users.filter(u => u.role === Role.ADMIN_MASTER);
        if (users[userIndex].role === Role.ADMIN_MASTER && adminMasters.length === 1) {
            console.error("Cannot change the role of the last ADMIN_MASTER.");
            alert("Não é possível alterar o papel do último administrador mestre.");
            return null;
        }
        users[userIndex].role = newRole;
        return { ...users[userIndex] };
    }
    return null;
};

export const deleteUser = async (userId: string): Promise<boolean> => {
    await simulateDelay(500);
     const userIndex = users.findIndex(u => u.id === userId);
     if (userIndex === -1) return false;
     
    if (users[userIndex].role === Role.ADMIN_MASTER) {
        const adminMasters = users.filter(u => u.role === Role.ADMIN_MASTER);
        if (adminMasters.length === 1) {
            console.error("Cannot delete the last ADMIN_MASTER.");
            alert("Não é possível deletar o último administrador mestre.");
            return false;
        }
    }
    
    const initialLength = users.length;
    users = users.filter(u => u.id !== userId);
    return users.length < initialLength;
};

export const createUser = async (data: { name: string, email: string, role: Role }): Promise<User> => {
    await simulateDelay(500);
    const newUser: User = {
        id: `user-${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role,
        avatar: `https://i.pravatar.cc/150?u=${Date.now()}`,
    };
    users.unshift(newUser);
    return newUser;
};

export const getAllAlbumsAndMedia = async (): Promise<{ albums: Album[], albumlessMedia: MediaItem[] }> => {
    await simulateDelay(400);
    return { albums: [...albums], albumlessMedia: [...albumlessMedia] };
};

export const deleteAlbum = async (albumId: string): Promise<boolean> => {
    await simulateDelay(500);
    const initialLength = albums.length;
    albums = albums.filter(a => a.id !== albumId);
    return albums.length < initialLength;
};

export const deleteMediaItem = async (mediaId: string): Promise<boolean> => {
    await simulateDelay(300);
    
    let deleted = false;
    
    const initialAlbumlessLength = albumlessMedia.length;
    albumlessMedia = albumlessMedia.filter(m => m.id !== mediaId);
    if (albumlessMedia.length < initialAlbumlessLength) {
        deleted = true;
    }

    for (const album of albums) {
        const initialPhotosLength = album.photos.length;
        album.photos = album.photos.filter(p => p.id !== mediaId);
        if (album.photos.length < initialPhotosLength) {
            deleted = true;
        }
    }
    
    return deleted;
};