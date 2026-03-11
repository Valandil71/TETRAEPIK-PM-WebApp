import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import GlobalError from '@/app/error';

vi.mock('@/utils/toastHelpers', () => ({
  getUserFriendlyError: vi.fn(() => 'Friendly message'),
}));

describe('GlobalError', () => {
  it('renders user-friendly message', () => {
    render(
      <GlobalError
        error={new Error('boom') as Error & { digest?: string }}
        reset={vi.fn()}
      />
    );

    expect(screen.getByText('Friendly message')).toBeInTheDocument();
  });

  it('calls reset when clicking Try Again', () => {
    const reset = vi.fn();

    render(
      <GlobalError
        error={new Error('boom') as Error & { digest?: string }}
        reset={reset}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

