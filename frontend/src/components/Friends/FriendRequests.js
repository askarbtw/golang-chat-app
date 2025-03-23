import React from 'react';
import { useFriends } from '../../hooks/useFriends';

const FriendRequests = () => {
  const { pendingRequests, loading, acceptFriendRequest, declineFriendRequest } = useFriends();

  const handleAccept = async (username) => {
    await acceptFriendRequest(username);
  };

  const handleDecline = async (username) => {
    await declineFriendRequest(username);
  };

  if (loading) {
    return <div className="p-4 text-center">Loading requests...</div>;
  }

  return (
    <div className="friend-requests">
      <h2 className="text-xl font-bold mb-4 px-4">Friend Requests</h2>
      
      {pendingRequests.length === 0 ? (
        <p className="text-gray-500 p-4 text-center">No pending friend requests.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {pendingRequests.map(request => (
            <li key={request.username} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{request.username}</p>
                  {request.email && (
                    <p className="text-sm text-gray-500">{request.email}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAccept(request.username)}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(request.username)}
                    className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FriendRequests; 