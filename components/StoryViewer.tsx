import React, { useState, useEffect, useCallback } from 'react';
import { Story, User } from '../types';
import { XMarkIcon } from './icons/Icons';

interface StoryViewerProps {
  user: User;
  stories: Story[];
  onClose: () => void;
}

const STORY_DURATION = 5000; // 5 seconds per story

const StoryViewer: React.FC<StoryViewerProps> = ({ user, stories, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const goToNextStory = useCallback(() => {
    setCurrentIndex(prevIndex => {
      if (prevIndex < stories.length - 1) {
        return prevIndex + 1;
      }
      onClose(); // Close viewer after the last story
      return prevIndex;
    });
  }, [stories.length, onClose]);

  const goToPreviousStory = () => {
    setCurrentIndex(prevIndex => Math.max(0, prevIndex - 1));
  };
  
  useEffect(() => {
    setProgress(0); // Reset progress when story changes
    const timer = setTimeout(goToNextStory, STORY_DURATION);
    
    const interval = setInterval(() => {
        setProgress(p => p + (100 / (STORY_DURATION / 100)));
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [currentIndex, goToNextStory]);
  
  const handleNavigationClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, currentTarget } = e;
    const { left, width } = currentTarget.getBoundingClientRect();
    const clickPosition = clientX - left;
    
    // Click on the left 40% of the screen to go back, right 60% to go forward
    if (clickPosition < width * 0.4) {
      goToPreviousStory();
    } else {
      goToNextStory();
    }
  };

  if (!stories || stories.length === 0) {
    onClose();
    return null;
  }
  
  const currentStory = stories[currentIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={handleNavigationClick}>
      <div className="relative w-full max-w-sm h-[90vh] bg-gray-800 rounded-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Progress Bars */}
        <div className="absolute top-2 left-2 right-2 flex items-center space-x-1 z-20">
            {stories.map((_, index) => (
                <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-white"
                        style={{ width: `${index < currentIndex ? 100 : (index === currentIndex ? progress : 0)}%` }}
                    />
                </div>
            ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-4 flex items-center space-x-2 z-20">
            <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full" />
            <span className="text-white font-semibold text-sm">{user.name}</span>
            <span className="text-white/70 text-xs">{new Date(currentStory.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        
        <button onClick={onClose} className="absolute top-4 right-4 text-white z-20">
            <XMarkIcon className="h-7 w-7" />
        </button>

        {/* Story Image */}
        <img src={currentStory.filePath} alt={`Story by ${user.name}`} className="w-full h-full object-contain" />
      </div>
    </div>
  );
};

export default StoryViewer;