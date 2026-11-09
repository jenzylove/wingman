import { buildCard } from "../src/lib/engine/card";
import { stanceOf } from "../src/lib/ui/stance";
(async () => {
  for (const u of process.argv.slice(2)) {
    try { const c = await buildCard(u); const s = stanceOf(c); console.log(u, c.call.token.symbol, s.stance ?? s, "|", c.verdictLine, "| crew", c.crew.length, "early", (c.early || []).length); }
    catch (e) { console.log(u, "ERR", String(e).slice(0, 100)); }
  }
})();
