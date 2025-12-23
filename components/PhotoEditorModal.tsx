
import React, { useState, useRef, useEffect } from 'react';
import { MediaItem, User, Album } from '../types';
import { XMarkIcon } from './icons/Icons';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { updateMediaItem, getMockUsers, getAlbumsForUser } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface PhotoEditorModalProps {
  photo: MediaItem;
  onClose: () => void;
  onSave: (updatedPhoto: MediaItem) => void;
}

function getCroppedImg(image: HTMLImageElement, crop: Crop, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );
}


const PhotoEditorModal: React.FC<PhotoEditorModalProps> = ({ photo, onClose, onSave }) => {
  const [description, setDescription] = useState(photo.description);
  const [isSaving, setIsSaving] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [editedDate, setEditedDate] = useState(photo.createdAt);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>(photo.taggedUsers || []);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Album selection state
  const { user: currentUser } = useAuth();
  const [userAlbums, setUserAlbums] = useState<Album[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [selectedAlbumId, setSelectedAlbumId] = useState(photo.albumId || '');

  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const fetchUsers = async () => {
        const users = await getMockUsers();
        // Exclude current user from tagging self
        setAllUsers(users.filter(u => u.id !== photo.uploadedBy));
    };
    fetchUsers();
  }, [photo.uploadedBy]);

  useEffect(() => {
    const fetchAlbums = async () => {
        // We need currentUser for permissions, and photo.uploadedBy to get the correct user's albums.
        if (!currentUser || !photo.uploadedBy) return;
        setIsLoadingAlbums(true);
        try {
            // Fetch albums belonging to the person who uploaded the photo
            const { albums } = await getAlbumsForUser(photo.uploadedBy, currentUser);
            setUserAlbums(albums);
        } catch (error) {
            console.error("Failed to fetch user albums:", error);
        } finally {
            setIsLoadingAlbums(false);
        }
    };

    fetchAlbums();
  }, [currentUser, photo.uploadedBy]);


  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      {
        unit: '%',
        width: 90,
        height: 90,
      },
      width,
      height
    );
    // Set crop for later, but don't activate cropping mode
    setCrop(initialCrop);
  }

  const handleSave = async () => {
    setIsSaving(true);
    let finalUrl = photo.url;

    if (isCropping && completedCrop?.width && completedCrop?.height && imgRef.current && previewCanvasRef.current) {
        getCroppedImg(imgRef.current, completedCrop, previewCanvasRef.current);
        finalUrl = previewCanvasRef.current.toDataURL('image/jpeg');
    }

    try {
        const updatedMediaItem = await updateMediaItem(photo.id, {
            url: finalUrl,
            description,
            createdAt: editedDate,
            taggedUsers: taggedUserIds,
            albumId: selectedAlbumId,
        });
        if (updatedMediaItem) {
            onSave(updatedMediaItem);
        }
    } catch(err) {
        console.error("Failed to save photo:", err);
    } finally {
        setIsSaving(false);
        onClose();
    }
  };

  const formatDateForInput = (isoString: string) => {
    if (!isoString) return '';
    // Handles both 'Z' and timezone offsets
    return new Date(isoString).toISOString().slice(0, 16);
  };
  
  const toggleUserTag = (userId: string) => {
    setTaggedUserIds(currentTagged =>
        currentTagged.includes(userId)
            ? currentTagged.filter(id => id !== userId)
            : [...currentTagged, userId]
    );
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-lg flex flex-col max-h-[95vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold">Editar Foto</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-black flex items-center justify-center rounded-lg overflow-hidden">
            {isCropping ? (
                 <ReactCrop
                    crop={crop}
                    onChange={c => setCrop(c)}
                    onComplete={c => setCompletedCrop(c)}
                    className="max-h-[60vh]"
                 >
                    <img 
                        ref={imgRef}
                        src={photo.url} 
                        alt="Editor" 
                        onLoad={onImageLoad}
                        style={{ maxHeight: '60vh' }}
                        crossOrigin="anonymous"
                    />
                </ReactCrop>
            ) : (
                <img 
                    ref={imgRef}
                    src={photo.url} 
                    alt="Editor" 
                    onLoad={onImageLoad}
                    style={{ maxHeight: '60vh' }}
                    crossOrigin="anonymous"
                />
            )}
            <canvas ref={previewCanvasRef} className="hidden" />
          </div>
          <div className="space-y-4">
             {isCropping ? (
                <div className="p-3 border rounded-lg dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <p className="font-semibold text-sm">Modo de Corte Ativo</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ajuste a seleção na imagem. O corte será aplicado ao salvar.</p>
                    <button
                        onClick={() => {
                            setIsCropping(false);
                            setCompletedCrop(undefined); // Reset completed crop to prevent accidental save
                        }}
                        className="text-sm font-medium text-red-600 hover:underline"
                    >
                        Cancelar Corte
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsCropping(true)}
                    className="w-full text-center p-2 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                    Cortar Foto
                </button>
            )}

            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <textarea
                    id="description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white dark:bg-gray-800"
                    placeholder="Adicione uma descrição..."
                />
            </div>
            <div>
                <label htmlFor="album" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Álbum</label>
                <select
                    id="album"
                    value={selectedAlbumId}
                    onChange={(e) => setSelectedAlbumId(e.target.value)}
                    className="block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white dark:bg-gray-800"
                    disabled={isLoadingAlbums}
                >
                    {isLoadingAlbums ? (
                        <option>Carregando...</option>
                    ) : (
                        <>
                            <option value="">Sem Álbum</option>
                            {userAlbums.map(album => (
                                <option key={album.id} value={album.id}>{album.title}</option>
                            ))}
                        </>
                    )}
                </select>
            </div>
            <div>
                <label htmlFor="createdAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data e Hora</label>
                 <input
                    type="datetime-local"
                    id="createdAt"
                    value={formatDateForInput(editedDate)}
                    onChange={(e) => setEditedDate(new Date(e.target.value).toISOString())}
                    className="block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-brand-500 focus:border-brand-500 sm:text-sm bg-white dark:bg-gray-800"
                />
            </div>
            <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Marcar Pessoas</h3>
                <div className="max-h-36 overflow-y-auto space-y-1 border dark:border-gray-700 rounded-md p-2 scrollbar-hide">
                    {allUsers.map(user => (
                        <button
                            key={user.id}
                            onClick={() => toggleUserTag(user.id)}
                            className={`w-full flex items-center space-x-2 p-1 rounded-md text-left transition ${taggedUserIds.includes(user.id) ? 'bg-brand-100 dark:bg-brand-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                        >
                            <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />
                            <span className="text-sm">{user.name}</span>
                        </button>
                    ))}
                </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-800">
          <button onClick={onClose} className="text-gray-700 dark:text-gray-300 font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 mr-4">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-brand-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-600 disabled:bg-brand-300"
          >
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditorModal;