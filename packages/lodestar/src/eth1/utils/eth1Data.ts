import {Root, Eth1Data, DepositEvent, Eth1Block} from "@chainsafe/lodestar-types";
import {List, TreeBacked} from "@chainsafe/ssz";
import {getTreeAtIndex} from "../../util/tree";
import {binarySearchLte} from "../../util/binarySearch";

/**
 * Appends partial eth1 data (depositRoot, depositCount) in a sequence of blocks
 * eth1 data deposit is inferred from sparse eth1 data obtained from the deposit logs
 */
export async function getEth1DataForBlocks(
  blocks: Eth1Block[],
  depositDescendingStream: AsyncIterable<DepositEvent>,
  depositRootTree: TreeBacked<List<Root>>,
  lastProcessedDepositBlockNumber: number | null
): Promise<(Eth1Data & Eth1Block)[]> {
  // Exclude blocks for which there is no valid eth1 data deposit
  if (lastProcessedDepositBlockNumber) {
    blocks = blocks.filter((block) => block.blockNumber <= lastProcessedDepositBlockNumber);
  }

  // A valid block can be constructed using previous `state.eth1Data`, don't throw
  if (blocks.length === 0) {
    return [];
  }

  // Collect the latest deposit of each blockNumber in a block number range
  const fromBlock = blocks[0].blockNumber;
  const toBlock = blocks[blocks.length - 1].blockNumber;
  const depositsByBlockNumber = await getDepositsByBlockNumber(fromBlock, toBlock, depositDescendingStream);
  if (depositsByBlockNumber.length === 0) {
    throw new ErrorNoDepositsForBlockRange(fromBlock, toBlock);
  }

  // Precompute a map of depositCount => depositRoot (from depositRootTree)
  const depositCounts = depositsByBlockNumber.map((event) => event.index + 1);
  const depositRootByDepositCount = getDepositRootByDepositCount(depositCounts, depositRootTree);

  const eth1Datas: (Eth1Data & Eth1Block)[] = [];
  for (const block of blocks) {
    const deposit = binarySearchLte(depositsByBlockNumber, block.blockNumber, (event) => event.blockNumber);
    const depositCount = deposit.index + 1;
    const depositRoot = depositRootByDepositCount.get(depositCount);
    if (depositRoot === undefined) throw new ErrorNoDepositRoot(depositCount);
    eth1Datas.push({...block, depositCount, depositRoot});
  }
  return eth1Datas;
}

/**
 * Collect depositCount by blockNumber from a stream matching a block number range
 * For a given blockNumber it's depositCount is equal to the index + 1 of the
 * closest deposit event whose deposit.blockNumber <= blockNumber
 * @returns array ascending by blockNumber
 */
export async function getDepositsByBlockNumber(
  fromBlock: number,
  toBlock: number,
  depositEventDescendingStream: AsyncIterable<DepositEvent>
): Promise<DepositEvent[]> {
  const depositCountMap = new Map<number, DepositEvent>();
  // Take blocks until the block under the range lower bound (included)
  for await (const deposit of depositEventDescendingStream) {
    if (deposit.blockNumber <= toBlock && !depositCountMap.has(deposit.blockNumber)) {
      depositCountMap.set(deposit.blockNumber, deposit);
    }
    if (deposit.blockNumber < fromBlock) {
      break;
    }
  }

  return Array.from(depositCountMap.values()).sort((a, b) => a.blockNumber - b.blockNumber);
}

/**
 * Precompute a map of depositCount => depositRoot from a depositRootTree filled beforehand
 */
export function getDepositRootByDepositCount(
  depositCounts: number[],
  depositRootTree: TreeBacked<List<Root>>
): Map<number, Root> {
  // Unique + sort numerically in descending order
  depositCounts = [...new Set(depositCounts)].sort((a, b) => b - a);

  if (depositCounts.length > 0) {
    const maxIndex = depositCounts[0] - 1;
    const treeLength = depositRootTree.length - 1;
    if (maxIndex > treeLength) {
      throw new ErrorNotEnoughDepositRoots(maxIndex, treeLength);
    }
  }

  return depositCounts.reduce((map: Map<number, Root>, depositCount) => {
    depositRootTree = getTreeAtIndex(depositRootTree, depositCount - 1);
    map.set(depositCount, depositRootTree.hashTreeRoot());
    return map;
  }, new Map());
}

export class ErrorNoDepositsForBlockRange extends Error {
  fromBlock: number;
  toBlock: number;
  constructor(fromBlock: number, toBlock: number) {
    super(`No deposits found for block range [${fromBlock}, ${toBlock}]`);
    this.fromBlock = fromBlock;
    this.toBlock = toBlock;
  }
}

export class ErrorNoDepositRoot extends Error {
  depositCount: number;
  constructor(depositCount: number) {
    super(`No depositRoot for depositCount ${depositCount}`);
    this.depositCount = depositCount;
  }
}

export class ErrorNotEnoughDepositRoots extends Error {
  index: number;
  treeLength: number;
  constructor(index: number, treeLength: number) {
    super(`Not enough deposit roots for index ${index}, current length ${treeLength}`);
    this.index = index;
    this.treeLength = treeLength;
  }
}
