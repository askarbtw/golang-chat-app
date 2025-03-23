import React, { useState } from 'react';
import FriendsList from './FriendsList';
import FriendRequests from './FriendRequests';
import AddFriend from './AddFriend';

const Friends = ({ onSelectUser }) => {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' or 'requests'

  return (
    <div className="friends-container h-full flex flex-col">
      <div className="tabs flex border-b">
        <button
          className={`px-4 py-2 flex-1 font-medium ${
            activeTab === 'friends' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('friends')}
        >
          My Friends
        </button>
        <button
          className={`px-4 py-2 flex-1 font-medium ${
            activeTab === 'requests' 
              ? 'border-b-2 border-blue-500 text-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('requests')}
        >
          Friend Requests
        </button>
      </div>

      <div className="p-4">
        <AddFriend />
      </div>

      <div className="flex-grow overflow-y-auto">
        {activeTab === 'friends' ? (
          <FriendsList onSelectUser={onSelectUser} />
        ) : (
          <FriendRequests />
        )}
      </div>
    </div>
  );
};

export default Friends; 