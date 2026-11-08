// Loads the two mainnet self test exits into storage so /proof shows them.
import { readFileSync } from "fs";
import { saveExit } from "../src/lib/store";
(async () => {
  for (const f of ["base-selftest.json", "solana-selftest.json"]) {
    const j = JSON.parse(readFileSync(`../docs/proof/${f}`, "utf8"));
    const e = { ...j.exitRecord, selfTest: true };
    await saveExit(e);
    console.log("saved", e.id, e.status);
  }
})();
