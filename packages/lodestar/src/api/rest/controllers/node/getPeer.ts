import {ApiController} from "../types";
import {objectToExpectedCase} from "@chainsafe/lodestar-utils";
import {DefaultQuery} from "fastify";

export const getPeer: ApiController<DefaultQuery, {peerId: string}> = {
  url: "/peers/:peerId",
  opts: {
    schema: {
      params: {
        type: "object",
        required: ["peerId"],
        properties: {
          peerId: {
            types: "string",
          },
        },
      },
    },
  },
  handler: async function (req, resp) {
    const peer = await this.api.node.getPeer(req.params.peerId);
    if (!peer) {
      return resp.status(404).send();
    }
    resp.status(200).send({
      data: objectToExpectedCase(peer, "snake"),
    });
  },
};
