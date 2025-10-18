import React, { useState, useEffect } from 'react';
import { XMarkIcon, CameraIcon } from './icons/Icons';
import { User, Story } from '../types';
import { addStory } from '../services/api';

interface StoryUploadModalProps {
  currentUser: User;
  onClose: () => void;
  onUploadComplete: (newStory: Story) => void;
}

const StoryUploadModal: React.FC<StoryUploadModalProps> = ({ currentUser, onClose, onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // Cleanup blob URL
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const newStory = await addStory(currentUser.id, file);
      onUploadComplete(newStory);
    } catch (error) {
      console.error("Failed to upload story:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-lg flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold">Adicionar Story</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 flex-grow flex flex-col items-center justify-center">
          {preview ? (
            <img src={preview} alt="Pré-visualização do Story" className="max-h-80 w-auto rounded-lg" />
          ) : (
            <div className="text-center">
              <CameraIcon className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
              <label htmlFor="story-upload" className="mt-4 cursor-pointer text-brand-600 dark:text-brand-400 font-semibold hover:underline inline-block">
                Escolher uma foto ou vídeo
              </label>
              <input id="story-upload" name="story-upload" type="file" accept="image/*,video/*" className="sr-only" onChange={handleFileChange} />
            </div>
          )}
        </div>

        <div className="flex justify-end items-center p-4 border-t border-gray-200 dark:border-gray-800">
          <button onClick={onClose} className="text-gray-700 dark:text-gray-300 font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 mr-4">
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="bg-brand-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-600 disabled:bg-brand-300"
          >
            {isUploading ? 'Publicando...' : 'Publicar Story'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryUploadModal;