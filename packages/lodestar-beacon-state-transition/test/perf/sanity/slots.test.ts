import {config} from "@chainsafe/lodestar-config/mainnet";
import {WinstonLogger} from "@chainsafe/lodestar-utils";
import {expect} from "chai";
import {EpochContext} from "../../../src/fast";
import {processSlots} from "../../../src/fast/slot";
import {CachedValidatorsBeaconState, createCachedValidatorsBeaconState} from "../../../src/fast/util";
import {generatePerformanceState, initBLS} from "../util";

describe("Process Slots Performance Test", function () {
  this.timeout(0);
  const logger = new WinstonLogger();
  let state: CachedValidatorsBeaconState;
  let epochCtx: EpochContext;

  before(async () => {
    await initBLS();
  });

  beforeEach(async () => {
    const origState = await generatePerformanceState();
    epochCtx = new EpochContext(config);
    epochCtx.loadState(origState);
    state = createCachedValidatorsBeaconState(origState);
  });

  it("process 1 empty epoch", async () => {
    const numSlot = 32;
    logger.profile(`Process ${numSlot} slots`);
    const start = Date.now();
    processSlots(epochCtx, state, state.slot + numSlot);
    logger.profile(`Process ${numSlot} slots`);
    expect(Date.now() - start).lt(1100);
  });

  it("process double empty epochs", async () => {
    const numSlot = 64;
    logger.profile(`Process ${numSlot} slots`);
    const start = Date.now();
    processSlots(epochCtx, state, state.slot + numSlot);
    logger.profile(`Process ${numSlot} slots`);
    expect(Date.now() - start).lt(2200);
  });

  it("process 4 empty epochs", async () => {
    const numSlot = 128;
    logger.profile(`Process ${numSlot} slots`);
    const start = Date.now();
    processSlots(epochCtx, state, state.slot + numSlot);
    logger.profile(`Process ${numSlot} slots`);
    expect(Date.now() - start).lt(4300);
  });
});
