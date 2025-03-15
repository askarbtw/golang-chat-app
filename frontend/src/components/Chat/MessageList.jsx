import React from 'react';
import {
  Box,
  Text,
  Avatar,
  Flex,
  useColorModeValue,
  VStack
} from '@chakra-ui/react';
import { useAuth } from '../../contexts/AuthContext';

const MessageList = ({ messages }) => {
  const { user } = useAuth();
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // If no messages, show a placeholder
  if (!messages || messages.length === 0) {
    return (
      <Flex 
        direction="column" 
        align="center" 
        justify="center" 
        h="full" 
        minH="200px"
        color="gray.500"
      >
        <Text>No messages yet</Text>
        <Text fontSize="sm" mt={2}>
          Send a message to start the conversation
        </Text>
      </Flex>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {messages.map((message, index) => {
        const isCurrentUser = message.username === user?.username;
        
        return (
          <Flex
            key={index}
            justify={isCurrentUser ? 'flex-end' : 'flex-start'}
            mb={2}
          >
            <Flex
              maxW={{ base: '70%', md: '60%' }}
              direction={isCurrentUser ? 'row-reverse' : 'row'}
            >
              {!isCurrentUser && (
                <Avatar
                  size="sm"
                  name={message.username}
                  bg={useColorModeValue('brand.400', 'brand.300')}
                  mr={isCurrentUser ? 0 : 2}
                  ml={isCurrentUser ? 2 : 0}
                />
              )}
              
              <Box
                bg={isCurrentUser 
                  ? useColorModeValue('brand.500', 'brand.400') 
                  : useColorModeValue('gray.100', 'gray.700')
                }
                color={isCurrentUser ? 'white' : useColorModeValue('gray.800', 'white')}
                px={4}
                py={2}
                borderRadius="lg"
                boxShadow="sm"
              >
                {!isCurrentUser && (
                  <Text 
                    fontWeight="bold" 
                    fontSize="sm" 
                    mb={1} 
                    color={useColorModeValue('brand.600', 'brand.200')}
                  >
                    {message.username}
                  </Text>
                )}
                
                <Text>{message.content}</Text>
                
                <Text 
                  fontSize="xs" 
                  opacity={0.8} 
                  textAlign="right" 
                  mt={1}
                >
                  {formatTime(message.timestamp)}
                </Text>
              </Box>
            </Flex>
          </Flex>
        );
      })}
    </VStack>
  );
};

export default MessageList; 