declare module "stream-chain" {
  import type { Readable } from "node:stream";

  type Chained = Readable & {
    destroy(error?: Error): void;
  };

  const streamChain: {
    chain(streams: unknown[]): Chained;
  };

  export default streamChain;
}

declare module "stream-json" {
  const streamJson: {
    parser(): unknown;
  };

  export default streamJson;
}

declare module "stream-json/streamers/StreamArray" {
  const streamArray: {
    streamArray(): unknown;
  };

  export default streamArray;
}
