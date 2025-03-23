import React, { useState } from 'react';
import { useFriends } from '../../hooks/useFriends';

const AddFriend = () => {
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const { loading, sendFriendRequest } = useFriends();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newFriendUsername.trim()) return;
    
    const success = await sendFriendRequest(newFriendUsername);
    if (success) {
      setNewFriendUsername('');
    }
  };

  return (
    <div className="add-friend p-4 bg-gray-50 rounded-lg mb-4">
      <h3 className="text-lg font-semibold mb-2">Add New Friend</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            placeholder="Username"
            value={newFriendUsername}
            onChange={(e) => setNewFriendUsername(e.target.value)}
            className="border border-gray-300 rounded p-2 flex-grow"
            disabled={loading}
          />
          
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
            disabled={loading || !newFriendUsername.trim()}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddFriend; 