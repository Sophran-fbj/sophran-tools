export async function runInChunks<TItem, TResult>(
  items: readonly TItem[],
  chunkSize: number,
  run: (chunk: readonly TItem[]) => Promise<readonly TResult[]>,
): Promise<TResult[]> {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize must be a positive integer');
  }

  const result: TResult[] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    result.push(...(await run(items.slice(index, index + chunkSize))));
  }
  return result;
}
