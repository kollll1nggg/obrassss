import React from 'react';
import { MediaItem } from '../types';
import { PlayCircleIcon } from './icons/Icons';

interface PhotoGridProps {
  photos: MediaItem[];
  onPhotoClick: (photo: MediaItem) => void;
}

const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onPhotoClick }) => {
  if (!photos || photos.length === 0) {
    return <p className="text-gray-500 dark:text-gray-400">Nenhuma foto neste álbum ainda.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
      {photos.map(media => (
        <div 
          key={media.id} 
          className="relative aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
          onClick={() => onPhotoClick(media)}
        >
          {media.type === 'image' ? (
            <img 
              src={media.url} 
              alt={media.description}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-110 ${media.filter || ''}`}
              loading="lazy"
            />
          ) : (
            <>
              <video 
                src={media.url}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
                playsInline
              />
              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
                  <PlayCircleIcon className="h-12 w-12 text-white" />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default PhotoGrid;