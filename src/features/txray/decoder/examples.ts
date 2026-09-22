import { encodeFunctionData, parseAbiItem, type Hex } from 'viem';

export const APPROVE_EXAMPLE =
  '0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as Hex;

const MULTICALL3_ADDRESS =
  '0xcA11bde05977b3631167028862bE2a173976CA11';
const aggregate3Abi = [
  parseAbiItem(
    'function aggregate3((address target, bool allowFailure, bytes callData)[] calls)',
  ),
] as const;

function wrapAggregate3(callData: Hex): Hex {
  return encodeFunctionData({
    abi: aggregate3Abi,
    functionName: 'aggregate3',
    args: [[{ target: MULTICALL3_ADDRESS, allowFailure: false, callData }]],
  });
}

// Two nested Multicall3 containers around an unlimited approve. This makes the
// product sample exercise recursive decoding and high-risk path expansion.
export const NESTED_MULTICALL_EXAMPLE = wrapAggregate3(
  wrapAggregate3(APPROVE_EXAMPLE),
);
