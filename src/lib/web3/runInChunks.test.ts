import { describe, expect, it, vi } from 'vitest';
import { runInChunks } from './runInChunks';

describe('runInChunks', () => {
  it('preserves order and caps each batch', async () => {
    const run = vi.fn(async (chunk: readonly number[]) =>
      chunk.map((value) => value * 2),
    );

    await expect(runInChunks([1, 2, 3, 4, 5], 2, run)).resolves.toEqual([
      2, 4, 6, 8, 10,
    ]);
    expect(run.mock.calls.map(([chunk]) => chunk)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('rejects invalid batch sizes', async () => {
    await expect(runInChunks([1], 0, async () => [])).rejects.toThrow(
      'positive integer',
    );
  });
});
