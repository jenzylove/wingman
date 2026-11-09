// Checks that a token on another EVM chain gets a clear "unsupported chain" answer, and a Base token passes.
import { readInput } from "../src/lib/engine/input";
(async () => {
  for (const x of ["0x6982508145454Ce325dDbE47a25d4ec3d2311933", "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed"]) {
    try {
      const c = await readInput(x);
      console.log("ok", c.token.chain, x.slice(0, 8));
    } catch (e) {
      console.log("err", (e as Error).message);
    }
  }
})();
