import type { CallNodeParam, DecodeLimits } from './types';

// BigInt 安全的格式化辅助：任何解码值都不经过 Number() 转换，
// 超长字符串按 limits 截断并打上 truncated 标记。

/** 0x hex 归一化（小写、0x 前缀）；非法（含奇数长度）返回 null。 */
export function normalizeHex(value: string): string | null {
  const hex = value.trim().toLowerCase();
  if (!hex.startsWith('0x')) return null;
  const body = hex.slice(2);
  if (body.length % 2 !== 0) return null;
  if (!/^[0-9a-f]*$/.test(body)) return null;
  return `0x${body}`;
}

export function hexByteLength(hex: string): number {
  return (hex.length - 2) / 2;
}

/** 展示用 raw 预览：最多 maxBytes 字节，超出加 '…'。 */
export function rawPreview(hex: string, maxBytes: number): {
  preview: string;
  truncated: boolean;
} {
  const maxChars = maxBytes * 2 + 2;
  if (hex.length <= maxChars) return { preview: hex, truncated: false };
  return { preview: `${hex.slice(0, maxChars)}…`, truncated: true };
}

export interface FormattedValue {
  value: string;
  truncated: boolean;
}

function truncatePlain(text: string, maxChars: number): FormattedValue {
  if (text.length <= maxChars) return { value: text, truncated: false };
  return { value: `${text.slice(0, Math.max(1, maxChars - 1))}…`, truncated: true };
}

/** 把任意解码值格式化为有界字符串；BigInt 只用 toString，绝不转 Number。 */
export function formatDecodedValue(
  value: unknown,
  maxChars: number,
): FormattedValue {
  if (typeof value === 'bigint') {
    return truncatePlain(value.toString(), maxChars);
  }
  if (typeof value === 'string') {
    return truncatePlain(value, maxChars);
  }
  if (typeof value === 'boolean' || value === null || value === undefined) {
    return { value: String(value), truncated: false };
  }
  if (typeof value === 'number') {
    // 仅当上游把计数类字段解析为 number 时才可能出现；仍按字符串输出。
    return truncatePlain(String(value), maxChars);
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    let truncated = false;
    for (const item of value) {
      const formatted = formatDecodedValue(item, maxChars);
      if (formatted.truncated) truncated = true;
      parts.push(formatted.value);
      if (parts.join(', ').length > maxChars) {
        truncated = true;
        break;
      }
    }
    const joined = `[${parts.join(', ')}]`;
    const bounded = truncatePlain(joined, maxChars);
    return { value: bounded.value, truncated: truncated || bounded.truncated };
  }
  // 对象（如 tuple）：JSON 序列化，bigint 转字符串。
  const json = JSON.stringify(value, (_, nested: unknown) =>
    typeof nested === 'bigint' ? nested.toString() : nested,
  );
  return truncatePlain(json ?? String(value), maxChars);
}

/** 生成展示参数列表（带截断标记）。 */
export function toNodeParams(
  inputs: readonly { name?: string; type: string }[],
  args: readonly unknown[],
  limits: Pick<DecodeLimits, 'maxParamChars'>,
): CallNodeParam[] {
  return inputs.map((input, index) => {
    const formatted = formatDecodedValue(args[index], limits.maxParamChars);
    return {
      name: input.name || undefined,
      type: input.type,
      value: formatted.value,
      isAddress: input.type === 'address',
      truncated: formatted.truncated,
    };
  });
}

/** '0x' 或空数据。 */
export function isEmptyHex(hex: string): boolean {
  return hex === '0x' || hex === '';
}
