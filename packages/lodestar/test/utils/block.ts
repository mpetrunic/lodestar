import {
  BeaconBlock,
  SignedBeaconBlock,
  ProposerSlashing,
  AttesterSlashing,
  Attestation,
  Deposit,
  SignedVoluntaryExit,
  SignedBeaconBlockHeader,
} from "@chainsafe/lodestar-types";
import {List} from "@chainsafe/ssz";
import {IBlockSummary} from "@chainsafe/lodestar-fork-choice";
import {isPlainObject} from "@chainsafe/lodestar-utils";
import {RecursivePartial} from "@chainsafe/lodestar-cli/src/util";

import {EMPTY_SIGNATURE, ZERO_HASH} from "../../src/constants";
import deepmerge from "deepmerge";
import {IBlockJob} from "../../src/chain";

export function generateEmptyBlock(): BeaconBlock {
  return {
    slot: 0,
    proposerIndex: 0,
    parentRoot: Buffer.alloc(32),
    stateRoot: ZERO_HASH,
    body: {
      randaoReveal: Buffer.alloc(96),
      eth1Data: {
        depositRoot: Buffer.alloc(32),
        blockHash: Buffer.alloc(32),
        depositCount: 0,
      },
      graffiti: Buffer.alloc(32),
      proposerSlashings: ([] as ProposerSlashing[]) as List<ProposerSlashing>,
      attesterSlashings: ([] as AttesterSlashing[]) as List<AttesterSlashing>,
      attestations: ([] as Attestation[]) as List<Attestation>,
      deposits: ([] as Deposit[]) as List<Deposit>,
      voluntaryExits: ([] as SignedVoluntaryExit[]) as List<SignedVoluntaryExit>,
    },
  };
}

export function generateEmptySignedBlock(): SignedBeaconBlock {
  return {
    message: generateEmptyBlock(),
    signature: EMPTY_SIGNATURE,
  };
}

export function generateEmptySignedBlockHeader(): SignedBeaconBlockHeader {
  return {
    message: {
      slot: 0,
      proposerIndex: 0,
      parentRoot: Buffer.alloc(32),
      stateRoot: Buffer.alloc(32),
      bodyRoot: Buffer.alloc(32),
    },
    signature: EMPTY_SIGNATURE,
  };
}

export function generateSignedBlock(override: RecursivePartial<SignedBeaconBlock> = {}): SignedBeaconBlock {
  return deepmerge<SignedBeaconBlock, RecursivePartial<SignedBeaconBlock>>(generateEmptySignedBlock(), override, {
    isMergeableObject: isPlainObject,
  });
}

export function generateEmptyBlockSummary(): IBlockSummary {
  return {
    slot: 0,
    blockRoot: Buffer.alloc(32),
    parentRoot: Buffer.alloc(32),
    stateRoot: Buffer.alloc(32),
    targetRoot: Buffer.alloc(32),
    justifiedEpoch: 0,
    finalizedEpoch: 0,
  };
}

export function generateBlockSummary(overrides: RecursivePartial<IBlockSummary> = {}): IBlockSummary {
  return deepmerge<IBlockSummary, RecursivePartial<IBlockSummary>>(generateEmptyBlockSummary(), overrides, {
    isMergeableObject: isPlainObject,
  });
}

/**
 * Block job with all metadata set to false
 */
export function getNewBlockJob(signedBlock: SignedBeaconBlock): IBlockJob {
  return {
    signedBlock,
    reprocess: false,
    prefinalized: false,
    validSignatures: false,
    validProposerSignature: false,
  };
}
