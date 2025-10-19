import React from 'react';
import { DiscIcon } from '../components/icons/Icons';

const MusicPage: React.FC = () => {
  return (
    <div className="py-8 text-center flex flex-col items-center justify-center h-full min-h-[60vh]">
      <DiscIcon className="h-24 w-24 text-gray-300 dark:text-gray-700 mb-6 animate-pulse" />
      <h1 className="text-3xl font-bold mb-2">Música</h1>
      <p className="text-lg text-gray-500 dark:text-gray-400">Em Breve</p>
      <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-md">
        Estamos preparando uma experiência musical incrível para a OBRAS. Fique ligado!
      </p>
    </div>
  );
};

export default MusicPage;