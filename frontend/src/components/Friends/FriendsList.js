import React from 'react';
import { useFriends } from '../../hooks/useFriends';

const FriendsList = ({ onSelectUser }) => {
  const { friends, loading, removeFriend } = useFriends();

  const handleRemoveFriend = async (username, e) => {
    e.stopPropagation(); // Prevent selecting the friend when clicking remove
    await removeFriend(username);
  };

  const handleSelectFriend = (username) => {
    if (onSelectUser) {
      onSelectUser(username);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading friends...</div>;
  }

  return (
    <div className="friends-list">
      <h2 className="text-xl font-bold mb-4 px-4">Friends</h2>
      
      {friends.length === 0 ? (
        <p className="text-gray-500 p-4 text-center">You don't have any friends yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {friends.map(friend => (
            <li 
              key={friend.username} 
              className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
              onClick={() => handleSelectFriend(friend.username)}
            >
              <div>
                <p className="font-medium">{friend.username}</p>
                <p className="text-sm text-gray-500">
                  {friend.email && `${friend.email}`}
                </p>
              </div>
              <div className="flex items-center">
                <button
                  onClick={(e) => handleRemoveFriend(friend.username, e)}
                  className="ml-2 text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FriendsList; 