import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthClientLoading } from '../hooks/useAuthClientLoading';
import { AuthClient } from '@subauth/client';

describe('useAuthClientLoading', () => {
  it('should return false when no authClient is provided', () => {
    const { result } = renderHook(() => useAuthClientLoading());

    expect(result.current).toBe(false);
  });

  it('should return initial isLoading state from authClient', () => {
    const mockAuthClient = {
      getState: vi.fn().mockReturnValue({ isLoading: true }),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as AuthClient;

    const { result } = renderHook(() => useAuthClientLoading(mockAuthClient));

    expect(result.current).toBe(true);
  });

  it('should subscribe to authClient state changes', () => {
    const mockUnsubscribe = vi.fn();
    const mockSubscribe = vi.fn().mockReturnValue(mockUnsubscribe);
    const mockAuthClient = {
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: mockSubscribe,
    } as unknown as AuthClient;

    renderHook(() => useAuthClientLoading(mockAuthClient));

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('should update loading state when authClient state changes', () => {
    let stateListener: ((state: { isLoading: boolean }) => void) | null = null;
    const mockAuthClient = {
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn((listener) => {
        stateListener = listener;
        return () => {};
      }),
    } as unknown as AuthClient;

    const { result } = renderHook(() => useAuthClientLoading(mockAuthClient));

    expect(result.current).toBe(false);

    act(() => {
      stateListener?.({ isLoading: true });
    });

    expect(result.current).toBe(true);
  });

  it('should unsubscribe when unmounted', () => {
    const mockUnsubscribe = vi.fn();
    const mockAuthClient = {
      getState: vi.fn().mockReturnValue({ isLoading: false }),
      subscribe: vi.fn().mockReturnValue(mockUnsubscribe),
    } as unknown as AuthClient;

    const { unmount } = renderHook(() => useAuthClientLoading(mockAuthClient));

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});