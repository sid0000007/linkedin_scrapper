import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSelfPing, type SelfPingLogger } from '../../../src/utils/self-ping';

const stubLogger: SelfPingLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startSelfPing', () => {
  it('does nothing when no url is configured', () => {
    const fetchImpl = vi.fn();
    const stop = startSelfPing({ logger: stubLogger, fetchImpl });

    vi.advanceTimersByTime(60 * 60_000);
    stop();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('pings /healthz on its own base url on each interval tick', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200 });
    const stop = startSelfPing({
      url: 'https://my-service.onrender.com',
      logger: stubLogger,
      fetchImpl,
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(3000);
    stop();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledWith('https://my-service.onrender.com/healthz');
  });

  it('logs and swallows a failed ping instead of throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const stop = startSelfPing({
      url: 'https://my-service.onrender.com',
      logger: stubLogger,
      fetchImpl,
      intervalMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    stop();

    expect(stubLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'https://my-service.onrender.com/healthz' }),
      'Self-ping failed',
    );
  });

  it('stop() clears the interval so no further pings fire', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200 });
    const stop = startSelfPing({
      url: 'https://my-service.onrender.com',
      logger: stubLogger,
      fetchImpl,
      intervalMs: 1000,
    });

    stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
