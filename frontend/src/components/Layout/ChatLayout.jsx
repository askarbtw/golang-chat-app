import React, { useState } from 'react';
import { Box, Flex, useDisclosure, Drawer, DrawerContent, useColorModeValue, useBreakpointValue } from '@chakra-ui/react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ChatInterface from '../Chat/ChatInterface';

const ChatLayout = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'friends'
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (isMobile) {
      onClose();
    }
  };

  return (
    <Flex direction="column" h="100vh">
      <Navbar onMenuClick={onOpen} />
      
      <Flex flex="1" overflow="hidden">
        {/* Mobile drawer for sidebar */}
        {isMobile && (
          <Drawer
            isOpen={isOpen}
            placement="left"
            onClose={onClose}
            returnFocusOnClose={false}
          >
            <DrawerContent>
              <Sidebar 
                activeTab={activeTab} 
                onTabChange={handleTabChange} 
                onClose={onClose}
              />
            </DrawerContent>
          </Drawer>
        )}
        
        {/* Desktop sidebar - always visible */}
        {!isMobile && (
          <Box
            w="300px"
            bg={useColorModeValue('white', 'gray.900')}
            borderRight="1px"
            borderColor={useColorModeValue('gray.200', 'gray.700')}
            display={{ base: 'none', md: 'block' }}
          >
            <Sidebar 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
            />
          </Box>
        )}
        
        {/* Main content area */}
        <Box flex="1" overflow="hidden">
          <ChatInterface activeTab={activeTab} />
        </Box>
      </Flex>
    </Flex>
  );
};

export default ChatLayout; 