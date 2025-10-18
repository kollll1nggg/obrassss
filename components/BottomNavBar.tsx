import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeIcon, CalendarDaysIcon, CakeIcon, MusicalNoteIcon, PlusCircleIcon } from './icons/Icons';

interface BottomNavBarProps {
  onAddClick: () => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ onAddClick }) => {
  const { user } = useAuth();

  if (!user) {
    return null; // Don't show for logged-out users
  }

  const commonClasses = "flex flex-col items-center justify-center flex-1 py-2 text-gray-500 dark:text-gray-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors";
  const activeClasses = "text-brand-500 dark:text-brand-400";
  
  const NavItem: React.FC<{ to: string, icon: React.FC<any> }> = ({ to, icon: Icon }) => (
     <NavLink to={to} className={({ isActive }) => `${commonClasses} ${isActive ? activeClasses : ''}`}>
        <Icon className="h-7 w-7" />
     </NavLink>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-around items-center z-50 md:hidden shadow-[0_-2px_5px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_5px_rgba(0,0,0,0.2)]">
      <NavItem to="/" icon={HomeIcon} />
      <NavItem to="/events" icon={CalendarDaysIcon} />
      
      <button 
        onClick={onAddClick} 
        className="relative -top-4 bg-brand-500 text-white rounded-full p-3 shadow-lg hover:bg-brand-600 transition-transform hover:scale-110"
        aria-label="Adicionar mídia"
      >
          <PlusCircleIcon className="h-8 w-8" />
      </button>
      
      <NavItem to="/birthdays" icon={CakeIcon} />
      <NavItem to="/music" icon={MusicalNoteIcon} />
    </nav>
  );
};

export default BottomNavBar;