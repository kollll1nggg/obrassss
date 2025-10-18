import React from 'react';
import { Story, User } from '../types';

interface StoryReelProps {
  storiesByUser: { [key: string]: Story[] };
  users: User[];
  onUserClick: (userId: string) => void;
}

const StoryReel: React.FC<StoryReelProps> = ({ storiesByUser, users, onUserClick }) => {
  // Create a map for quick user lookup
  // FIX: Explicitly type the Map to ensure correct type inference for `user`.
  const userMap = new Map<string, User>(users.map(u => [u.id, u]));
  const userIdsWithStories = Object.keys(storiesByUser);

  if (userIdsWithStories.length === 0) {
    return null; // Don't render if there are no stories
  }

  return (
    <div className="w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-3">
      <div className="flex space-x-4 overflow-x-auto px-4 scrollbar-hide">
        {userIdsWithStories.map(userId => {
          const user = userMap.get(userId);
          if (!user) return null;

          return (
            <div key={userId} className="flex flex-col items-center space-y-1 flex-shrink-0">
              <button onClick={() => onUserClick(userId)} className="focus:outline-none">
                <div className="h-16 w-16 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-full w-full rounded-full object-cover border-2 border-white dark:border-gray-900"
                  />
                </div>
              </button>
              <p className="text-xs text-center truncate w-16">{user.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StoryReel;