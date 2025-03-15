import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  useColorModeValue,
  VStack,
  Badge,
  Avatar,
  HStack,
  Divider,
  IconButton,
  Input,
  FormControl
} from '@chakra-ui/react';
import { useChat } from '../../hooks/useChat';
import { useFriends } from '../../hooks/useFriends';
import { useAuth } from '../../contexts/AuthContext';

// Simple icons
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const Sidebar = ({ activeTab = 'chat', onTabChange, onClose }) => {
  const { user } = useAuth();
  const { selectedUser, selectUser, onlineUsers } = useChat();
  const { friends, pendingRequests, sendFriendRequest } = useFriends();
  
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  
  const handleTabChange = (index) => {
    onTabChange(index === 0 ? 'chat' : 'friends');
  };

  const handleSendFriendRequest = (e) => {
    e.preventDefault();
    if (!newFriendUsername.trim()) return;
    
    sendFriendRequest(newFriendUsername);
    setNewFriendUsername('');
    setShowAddFriend(false);
  };

  return (
    <Box h="full" bg={bgColor} overflowY="auto">
      {/* Mobile close button */}
      {onClose && (
        <Flex p={4} justifyContent="flex-end">
          <IconButton
            aria-label="Close sidebar"
            icon={<CloseIcon />}
            size="sm"
            onClick={onClose}
          />
        </Flex>
      )}
      
      <Tabs 
        index={activeTab === 'chat' ? 0 : 1} 
        onChange={handleTabChange}
        variant="enclosed"
        colorScheme="brand"
        h="full"
        display="flex"
        flexDirection="column"
      >
        <TabList px={4} borderBottom="1px" borderColor={borderColor}>
          <Tab 
            flex="1" 
            fontWeight="semibold"
            _selected={{ color: 'brand.500', borderColor: 'brand.500' }}
          >
            Chat
          </Tab>
          <Tab 
            flex="1" 
            fontWeight="semibold"
            _selected={{ color: 'brand.500', borderColor: 'brand.500' }}
            position="relative"
          >
            Friends
            {pendingRequests.length > 0 && (
              <Badge
                position="absolute"
                top={1}
                right={1}
                colorScheme="red"
                borderRadius="full"
                minW="18px"
                h="18px"
                fontSize="xs"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {pendingRequests.length}
              </Badge>
            )}
          </Tab>
        </TabList>

        <TabPanels flex="1" overflowY="auto">
          {/* Chat Tab */}
          <TabPanel p={0} h="full">
            <VStack align="stretch" spacing={0} h="full">
              <Box p={4} borderBottom="1px" borderColor={borderColor}>
                <Text fontSize="lg" fontWeight="bold" mb={2}>
                  Chats
                </Text>
                <Box
                  p={2}
                  borderRadius="md"
                  bg={!selectedUser ? 'brand.50' : 'transparent'}
                  border="1px"
                  borderColor={!selectedUser ? 'brand.500' : 'transparent'}
                  cursor="pointer"
                  onClick={() => selectUser(null)}
                  _hover={selectedUser ? { bg: hoverBg } : {}}
                  transition="all 0.2s"
                >
                  <HStack>
                    <Avatar size="sm" bg="gray.500" icon={<span>G</span>} />
                    <Text fontWeight={!selectedUser ? 'bold' : 'medium'}>
                      Group Chat
                    </Text>
                  </HStack>
                </Box>
              </Box>

              <Box p={4}>
                <Text fontSize="lg" fontWeight="bold" mb={2}>
                  Friends
                </Text>
                <VStack align="stretch" spacing={2}>
                  {friends.length > 0 ? (
                    friends.map(friend => (
                      <Box
                        key={friend.username}
                        p={2}
                        borderRadius="md"
                        bg={selectedUser === friend.username ? 'brand.50' : 'transparent'}
                        border="1px"
                        borderColor={selectedUser === friend.username ? 'brand.500' : 'transparent'}
                        cursor="pointer"
                        onClick={() => selectUser(friend.username)}
                        _hover={selectedUser !== friend.username ? { bg: hoverBg } : {}}
                        transition="all 0.2s"
                      >
                        <HStack>
                          <Avatar size="sm" name={friend.username} bg="brand.400" />
                          <Text fontWeight={selectedUser === friend.username ? 'bold' : 'medium'}>
                            {friend.username}
                          </Text>
                        </HStack>
                      </Box>
                    ))
                  ) : (
                    <Text fontSize="sm" color="gray.500">
                      No friends yet
                    </Text>
                  )}
                </VStack>
              </Box>

              <Box p={4}>
                <Text fontSize="lg" fontWeight="bold" mb={2}>
                  Online Users
                </Text>
                <VStack align="stretch" spacing={2}>
                  {onlineUsers
                    .filter(username => user && username !== user.username)
                    .map(username => (
                      <Box
                        key={username}
                        p={2}
                        borderRadius="md"
                        bg={selectedUser === username ? 'brand.50' : 'transparent'}
                        border="1px"
                        borderColor={selectedUser === username ? 'brand.500' : 'transparent'}
                        cursor="pointer"
                        onClick={() => selectUser(username)}
                        _hover={selectedUser !== username ? { bg: hoverBg } : {}}
                        transition="all 0.2s"
                      >
                        <HStack>
                          <Avatar size="sm" name={username} bg="green.400" />
                          <Box>
                            <Text fontWeight={selectedUser === username ? 'bold' : 'medium'}>
                              {username}
                            </Text>
                            {friends.some(f => f.username === username) && (
                              <Text fontSize="xs" color="green.500">
                                Friend
                              </Text>
                            )}
                          </Box>
                        </HStack>
                      </Box>
                    ))}
                </VStack>
              </Box>
            </VStack>
          </TabPanel>

          {/* Friends Tab */}
          <TabPanel p={4}>
            <VStack align="stretch" spacing={4}>
              <Flex justifyContent="space-between" align="center">
                <Text fontSize="lg" fontWeight="bold">
                  Friends Management
                </Text>
                <Button
                  size="sm"
                  colorScheme="brand"
                  onClick={() => setShowAddFriend(!showAddFriend)}
                >
                  {showAddFriend ? 'Cancel' : 'Add Friend'}
                </Button>
              </Flex>

              {/* Add friend form */}
              {showAddFriend && (
                <Box p={4} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor={borderColor}>
                  <form onSubmit={handleSendFriendRequest}>
                    <FormControl>
                      <Input
                        placeholder="Enter username"
                        value={newFriendUsername}
                        onChange={(e) => setNewFriendUsername(e.target.value)}
                        mb={2}
                      />
                    </FormControl>
                    <Button
                      type="submit"
                      colorScheme="brand"
                      size="sm"
                      width="full"
                      isDisabled={!newFriendUsername.trim()}
                    >
                      Send Request
                    </Button>
                  </form>
                </Box>
              )}

              {/* Friend requests section */}
              <Box>
                <Button
                  variant="outline"
                  width="full"
                  justifyContent="space-between"
                  onClick={() => setShowFriendRequests(!showFriendRequests)}
                  mb={2}
                  colorScheme={pendingRequests.length > 0 ? "red" : "gray"}
                >
                  <Text>Friend Requests</Text>
                  {pendingRequests.length > 0 && (
                    <Badge
                      colorScheme="red"
                      borderRadius="full"
                      minW="20px"
                      textAlign="center"
                    >
                      {pendingRequests.length}
                    </Badge>
                  )}
                </Button>

                {showFriendRequests && (
                  <Box p={4} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor={borderColor} mb={4}>
                    <Text fontSize="md" fontWeight="semibold" mb={2}>
                      Pending Requests
                    </Text>
                    {pendingRequests.length === 0 ? (
                      <Text fontSize="sm" color="gray.500">
                        No pending requests
                      </Text>
                    ) : (
                      <VStack align="stretch" spacing={2}>
                        {pendingRequests.map(request => (
                          <Flex
                            key={request.username}
                            justify="space-between"
                            align="center"
                            p={2}
                            borderBottom="1px"
                            borderColor={borderColor}
                          >
                            <HStack>
                              <Avatar size="xs" name={request.username} />
                              <Text>{request.username}</Text>
                            </HStack>
                            <HStack>
                              <Button size="xs" colorScheme="green">
                                Accept
                              </Button>
                              <Button size="xs" colorScheme="red" variant="outline">
                                Decline
                              </Button>
                            </HStack>
                          </Flex>
                        ))}
                      </VStack>
                    )}
                  </Box>
                )}
              </Box>

              <Divider />

              {/* Friends list */}
              <Box>
                <Text fontSize="md" fontWeight="semibold" mb={2}>
                  My Friends ({friends.length})
                </Text>
                {friends.length === 0 ? (
                  <Text fontSize="sm" color="gray.500">
                    You don't have any friends yet
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={2}>
                    {friends.map(friend => (
                      <Flex
                        key={friend.username}
                        justify="space-between"
                        align="center"
                        p={2}
                        borderRadius="md"
                        _hover={{ bg: hoverBg }}
                      >
                        <HStack>
                          <Avatar size="sm" name={friend.username} bg="brand.400" />
                          <Text>{friend.username}</Text>
                        </HStack>
                        <HStack>
                          <Button
                            size="xs"
                            colorScheme="brand"
                            onClick={() => {
                              selectUser(friend.username);
                              onTabChange('chat');
                            }}
                          >
                            Chat
                          </Button>
                          <Button
                            size="xs"
                            colorScheme="red"
                            variant="outline"
                          >
                            Remove
                          </Button>
                        </HStack>
                      </Flex>
                    ))}
                  </VStack>
                )}
              </Box>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Sidebar; 