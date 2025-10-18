import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Album, MediaItem, User, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { getAlbumById, getUser, deleteMediaItem } from '../services/api';
import PhotoGrid from '../components/PhotoGrid';
import PhotoModal from '../components/PhotoModal';
import { PencilSquareIcon, TrashIcon } from '../components/icons/Icons';

interface AlbumPageProps {
  setEditingMediaItem: (mediaItem: MediaItem | null) => void;
}

const AlbumPage: React.FC<AlbumPageProps> = ({ setEditingMediaItem }) => {
  const { albumId } = useParams<{ albumId: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [album, setAlbum] = useState<Album | null>(null);
  const [author, setAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);

  const fetchAlbumData = useCallback(async () => {
    if (!albumId) {
        setError('ID do álbum não fornecido.');
        setLoading(false);
        return;
    }
    setLoading(true);
    setError('');
    try {
        const albumData = await getAlbumById(albumId, currentUser);
        if (albumData) {
            setAlbum(albumData);
            const authorData = await getUser(albumData.createdBy);
            if (authorData) setAuthor(authorData);
        } else {
            setError('Álbum não encontrado ou você não tem permissão para vê-lo.');
        }
    } catch (err) {
        setError('Falha ao carregar o álbum.');
        console.error(err);
    } finally {
        setLoading(false);
    }
  }, [albumId, currentUser]);
  
  useEffect(() => {
    fetchAlbumData();
  }, [fetchAlbumData]);

  const handleMediaClick = (mediaItem: MediaItem) => {
    setSelectedMediaItem(mediaItem);
  };
  
  const handleModalClose = () => {
    setSelectedMediaItem(null);
  };

  const handleNextMedia = () => {
    if (!album || !selectedMediaItem) return;
    const currentIndex = album.photos.findIndex(p => p.id === selectedMediaItem.id);
    if (currentIndex > -1 && currentIndex < album.photos.length - 1) {
      setSelectedMediaItem(album.photos[currentIndex + 1]);
    }
  };

  const handlePrevMedia = () => {
    if (!album || !selectedMediaItem) return;
    const currentIndex = album.photos.findIndex(p => p.id === selectedMediaItem.id);
    if (currentIndex > 0) {
      setSelectedMediaItem(album.photos[currentIndex - 1]);
    }
  };
  
  const handleEditClick = (mediaItem: MediaItem) => {
    handleModalClose(); // Close the photo view modal first
    setEditingMediaItem(mediaItem);
  };
  
  const handleDeleteClick = async (mediaItem: MediaItem) => {
    if (window.confirm('Tem certeza que deseja apagar esta mídia?')) {
        await deleteMediaItem(mediaItem.id, mediaItem.albumId);
        handleModalClose();
        fetchAlbumData(); // Refresh data
    }
  };

  if (loading) return <p className="text-center py-10">Carregando álbum...</p>;
  if (error) return <p className="text-center py-10 text-red-500">{error}</p>;
  if (!album) return <p className="text-center py-10">Álbum não encontrado.</p>;

  const canEdit = currentUser?.id === album.createdBy || (currentUser?.role && [Role.ADMIN, Role.ADMIN_MASTER].includes(currentUser.role));

  return (
    <div className="py-8">
        <div className="mb-12">
            <h1 className="text-4xl font-bold">{album.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">{album.description}</p>
            {author && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Criado por <Link to={`/profile/${author.id}`} className="font-semibold hover:underline">{author.name}</Link> em {new Date(album.createdAt).toLocaleDateString()}
                </p>
            )}
        </div>
      
        <PhotoGrid photos={album.photos} onPhotoClick={handleMediaClick} />

        {selectedMediaItem && (
            <PhotoModal 
                photo={selectedMediaItem}
                onClose={handleModalClose}
                onNext={album.photos.findIndex(p => p.id === selectedMediaItem.id) < album.photos.length - 1 ? handleNextMedia : undefined}
                onPrev={album.photos.findIndex(p => p.id === selectedMediaItem.id) > 0 ? handlePrevMedia : undefined}
                onEditClick={canEdit ? () => handleEditClick(selectedMediaItem) : undefined}
            />
        )}
    </div>
  );
};

export default AlbumPage;