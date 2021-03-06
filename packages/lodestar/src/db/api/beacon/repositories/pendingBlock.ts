import {SignedBeaconBlock} from "@chainsafe/lodestar-types";
import {IBeaconConfig} from "@chainsafe/lodestar-config";
import {IDatabaseController, Bucket, Repository} from "@chainsafe/lodestar-db";

/**
 * Blocks by root
 *
 * Used to store pending blocks
 */
export class PendingBlockRepository extends Repository<Uint8Array, SignedBeaconBlock> {
  public constructor(config: IBeaconConfig, db: IDatabaseController<Buffer, Buffer>) {
    super(config, db, Bucket.pendingBlock, config.types.SignedBeaconBlock);
  }

  /**
   * Id is hashTreeRoot of unsigned BeaconBlock
   */
  public getId(value: SignedBeaconBlock): Uint8Array {
    return this.config.types.BeaconBlock.hashTreeRoot(value.message);
  }
}
