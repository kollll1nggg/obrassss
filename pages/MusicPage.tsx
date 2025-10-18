import React from 'react';
import { MusicalNoteIcon } from '../components/icons/Icons';

const MusicPage: React.FC = () => {
    return (
        <div className="py-8 flex flex-col items-center justify-center text-center h-[60vh]">
             <MusicalNoteIcon className="h-24 w-24 text-gray-300 dark:text-gray-700 mb-4" />
            <h1 className="text-3xl font-bold mb-4">Página de Músicas</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-md">
                Esta área será dedicada ao streaming de músicas e sets. 
                Fique ligado para futuras atualizações!
            </p>
        </div>
    );
};

export default MusicPage;