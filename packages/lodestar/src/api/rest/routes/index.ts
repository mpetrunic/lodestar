import {FastifyInstance} from "fastify";
import {ApiNamespace} from "../../impl";
import {registerBeaconRoutes} from "./beacon";
import {registerDebugRoutes} from "./debug";
import {registerEventsRoutes} from "./events";
import {registerNodeRoutes} from "./node";
import {registerValidatorRoutes} from "./validator";

export * from "./beacon";
export * from "./validator";

export function registerRoutes(server: FastifyInstance, enabledNamespaces: ApiNamespace[]): void {
  server.register(
    async function (fastify) {
      if (enabledNamespaces.includes(ApiNamespace.BEACON)) {
        registerBeaconRoutes(fastify);
      }
      if (enabledNamespaces.includes(ApiNamespace.NODE)) {
        registerNodeRoutes(fastify);
      }
      if (enabledNamespaces.includes(ApiNamespace.EVENTS)) {
        registerEventsRoutes(fastify);
      }
      if (enabledNamespaces.includes(ApiNamespace.VALIDATOR)) {
        registerValidatorRoutes(fastify);
      }
      if (enabledNamespaces.includes(ApiNamespace.DEBUG)) {
        registerDebugRoutes(fastify);
      }
    },
    {prefix: "/eth"}
  );
}
