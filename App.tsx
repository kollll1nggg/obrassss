import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Role, MediaItem } from './types';

// Pages
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import SearchResultsPage from './pages/SearchResultsPage';
import EventsPage from './pages/EventsPage';
import BirthdaysPage from './pages/BirthdaysPage';
import MusicPage from './pages/MusicPage';
import AlbumPage from './pages/AlbumPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';


// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import FloatingActionButton from './components/FloatingActionButton';
import UploadModal from './components/UploadModal';
import StoryUploadModal from './components/StoryUploadModal';
import PhotoEditorModal from './components/PhotoEditorModal';
import BottomNavBar from './components/BottomNavBar';

const AppLayout: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [dataVersion, setDataVersion] = useState(0);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isStoryUploadModalOpen, setIsStoryUploadModalOpen] = useState(false);
    const [editingMediaItem, setEditingMediaItem] = useState<MediaItem | null>(null);

    const refreshData = () => setDataVersion(v => v + 1);

    const handleUploadComplete = (newMedia: MediaItem[]) => {
      setIsUploadModalOpen(false);
      refreshData();
      const firstImage = newMedia.find(item => item.type === 'image');
      if (firstImage) {
        setEditingMediaItem(firstImage);
      }
    };
    
    const handleAddClick = () => setIsUploadModalOpen(true);

    return (
      <div className="bg-gray-50 dark:bg-black text-gray-900 dark:text-white min-h-screen">
        {/* Fixed Position Elements - outside of the scrollable container */}
        <Sidebar />
        <Header />

        {/* Main scrollable content area */}
        <div className="lg:pl-64">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-20 md:pb-8">
                <Routes>
                    <Route path="/" element={<HomePage dataVersion={dataVersion} setEditingMediaItem={setEditingMediaItem} />} />
                    <Route path="/profile/:userId" element={<ProfilePage setEditingMediaItem={setEditingMediaItem} />} />
                    <Route path="/album/:albumId" element={<AlbumPage setEditingMediaItem={setEditingMediaItem} />} />
                    <Route path="/search" element={<SearchResultsPage setEditingMediaItem={setEditingMediaItem} />} />
                    
                    {/* Public & Protected Routes */}
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/birthdays" element={user ? <BirthdaysPage /> : <Navigate to="/login" replace />} />
                    <Route path="/music" element={<MusicPage />} />
                    <Route 
                      path="/admin" 
                      element={
                        user && user.role === Role.ADMIN_MASTER ? <AdminPage setEditingMediaItem={setEditingMediaItem} /> : <Navigate to="/" replace />
                      } 
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
        
        {/* Other Fixed Elements */}
        {user && (
            <BottomNavBar onAddClick={handleAddClick} />
        )}
        
        {user && location.pathname === '/' && (
            <FloatingActionButton
                onAddPhotoClick={() => setIsUploadModalOpen(true)}
                onAddStoryClick={() => setIsStoryUploadModalOpen(true)}
                className="hidden md:flex"
            />
        )}

        {/* Modals */}
        {isUploadModalOpen && user && (
            <UploadModal
                currentUser={user}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadComplete={handleUploadComplete}
            />
        )}
        {isStoryUploadModalOpen && user && (
            <StoryUploadModal
                currentUser={user}
                onClose={() => setIsStoryUploadModalOpen(false)}
                onUploadComplete={() => {
                    setIsStoryUploadModalOpen(false);
                    refreshData();
                }}
            />
        )}
        {editingMediaItem && editingMediaItem.type === 'image' && (
            <PhotoEditorModal
                photo={editingMediaItem}
                onClose={() => setEditingMediaItem(null)}
                onSave={() => {
                    setEditingMediaItem(null);
                    refreshData();
                }}
            />
        )}
      </div>
    );
};

const AppRouter: React.FC = () => {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/*" element={<AppLayout />} />
        </Routes>
    );
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    <AppRouter />
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;