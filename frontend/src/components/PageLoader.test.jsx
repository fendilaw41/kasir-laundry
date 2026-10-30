import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageLoader from './PageLoader';

describe('PageLoader Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders template preloader with #preloader and .circle-spinner on initial mount', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <PageLoader minDuration={400} />
      </MemoryRouter>
    );

    const preloader = container.querySelector('#preloader');
    expect(preloader).not.toBeNull();
    expect(preloader.querySelector('.circle-spinner')).not.toBeNull();
    expect(preloader.querySelector('.circle')).not.toBeNull();
  });

  it('fades out and removes loading after minDuration', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <PageLoader minDuration={400} />
      </MemoryRouter>
    );

    expect(container.querySelector('#preloader')).not.toBeNull();

    // Fast-forward past minDuration (400ms) and fade duration (250ms)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // During fade-out, preloader has opacity 0
    let preloader = container.querySelector('#preloader');
    expect(preloader.style.opacity).toBe('0');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    // After fade-out, preloader unmounts
    preloader = container.querySelector('#preloader');
    expect(preloader).toBeNull();
  });
});

