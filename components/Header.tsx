import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { HomeIcon, UserIcon, SunIcon, MoonIcon, CogIcon, ArrowLeftOnRectangleIcon, MagnifyingGlassIcon } from './icons/Icons';
import { Role } from '../types';

const Header: React.FC = () => {
  const { user, login, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const loginDropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      setLoginDropdownOpen(false);
      setEmail('');
      setPassword('');
    } else {
      setError('Credenciais inválidas. Tente novamente.');
    }
  };
  
  const handleLogout = () => {
    logout();
    setProfileDropdownOpen(false);
    navigate('/');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      // Optional: Clear search bar after search
      // setSearchQuery('');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (loginDropdownRef.current && !loginDropdownRef.current.contains(event.target as Node)) {
        setLoginDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold text-gray-900 dark:text-white">
            OBRAS LTDA
          </Link>

          {/* Search Bar (Desktop) */}
          <div className="hidden sm:flex items-center">
            <form onSubmit={handleSearchSubmit} className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent py-2 px-2 text-sm focus:outline-none w-full"
              />
            </form>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
             <Link to="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                <HomeIcon className="h-7 w-7" />
             </Link>
             <button onClick={toggleTheme} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
             </button>
             
             {user ? (
                // Profile Dropdown for authenticated user
                <div className="relative" ref={profileDropdownRef}>
                    <button onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}>
                        <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-brand-500" />
                    </button>

                    {profileDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5">
                            <Link to={`/profile/${user.id}`} className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                               <UserIcon className="h-5 w-5 mr-2" /> Perfil
                            </Link>
                            {user.role === Role.ADMIN_MASTER && (
                              <Link to="/admin" className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                 <CogIcon className="h-5 w-5 mr-2" /> Admin
                              </Link>
                            )}
                            <button onClick={handleLogout} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <ArrowLeftOnRectangleIcon className="h-5 w-5 mr-2" /> Sair
                            </button>
                        </div>
                    )}
                </div>
             ) : (
                // Login button and dropdown for guest user
                <div className="relative" ref={loginDropdownRef}>
                    <button onClick={() => setLoginDropdownOpen(!loginDropdownOpen)} className="px-4 py-2 text-sm font-semibold bg-brand-500 text-white rounded-lg hover:bg-brand-600">
                        Entrar
                    </button>
                    {loginDropdownOpen && (
                         <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg p-6 ring-1 ring-black ring-opacity-5">
                            <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-1">OBRAS LTDA</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">Rede social privada, apenas para noias.</p>
                            <form onSubmit={handleLoginSubmit}>
                                <div className="mb-3">
                                    <input
                                        className="appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 leading-tight focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        id="email-header"
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="mb-4">
                                    <input
                                        className="appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 leading-tight focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        id="password-header"
                                        type="password"
                                        placeholder="Senha (qualquer uma)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                                {error && <p className="text-red-500 text-xs italic mb-4 text-center">{error}</p>}
                                <button
                                    className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:bg-brand-300"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading ? 'Entrando...' : 'Entrar'}
                                </button>
                            </form>
                             <div className="text-center mt-4 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
                                <p className='mb-2'>Use um dos emails: master@obras.com, admin@obras.com, membro@obras.com, leitor@obras.com</p>
                                <p>Não tem uma conta? <span className="font-semibold text-brand-600 dark:text-brand-400 cursor-pointer">Fale com o admin.</span></p>
                            </div>
                        </div>
                    )}
                </div>
             )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;