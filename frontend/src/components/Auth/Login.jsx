import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Heading,
  Text,
  Alert,
  AlertIcon,
  InputGroup,
  InputRightElement,
  useColorModeValue,
  Container,
  Flex,
  Image
} from '@chakra-ui/react';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(formData);
    if (success) navigate('/chat');
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg={useColorModeValue('gray.50', 'gray.900')}
    >
      <Container maxW="md" p={0}>
        <Box
          bg={bgColor}
          p={8}
          borderRadius="lg"
          boxShadow="lg"
          border="1px"
          borderColor={borderColor}
        >
          <VStack spacing={6} align="stretch">
            <Box textAlign="center">
              <Heading size="xl" fontWeight="bold" color="brand.500" mb={2}>
                Welcome to Go Chat
              </Heading>
              <Text color="gray.500">
                Sign in to connect with friends
              </Text>
            </Box>

            {error && (
              <Alert status="error" borderRadius="md">
                <AlertIcon />
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Username</FormLabel>
                  <Input
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="Enter your username"
                    size="lg"
                    autoComplete="username"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Password</FormLabel>
                  <InputGroup size="lg">
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <InputRightElement width="4.5rem">
                      <Button
                        h="1.75rem"
                        size="sm"
                        onClick={() => setShowPassword(!showPassword)}
                        variant="ghost"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </Button>
                    </InputRightElement>
                  </InputGroup>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="brand"
                  width="full"
                  size="lg"
                  mt={4}
                  isDisabled={!formData.username || !formData.password}
                >
                  Sign In
                </Button>
              </VStack>
            </form>

            <Text textAlign="center">
              Don't have an account?{' '}
              <Link to="/register">
                <Text as="span" color="brand.500" fontWeight="semibold">
                  Register Now
                </Text>
              </Link>
            </Text>
          </VStack>
        </Box>
      </Container>
    </Flex>
  );
};

export default Login; 