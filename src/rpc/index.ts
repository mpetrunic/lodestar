import { Attestation, AttestationData, BeaconBlock, bytes32, Deposit, Shard, Slot, Eth1Data } from "../types";
import { DB } from "../db";
import { BeaconChain } from "../chain";

/**
 * The BeaconRPC service manages incoming/outgoing RPC requests
 */
export class BeaconRPC {
  private chain: BeaconChain;
  private db: DB;

  public constructor(opts, {chain, db}) {
    this.chain = chain;
    this.db = db;
  }
  public async start() {}
  public async stop() {}

  /**
   * Return the current chain head
   */
  public async getChainHead(): Promise<BeaconBlock> {
    return await this.db.getChainHead();
  }

  /**
   * Return a list of attestations ready for inclusion in the next block
   */
  public async getPendingAttestations(): Promise<Attestation[]> {
    return [];
  }

  /**
   * Return a list of deposits ready for inclusion in the next block
   */
  public async getPendingDeposits(): Promise<Deposit[]> {
    return [];
  }

  /**
   * Return the Eth1Data to be included in the next block
   */
  public async getEth1Data(): Promise<Eth1Data> {
    return {} as Eth1Data;
  }

  /**
   * Return the state root after the block has been run through the state transition
   */
  public async computeStateRoot(block: BeaconBlock): Promise<bytes32> {
    return Buffer.alloc(32);
  }

  /**
   * Return the attestation data for a slot and shard based on the current head
   */
  public async getAttestationData(slot: Slot, shard: Shard): Promise<AttestationData> {
    return {} as AttestationData;
  }

  /**
   * Submit an attestation for processing
   */
  public async putAttestation(attestation: Attestation): Promise<void> {}

  /**
   * Submit a block for processing
   */
  public async putBlock(block: BeaconBlock): Promise<void> {
    await this.chain.receiveBlock(block);
  }
}
