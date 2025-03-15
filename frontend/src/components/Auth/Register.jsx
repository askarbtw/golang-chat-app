import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
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
  Flex
} from '@chakra-ui/react';
import { useAuth } from '../../contexts/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({ username: '', password: '', email: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    isValid: false,
    message: ''
  });
  const { register, error } = useAuth();
  const navigate = useNavigate();
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  const validatePassword = (password) => {
    if (password.length < 6) {
      return { isValid: false, message: 'Password must be at least 6 characters' };
    }
    return { isValid: true, message: 'Password is valid' };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    if (name === 'password') {
      setPasswordValidation(validatePassword(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      return;
    }
    
    const success = await register(formData);
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
                Create an Account
              </Heading>
              <Text color="gray.500">
                Join Go Chat and connect with friends
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
                    placeholder="Choose a username"
                    size="lg"
                    autoComplete="username"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Email (Optional)</FormLabel>
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Your email address"
                    size="lg"
                    autoComplete="email"
                  />
                  <FormHelperText>
                    We'll never share your email with anyone.
                  </FormHelperText>
                </FormControl>

                <FormControl isRequired isInvalid={formData.password.length > 0 && !passwordValidation.isValid}>
                  <FormLabel>Password</FormLabel>
                  <InputGroup size="lg">
                    <Input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                      autoComplete="new-password"
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
                  <FormHelperText color={passwordValidation.isValid ? 'green.500' : 'red.500'}>
                    {formData.password && passwordValidation.message}
                  </FormHelperText>
                </FormControl>

                <Button
                  type="submit"
                  colorScheme="brand"
                  width="full"
                  size="lg"
                  mt={4}
                  isDisabled={!formData.username || !formData.password || !passwordValidation.isValid}
                >
                  Create Account
                </Button>
              </VStack>
            </form>

            <Text textAlign="center">
              Already have an account?{' '}
              <Link to="/login">
                <Text as="span" color="brand.500" fontWeight="semibold">
                  Sign In
                </Text>
              </Link>
            </Text>
          </VStack>
        </Box>
      </Container>
    </Flex>
  );
};

export default Register; 