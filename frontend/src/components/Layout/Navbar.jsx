import React from 'react';
import {
  Box,
  Flex,
  Text,
  IconButton,
  Button,
  Stack,
  useColorModeValue,
  useBreakpointValue,
  Avatar,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider
} from '@chakra-ui/react';
import { useAuth } from '../../contexts/AuthContext';

// Simple icons using JSX
const HamburgerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  
  return (
    <Box
      bg={useColorModeValue('brand.500', 'gray.900')}
      color={useColorModeValue('white', 'white')}
      boxShadow="sm"
      position="relative"
      zIndex="1"
    >
      <Flex
        h={16}
        alignItems="center"
        justifyContent="space-between"
        maxW="full"
        mx="auto"
        px={4}
      >
        <Flex alignItems="center">
          <IconButton
            size="md"
            icon={<HamburgerIcon />}
            aria-label="Open Menu"
            display={{ base: 'flex', md: 'none' }}
            onClick={onMenuClick}
            variant="ghost"
            _hover={{ bg: 'brand.600' }}
            color="white"
          />
          <Text
            fontFamily="heading"
            fontWeight="bold"
            fontSize="2xl"
            ml={{ base: 2, md: 0 }}
          >
            Go Chat
          </Text>
        </Flex>

        <Flex alignItems="center">
          <Stack direction="row" spacing={4} align="center">
            <Text 
              display={{ base: 'none', md: 'block' }}
              fontWeight="medium"
            >
              {user && `Welcome, ${user.username}`}
            </Text>
            
            <Menu>
              <MenuButton
                as={Button}
                rounded="full"
                variant="link"
                cursor="pointer"
                minW={0}
              >
                <Avatar
                  size="sm"
                  name={user ? user.username : ''}
                  bg="brand.300"
                  color="white"
                />
              </MenuButton>
              <MenuList 
                bg={useColorModeValue('white', 'gray.800')}
                color={useColorModeValue('gray.800', 'white')}
                borderColor={useColorModeValue('gray.200', 'gray.700')}
              >
                <Text p={3} fontWeight="medium" textAlign="center">
                  {user && user.username}
                </Text>
                <MenuDivider />
                <MenuItem onClick={logout}>Logout</MenuItem>
              </MenuList>
            </Menu>
          </Stack>
        </Flex>
      </Flex>
    </Box>
  );
};

export default Navbar; 