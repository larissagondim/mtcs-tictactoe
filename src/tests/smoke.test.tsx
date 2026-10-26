import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders the lab title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /MCTS Lab/i })).toBeInTheDocument();
});
