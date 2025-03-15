import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the app without crashing', () => {
  render(<App />);
  // Initially the app should show the login page
  const welcomeText = screen.getByText(/Welcome to Go Chat/i);
  expect(welcomeText).toBeInTheDocument();
});
