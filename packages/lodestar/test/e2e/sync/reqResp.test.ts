import {computeEpochAtSlot} from "@chainsafe/lodestar-beacon-state-transition";
import {config} from "@chainsafe/lodestar-config/mainnet";
import {ForkChoice} from "@chainsafe/lodestar-fork-choice";
import {BeaconBlocksByRangeRequest, BeaconBlocksByRootRequest} from "@chainsafe/lodestar-types";
import {LogLevel, WinstonLogger} from "@chainsafe/lodestar-utils";
import {expect} from "chai";
import Libp2p from "libp2p";
import sinon from "sinon";
import {encode} from "varint";
import all from "it-all";
import {Method, ReqRespEncoding, RpcResponseStatus} from "../../../src/constants";
import {BeaconMetrics} from "../../../src/metrics";
import {SszSnappyErrorCode} from "../../../src/network/reqresp/encodingStrategies/sszSnappy";
import {createRpcProtocol, Libp2pNetwork, NetworkEvent} from "../../../src/network";
import {decodeErrorMessage} from "../../../src/network/reqresp/utils/errorMessage";
import {IGossipMessageValidator} from "../../../src/network/gossip/interface";
import {INetworkOptions} from "../../../src/network/options";
import {ILibP2pStream} from "../../../src/network/reqresp";
import {BeaconReqRespHandler, IReqRespHandler} from "../../../src/sync/reqResp";
import {generateEmptySignedBlock} from "../../utils/block";
import {getBlockSummary} from "../../utils/headBlockInfo";
import {MockBeaconChain} from "../../utils/mocks/chain/chain";
import {createNode} from "../../utils/network";
import {generateState} from "../../utils/state";
import {StubbedBeaconDb} from "../../utils/stub";
import {arrToSource} from "../../unit/network/reqresp/utils";
import {silentLogger} from "../../utils/logger";

const multiaddr = "/ip4/127.0.0.1/tcp/0";
const opts: INetworkOptions = {
  maxPeers: 1,
  minPeers: 1,
  bootMultiaddrs: [],
  rpcTimeout: 5000,
  connectTimeout: 5000,
  disconnectTimeout: 5000,
  localMultiaddrs: [],
};

const block = generateEmptySignedBlock();
const BLOCK_SLOT = 2020;
block.message.slot = BLOCK_SLOT;
const block2 = generateEmptySignedBlock();
block2.message.slot = BLOCK_SLOT + 1;

describe("[sync] rpc", function () {
  this.timeout(20000);
  const sandbox = sinon.createSandbox();

  // Run tests with `DEBUG=true mocha ...` to get detailed logs of ReqResp exchanges
  const debugMode = process.env.DEBUG;
  const logger = debugMode ? new WinstonLogger({level: LogLevel.debug}) : silentLogger;
  const metrics = new BeaconMetrics({enabled: false, timeout: 5000, pushGateway: false}, {logger});

  let rpcA: IReqRespHandler, netA: Libp2pNetwork;
  let rpcB: IReqRespHandler, netB: Libp2pNetwork;
  let libP2pA: Libp2p;
  const validator: IGossipMessageValidator = {} as IGossipMessageValidator;
  let chain: MockBeaconChain;

  beforeEach(async () => {
    const state = generateState();
    chain = new MockBeaconChain({
      genesisTime: 0,
      chainId: 0,
      networkId: BigInt(0),
      state,
      config,
    });
    chain.getCanonicalBlockAtSlot = sinon.stub().resolves(block);
    const forkChoiceStub = sinon.createStubInstance(ForkChoice);
    chain.forkChoice = forkChoiceStub;
    forkChoiceStub.getHead.returns(
      getBlockSummary({
        finalizedEpoch: computeEpochAtSlot(config, block.message.slot),
      })
    );
    forkChoiceStub.getFinalizedCheckpoint.returns({
      epoch: computeEpochAtSlot(config, block.message.slot),
      root: config.types.BeaconBlock.hashTreeRoot(block.message),
    });
    libP2pA = await createNode(multiaddr);
    netA = new Libp2pNetwork(opts, {config, libp2p: libP2pA, logger, metrics, validator, chain});
    netB = new Libp2pNetwork(opts, {
      config,
      libp2p: await createNode(multiaddr),
      logger,
      metrics,
      validator,
      chain,
    });
    await Promise.all([netA.start(), netB.start()]);

    const db = new StubbedBeaconDb(sandbox, config);
    chain.stateCache.get = sinon.stub().returns(state as any);
    db.block.get.resolves(block);
    db.blockArchive.get.resolves(block);
    db.blockArchive.valuesStream.returns(
      (async function* () {
        yield block;
        yield block2;
      })()
    );
    rpcA = new BeaconReqRespHandler({
      config,
      db,
      chain,
      network: netA,
      logger,
    });

    rpcB = new BeaconReqRespHandler({
      config,
      db,
      chain,
      network: netB,
      logger: logger,
    });
    await Promise.all([rpcA.start(), rpcB.start()]);
  });

  afterEach(async () => {
    await chain.close();
    await Promise.all([rpcA.stop(), rpcB.stop()]);
    await Promise.all([netA.stop(), netB.stop()]);
  });

  it("hello handshake on peer connect with correct encoding", async function () {
    // A sends status request to B with ssz encoding
    netA.peerMetadata.setEncoding(netB.peerId, ReqRespEncoding.SSZ_SNAPPY);
    expect(netB.peerMetadata.getStatus(netA.peerId)).to.be.equal(null, "peer B should not have peer A status");

    const peersConnectedPromise = Promise.all([
      new Promise((resolve) => netA.once(NetworkEvent.peerConnect, resolve)),
      new Promise((resolve) => netB.once(NetworkEvent.peerConnect, resolve)),
    ]);
    await netA.connect(netB.peerId, netB.localMultiaddrs);
    await peersConnectedPromise;

    expect(netA.hasPeer(netB.peerId)).to.equal(true, "peer A should have peer B");
    expect(netB.hasPeer(netA.peerId)).to.equal(true, "peer B should have peer A");

    // Wait for peers to send each other a status request
    while (netA.peerMetadata.getStatus(netB.peerId) === null || netB.peerMetadata.getStatus(netA.peerId) === null) {
      await new Promise((r) => setTimeout(r, 250));
    }

    expect(netA.peerMetadata.getStatus(netB.peerId)).to.not.equal(null, "peer A should have peer B status");
    expect(netB.peerMetadata.getStatus(netA.peerId)).to.not.equal(null, "peer B should have peer A status");

    // B should store A with ssz as preferred encoding
    expect(netA.peerMetadata.getEncoding(netB.peerId)).to.be.equal(
      ReqRespEncoding.SSZ_SNAPPY,
      "peer A should store peer B preferred encoding"
    );
    expect(netB.peerMetadata.getEncoding(netA.peerId)).to.be.equal(
      ReqRespEncoding.SSZ_SNAPPY,
      "peer B should store peer A preferred encoding"
    );
  });

  it("goodbye on rpc stop", async function () {
    const peersConnectedPromise = Promise.all([
      new Promise((resolve) => netA.once(NetworkEvent.peerConnect, resolve)),
      new Promise((resolve) => netB.once(NetworkEvent.peerConnect, resolve)),
    ]);
    await netA.connect(netB.peerId, netB.localMultiaddrs);
    await peersConnectedPromise;

    // Wait for peers to send each other a status request
    while (netA.peerMetadata.getStatus(netB.peerId) === null || netB.peerMetadata.getStatus(netA.peerId) === null) {
      await new Promise((r) => setTimeout(r, 250));
    }

    // Wait a few ms more?
    await new Promise((resolve) => setTimeout(resolve, 200));

    const requestPeerBPromise = new Promise((resolve) => {
      // Replace the handler with a spy and restore it afterwards
      const handler = netB.reqResp.unregisterHandler();
      // eslint-disable-next-line require-yield
      netB.reqResp.registerHandler(async function* (method) {
        resolve(method);
        netB.reqResp.unregisterHandler();
        if (handler) netB.reqResp.registerHandler(handler);
      });
    });

    const [requestedMethodOnPeerB] = await Promise.all([requestPeerBPromise, rpcA.stop()]);

    expect(requestedMethodOnPeerB).to.equal(Method.Goodbye);
  });

  it("beacon block by root", async function () {
    const request = [Buffer.alloc(32)] as BeaconBlocksByRootRequest;
    await netA.connect(netB.peerId, netB.localMultiaddrs);
    const response = await netA.reqResp.beaconBlocksByRoot(netB.peerId, request);
    if (!response) throw Error("beaconBlocksByRoot returned null");
    expect(response.length).to.equal(1);
    const block = response[0];
    expect(block.message.slot).to.equal(BLOCK_SLOT);
  });

  it("beacon blocks by range", async () => {
    const request: BeaconBlocksByRangeRequest = {
      startSlot: BLOCK_SLOT,
      count: 2,
      step: 1,
    };

    await netA.connect(netB.peerId, netB.localMultiaddrs);
    const response = await netA.reqResp.beaconBlocksByRange(netB.peerId, request);
    if (!response) throw Error("beaconBlocksByRoot returned null");
    expect(response.length).to.equal(2);
    const block = response[0];
    expect(block.message.slot).to.equal(BLOCK_SLOT);
    const block2 = response[1];
    expect(block2.message.slot).to.equal(BLOCK_SLOT + 1);
  });

  it("should return invalid request status code", async () => {
    const protocol = createRpcProtocol(Method.Status, ReqRespEncoding.SSZ_SNAPPY);
    await netA.connect(netB.peerId, netB.localMultiaddrs);
    const {stream} = (await libP2pA.dialProtocol(netB.peerId, protocol)) as {stream: ILibP2pStream};

    // Bad encoding, 9e23 exceeds the max 10 varint bytes
    const requestBytes = [Buffer.from(encode(99999999999999999999999))];

    const [responseBytes] = await Promise.all([
      // Capture response
      all(stream.source),
      // Send bad request
      stream.sink(arrToSource(requestBytes)),
    ]);

    expect(responseBytes[0].slice()[0]).to.equal(
      RpcResponseStatus.INVALID_REQUEST,
      "First chunk should be: result = INVALID_REQUEST"
    );

    expect(decodeErrorMessage(responseBytes[1].slice())).to.include(
      SszSnappyErrorCode.INVALID_VARINT_BYTES_COUNT,
      "Second chunk should be: expected error message"
    );

    expect(responseBytes).to.have.length(2, "responseBytes should contain only two chunks");
  });
});
