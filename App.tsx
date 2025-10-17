import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Role, MediaItem } from './types';

// Pages
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import SearchResultsPage from './pages/SearchResultsPage'; // Import the new page

// Components
import Header from './components/Header';
import FloatingActionButton from './components/FloatingActionButton';
import UploadModal from './components/UploadModal';
import StoryUploadModal from './components/StoryUploadModal';
import PhotoEditorModal from './components/PhotoEditorModal';

// This component will contain the main layout and page routes
const AppLayout: React.FC = () => {
    const { user } = useAuth();

    // State management for modals and data refreshing
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
        // Automatically open the editor for the first uploaded photo
        setEditingMediaItem(firstImage);
      }
    };

    return (
        <div className="bg-gray-50 dark:bg-black text-gray-900 dark:text-white min-h-screen">
            <Header />
            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
                <Routes>
                    <Route path="/" element={<HomePage dataVersion={dataVersion} />} />
                    <Route path="/profile/:userId" element={<ProfilePage dataVersion={dataVersion} setEditingMediaItem={setEditingMediaItem} />} />
                    <Route path="/search" element={<SearchResultsPage setEditingMediaItem={setEditingMediaItem} />} />
                    <Route 
                      path="/admin" 
                      element={
                        user && user.role === Role.ADMIN_MASTER ? <AdminPage /> : <Navigate to="/" replace />
                      } 
                    />
                    {/* Fallback for any other route */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            {user && (
                <FloatingActionButton
                    onAddPhotoClick={() => setIsUploadModalOpen(true)}
                    onAddStoryClick={() => setIsStoryUploadModalOpen(true)}
                />
            )}

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
                    onSave={(updatedPhoto) => {
                        setEditingMediaItem(null);
                        refreshData();
                    }}
                />
            )}
        </div>
    );
};

// This component handles the top-level routing
const AppRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/*" element={<AppLayout />} />
        </Routes>
    );
};

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router>
                    <AppRoutes />
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;