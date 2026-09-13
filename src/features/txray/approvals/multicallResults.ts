import { isRecord } from '@/lib/validation';

export function readBigIntResult(result: unknown): bigint | undefined {
  if (!isRecord(result) || result.status !== 'success') return undefined;
  return typeof result.result === 'bigint' ? result.result : undefined;
}

export function readBooleanResult(result: unknown): boolean | undefined {
  if (!isRecord(result) || result.status !== 'success') return undefined;
  return typeof result.result === 'boolean' ? result.result : undefined;
}

export function readPermit2Result(
  result: unknown,
): readonly [bigint, bigint, bigint] | undefined {
  if (
    !isRecord(result) ||
    result.status !== 'success' ||
    !Array.isArray(result.result)
  ) {
    return undefined;
  }
  const [amount, expiration, nonce] = result.result;
  return typeof amount === 'bigint' &&
    typeof expiration === 'bigint' &&
    typeof nonce === 'bigint'
    ? [amount, expiration, nonce]
    : undefined;
}

export function readSuccessResult(result: unknown): unknown {
  if (!isRecord(result) || result.status !== 'success') return undefined;
  return result.result;
}
