import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon, SquaresPlusIcon, PlusCircleIcon } from './icons/Icons';

interface FloatingActionButtonProps {
  onAddPhotoClick: () => void;
  onAddStoryClick: () => void;
  className?: string;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ 
  onAddPhotoClick,
  onAddStoryClick,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleActionClick = (action: () => void) => {
    action();
    setIsOpen(false);
  }

  const menuItems = [
    { label: 'Criar Story', icon: PlusCircleIcon, action: () => handleActionClick(onAddStoryClick) },
    { label: 'Adicionar Foto/Vídeo', icon: SquaresPlusIcon, action: () => handleActionClick(onAddPhotoClick) },
  ];

  return (
    <div ref={menuRef} className={`fixed bottom-6 right-6 z-40 ${className}`}>
      <div className={`flex flex-col items-center space-y-3 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        {menuItems.map((item, index) => (
           <div key={item.label} className="flex items-center space-x-3">
             <span className="bg-white dark:bg-gray-800 text-sm font-semibold px-3 py-1 rounded-md shadow-lg">{item.label}</span>
             <button
               onClick={item.action}
               className="bg-white dark:bg-gray-700 h-12 w-12 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition"
             >
               <item.icon className="h-6 w-6 text-gray-800 dark:text-gray-100" />
             </button>
           </div>
        ))}
      </div>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="mt-4 bg-brand-500 hover:bg-brand-600 text-white h-16 w-16 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-300 hover:scale-110"
        aria-label="Criar novo conteúdo"
      >
        <div className={`transform transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>
          <PlusIcon className="h-8 w-8" />
        </div>
      </button>
    </div>
  );
};

export default FloatingActionButton;