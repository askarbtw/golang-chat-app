import React from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Avatar,
  useColorModeValue,
  Input,
  FormControl,
  HStack
} from '@chakra-ui/react';
import { useChat } from '../../hooks/useChat';
import { useFriends } from '../../hooks/useFriends';
import { useAuth } from '../../contexts/AuthContext';
import MessageList from './MessageList';

const ChatInterface = ({ activeTab }) => {
  const { selectedUser, filteredMessages, newMessage, setNewMessage, sendMessage, messagesEndRef } = useChat();
  const { friends, sendFriendRequest } = useFriends();
  const { user } = useAuth();
  
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const inputBg = useColorModeValue('white', 'gray.700');

  const isUserFriend = () => {
    return selectedUser && friends.some(friend => friend.username === selectedUser);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage);
    }
  };

  const handleAddFriend = () => {
    if (selectedUser) {
      sendFriendRequest(selectedUser);
    }
  };

  if (activeTab !== 'chat') {
    // If not in chat tab, show a placeholder or info message
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        h="full"
        p={8}
        bg={useColorModeValue('gray.50', 'gray.800')}
      >
        <Text fontSize="xl" fontWeight="bold" color="brand.500" mb={4}>
          Friends Management
        </Text>
        <Text textAlign="center" color="gray.500">
          Use the sidebar to manage your friends and friend requests.
        </Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" h="full">
      {/* Chat Header */}
      <Box 
        p={4} 
        bg={headerBg}
        borderBottom="1px" 
        borderColor={borderColor}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <HStack>
          <Avatar 
            size="sm" 
            name={selectedUser || 'Group'} 
            bg={selectedUser ? 'brand.400' : 'gray.500'} 
          />
          <Text fontWeight="bold" fontSize="lg">
            {selectedUser ? `Chat with ${selectedUser}` : 'Group Chat'}
          </Text>
        </HStack>

        {selectedUser && !isUserFriend() && (
          <Button
            colorScheme="brand"
            variant="outline"
            size="sm"
            onClick={handleAddFriend}
            leftIcon={<span>+</span>}
          >
            Add Friend
          </Button>
        )}
      </Box>

      {/* Messages Area */}
      <Box
        flex="1"
        overflowY="auto"
        bg={useColorModeValue('gray.50', 'gray.800')}
        p={4}
      >
        <MessageList messages={filteredMessages} />
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box p={4} bg={headerBg} borderTop="1px" borderColor={borderColor}>
        <form onSubmit={handleSendMessage}>
          <Flex>
            <FormControl>
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                bg={inputBg}
                borderColor={borderColor}
                _focus={{ borderColor: 'brand.500' }}
                size="md"
                autoComplete="off"
              />
            </FormControl>
            <Button
              type="submit"
              colorScheme="brand"
              ml={2}
              isDisabled={!newMessage.trim()}
            >
              Send
            </Button>
          </Flex>
        </form>
      </Box>
    </Flex>
  );
};

export default ChatInterface; 