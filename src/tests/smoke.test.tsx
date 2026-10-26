import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

test('renders the lab title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /MCTS Lab/i })).toBeInTheDocument();
});

test('the AI answers a human move with a legal MCTS move', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: '100' }));
  const board = screen.getByRole('grid', { name: /Tabuleiro/ });
  await user.click(within(board).getByRole('gridcell', { name: /^B2/ }));
  expect(within(board).getByRole('gridcell', { name: 'B2: X' })).toBeInTheDocument();
  await waitFor(() => expect(within(board).getAllByRole('gridcell', { name: /: O$/ })).toHaveLength(1), { timeout: 5000 });
  expect(screen.getByRole('status')).toHaveTextContent(/Sua vez/);
});

test('cells cannot be played while it is the AI turn', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('radio', { name: 'O começa' }));
  const board = screen.getByRole('grid', { name: /Tabuleiro/ });
  expect(within(board).getByRole('gridcell', { name: 'A1: vazia' })).toBeDisabled();
});
