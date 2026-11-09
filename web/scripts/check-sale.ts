// Checks the Base exit trigger against real transactions.
import { tradeInTx } from "../src/lib/engine/base";
(async () => {
  const DEGEN = "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
  const crew = "0xC25A0c3c6c3c941cb2010Acf58C62F72124b1d17";
  console.log("crew sell by crew:", await tradeInTx("0x6e7c45d7c740316a49dc72378da58776889546f5565e1907acd441f1ed6f3451", DEGEN, crew));
  console.log("same tx, other wallet:", await tradeInTx("0x6e7c45d7c740316a49dc72378da58776889546f5565e1907acd441f1ed6f3451", DEGEN, "0x4e8B2C8B9184fc1E68562530e65821f2EC6C6F43"));
  console.log("keeper fire tx as crew:", await tradeInTx("0x192ee870ee0aff8530e4c559a7b1491c80ba09ab914c2f4818a1b1678b6f98ab", DEGEN, crew));
})();
