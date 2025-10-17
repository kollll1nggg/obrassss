import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { User, Album, MediaItem, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { searchContent, getUser } from '../services/api';
import PhotoGrid from '../components/PhotoGrid';
import PhotoModal from '../components/PhotoModal';

interface SearchResultsPageProps {
  setEditingMediaItem: (mediaItem: MediaItem | null) => void;
}

const SearchResultsPage: React.FC<SearchResultsPageProps> = ({ setEditingMediaItem }) => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<{ users: User[], albums: Album[], media: MediaItem[] }>({ users: [], albums: [], media: [] });
  const [userMap, setUserMap] = useState<Map<string, User>>(new Map());

  // Modals state
  const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      const searchResults = await searchContent(query, currentUser);
      setResults(searchResults);
      
      const userIds = new Set<string>();
      searchResults.albums.forEach(a => userIds.add(a.createdBy));
      searchResults.media.forEach(m => userIds.add(m.uploadedBy));
      
      const map = new Map<string, User>();
      for (const id of userIds) {
        if(id) {
            const user = await getUser(id);
            if (user) map.set(id, user);
        }
      }
      setUserMap(map);

      setLoading(false);
    };

    if (query) {
      fetchResults();
    } else {
      setLoading(false);
      setResults({ users: [], albums: [], media: [] });
    }
  }, [query, currentUser]);

  const handleMediaClick = (mediaItem: MediaItem) => {
    setSelectedMediaItem(mediaItem);
  };
  
  const handleModalClose = () => {
    setSelectedMediaItem(null);
  };
  
  const handleEditClick = (mediaItem: MediaItem) => {
    handleModalClose(); // Close the photo view modal first
    setEditingMediaItem(mediaItem);
  };

  if (loading) {
    return <p className="text-center py-10">Buscando por "{query}"...</p>;
  }
  
  const hasResults = results.users.length > 0 || results.albums.length > 0 || results.media.length > 0;

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-8">
        Resultados da Busca para: <span className="text-brand-500">"{query}"</span>
      </h1>
      
      {!hasResults ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-10">Nenhum resultado encontrado.</p>
      ) : (
        <div className="space-y-12">
          {/* Users Section */}
          {results.users.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Usuários</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {results.users.map(user => (
                  <Link to={`/profile/${user.id}`} key={user.id} className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow flex items-center space-x-4 hover:shadow-lg transition">
                    <img src={user.avatar} alt={user.name} className="h-12 w-12 rounded-full" />
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{user.role}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Albums Section */}
          {results.albums.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Álbuns</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {results.albums.map(album => {
                     const author = userMap.get(album.createdBy);
                     return (
                        <div key={album.id} onClick={() => navigate(`/profile/${album.createdBy}`)} className="bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden cursor-pointer group">
                             <div className="aspect-video overflow-hidden">
                                <img src={album.coverPhoto} alt={album.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                             </div>
                             <div className="p-4">
                                <h3 className="font-bold text-lg">{album.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">{album.description}</p>
                                {author && <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">por {author.name}</p>}
                             </div>
                        </div>
                     )
                 })}
              </div>
            </section>
          )}

          {/* Media Section */}
          {results.media.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-4">Fotos e Vídeos</h2>
              <PhotoGrid photos={results.media} onPhotoClick={handleMediaClick} />
            </section>
          )}
        </div>
      )}

      {selectedMediaItem && (
        <PhotoModal 
          photo={selectedMediaItem}
          onClose={handleModalClose}
          onEditClick={currentUser?.id === selectedMediaItem.uploadedBy || currentUser?.role === Role.ADMIN_MASTER ? () => handleEditClick(selectedMediaItem) : undefined}
        />
      )}
    </div>
  );
};

export default SearchResultsPage;
