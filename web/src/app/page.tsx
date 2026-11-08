import Link from "next/link";
import PasteBox from "@/components/PasteBox";
import Radar from "@/components/Radar";
import ProofFeed from "@/components/ProofFeed";

const BUBBLEMAPS = "https://blog.bubblemaps.io/bubblemaps-investigates-crypto-kol-moves-onchain/";

function Section({ n, id, title, kicker, children }: { n: string; id: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="hairline-t scroll-mt-20" aria-labelledby={`${id}-title`}>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-20 sm:px-6 md:grid-cols-[220px_1fr] md:py-28">
        <div>
          <p className="font-display text-[13px] font-semibold tabular-nums text-amber-ink">{n}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-ink-3">{kicker}</p>
        </div>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="max-w-3xl font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-balance sm:text-[44px]">
            {title}
          </h2>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Schematic of how a crew call plays out. No data, just the shape. */
function Schematic() {
  return (
    <svg viewBox="0 0 720 200" className="h-auto w-full" role="img" aria-label="Diagram: caller wallets buy before the post, followers buy after it, then the crew sells into them">
      <defs>
        <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="var(--amber)" strokeOpacity="0.14" strokeWidth="4" />
        </pattern>
      </defs>
      <rect x="0" y="10" width="250" height="160" fill="url(#hatch)" />
      {[50, 95, 140].map((y) => (
        <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="var(--line-2)" />
      ))}
      <line x1="250" x2="250" y1="0" y2="180" stroke="var(--amber)" strokeWidth="2" />
      <text x="250" y="196" textAnchor="middle" fontSize="11" fill="var(--amber-ink)" fontFamily="var(--font-unbounded)" fontWeight="600">
        POST
      </text>
      {/* caller + crew buys */}
      {[
        [170, 50],
        [205, 95],
        [228, 140],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 8} L${x + 8} ${y + 6} L${x - 8} ${y + 6} Z`} fill="var(--amber)" />
      ))}
      {/* follower buys (muted) */}
      {[290, 320, 345, 375, 400, 430].map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 ? 118 : 72} r="3.5" fill="var(--ink-3)" />
      ))}
      {/* sells */}
      {[
        [480, 95],
        [500, 50],
        [540, 140],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x - 8} ${y - 6} L${x + 8} ${y - 6} L${x} ${y + 8} Z`} fill="var(--red)" />
      ))}
      {/* your exit */}
      <line x1="486" x2="486" y1="0" y2="180" stroke="var(--green)" strokeDasharray="3 4" />
      <text x="492" y="14" fontSize="11" fill="var(--green-ink)" fontFamily="var(--font-jetbrains)">
        your exit fires
      </text>
      <text x="8" y="186" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-jetbrains)">
        caller and crew buy
      </text>
      <text x="290" y="186" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-jetbrains)">
        followers buy
      </text>
      <text x="560" y="186" fontSize="11" fill="var(--red-ink)" fontFamily="var(--font-jetbrains)">
        crew sells into them
      </text>
    </svg>
  );
}

const FAQ = [
  {
    q: "What can I paste?",
    a: "A link to a post on X, a Farcaster cast, a token address on Solana or Base, or a caller's handle. Wingman finds the post time to the second and the token it points at.",
  },
  {
    q: "How do you know a wallet belongs to a caller?",
    a: "Four ways, shown as badges. Claimed: the caller signed from it. Public: it is linked in public data like a KOL dataset, a Basename or a verified Farcaster address. Funded: a known caller wallet sent it money. Behaviour: it keeps buying seconds before this caller posts. Every badge links to its proof.",
  },
  {
    q: "What does the exit permission let Wingman do?",
    a: "Sell the one token you rode and send the proceeds only to you: SOL on Solana, USDC on Base. It cannot withdraw, move anything else or sell any other token. You can cancel it any time.",
  },
  {
    q: "How fast does the exit fire?",
    a: "Wingman watches the wallets you picked. The first sell from any of them triggers your sell within seconds, and your receipt shows both times so you can check the gap yourself.",
  },
  {
    q: "What if the caller has no known wallets?",
    a: "The card says so plainly, with a coverage number. If we cannot see the crew, we do not pretend to, and there is nothing to arm an exit against.",
  },
  {
    q: "What does it cost?",
    a: "Checking a call is free. An armed exit costs 0.5% of the exit, or nothing if you stake 100,000 $VIBES. Stakers share 30% of all exit fees.",
  },
];

export default function Home() {
  return (
    <>
      {/* hero */}
      <section id="check" className="relative isolate overflow-hidden">
        <Radar />
        <div className="relative mx-auto flex min-h-[calc(100dvh-56px)] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
          <p className="fade-up text-[11px] uppercase tracking-[0.24em] text-green-ink">Night shift · Solana and Base</p>
          <h1 className="fade-up mt-5 max-w-4xl font-display text-[40px] font-semibold leading-[1.02] tracking-tight text-balance sm:text-[72px] lg:text-[88px]" style={{ animationDelay: "80ms" }}>
            Ride the call. <span className="text-amber">Leave when they leave.</span>
          </h1>
          <p className="fade-up mt-6 max-w-xl text-[15px] leading-relaxed text-ink-2 sm:text-[16px]" style={{ animationDelay: "160ms" }}>
            Paste a call and see what the caller and their crew did around the post. Then ride it with an exit that sells for you the moment the crew starts selling.
          </p>
          <div className="fade-up mt-10 max-w-2xl" style={{ animationDelay: "240ms" }}>
            <PasteBox />
          </div>
          <p className="fade-up mt-8 max-w-xl border-l-2 border-amber pl-4 text-[13px] leading-relaxed text-ink-2" style={{ animationDelay: "320ms" }}>
            Bubblemaps (Nov 5 2026): one caller&apos;s wallets bought before 61% of his calls, about 20 seconds ahead.{" "}
            <a href={BUBBLEMAPS} target="_blank" rel="noreferrer" className="text-ink-3 underline underline-offset-2 hover:text-ink">
              Read the research
            </a>
          </p>
        </div>
      </section>

      <Section n="01" id="problem" kicker="The problem" title="The call is the exit for the people who made it.">
        <div className="grid gap-10 sm:grid-cols-3">
          {[
            { t: "Seconds before", d: "The caller and a crew of side wallets buy. Nobody following can see the call yet.", c: "text-amber-ink" },
            { t: "The post", d: "“This coin will send.” Followers pile in and push the price up.", c: "text-ink" },
            { t: "Minutes later", d: "The crew sells into those followers. By the time the chart turns, they are out.", c: "text-red-ink" },
          ].map((x) => (
            <div key={x.t}>
              <p className={`font-display text-[15px] font-semibold ${x.c}`}>{x.t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{x.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-14">
          <Schematic />
        </div>
      </Section>

      <Section n="02" id="how" kicker="How Wingman works" title="Paste a call. See the crew. Ride or pass.">
        <ol className="grid gap-10 md:grid-cols-3">
          {[
            { n: "1", t: "Paste", d: "An X post, a cast, a token address or a handle. We pin the post time to the second." },
            { n: "2", t: "See who bought first", d: "Caller wallets and crew land on a flight strip around the post, every trade linked to the explorer, with how much of the early buying we can explain." },
            { n: "3", t: "Ride with an exit", d: "Buy with an exit armed on the crew. When they sell, you sell, and you get a receipt." },
          ].map((s) => (
            <li key={s.n}>
              <p className="font-display text-[40px] font-semibold leading-none text-ink-3">{s.n}</p>
              <p className="mt-4 font-display text-[16px] font-semibold">{s.t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-ink-2">
          <span><b className="font-semibold text-amber-ink">Claimed</b> signed by the caller</span>
          <span><b className="font-semibold text-amber-ink">Public</b> linked in public data</span>
          <span><b className="font-semibold text-ink">Funded</b> paid by a caller wallet</span>
          <span><b className="font-semibold text-ink">Behaviour</b> buys right before every call</span>
        </div>
      </Section>

      <Section n="03" id="ride" kicker="Ride with an exit" title="You sell the second they do. Nothing else is touched.">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-green-ink">The permission you grant</p>
            <p className="mt-3 font-display text-[20px] leading-snug">
              Wingman can sell this one token and send the proceeds only to you. It cannot withdraw or touch anything else.
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-ink-2">
              <li><span className="text-ink">Base:</span> you approve exactly your position to the Wingman contract, with a USDC floor the sale can never go below. Its code only sells and only pays you.</li>
              <li><span className="text-ink">Solana:</span> you sign the exit sale ahead of time. Wingman holds it and sends it only when a watched wallet sells. It sells to SOL into your own wallet.</li>
              <li>Cancel any time from My exits.</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-bg-2 p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-3">Real receipt · Base mainnet · our own test wallets</p>
            <div className="mt-4 font-display text-[22px] leading-snug sm:text-[26px]">
              <p>
                Crew started selling <span className="tabular-nums text-red-ink">21:24:37</span>.
              </p>
              <p>
                You were out <span className="tabular-nums text-green-ink">21:24:41</span>.
              </p>
              <p className="mt-3 text-green-ink">4 seconds later, paid in USDC.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
              <a className="underline underline-offset-2 hover:text-ink" href="https://basescan.org/tx/0x6e7c45d7c740316a49dc72378da58776889546f5565e1907acd441f1ed6f3451" target="_blank" rel="noreferrer">Crew sell tx</a>
              <a className="underline underline-offset-2 hover:text-ink" href="https://basescan.org/tx/0x192ee870ee0aff8530e4c559a7b1491c80ba09ab914c2f4818a1b1678b6f98ab" target="_blank" rel="noreferrer">Wingman exit tx</a>
              <a className="underline underline-offset-2 hover:text-ink" href="https://solscan.io/tx/24b66AKbtPdgr1BsAftWaURG3M8vc6nWYaxP85JDjqt7HyUJXwrz32MQuFmDyBbd3WkyYpVFxFSQMFhmVRYtMznc" target="_blank" rel="noreferrer">Same on Solana, also 4 seconds</a>
            </div>
            <p className="mt-6 text-[12px] text-ink-3">We ran these with our own wallets playing crew and rider. Every receipt links both transactions.</p>
          </div>
        </div>
      </Section>

      <Section n="04" id="vibes" kicker="For $VIBES stakers" title="Stakers ride free and earn from every exit.">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="font-display text-[44px] font-semibold leading-none text-green-ink">100k</p>
            <p className="mt-3 text-[14px] text-ink-2">$VIBES staked on Base makes your armed exits free.</p>
          </div>
          <div>
            <p className="font-display text-[44px] font-semibold leading-none">0.5%</p>
            <p className="mt-3 text-[14px] text-ink-2">of the exit for everyone else. Checking calls stays free.</p>
          </div>
          <div>
            <p className="font-display text-[44px] font-semibold leading-none text-amber">30%</p>
            <p className="mt-3 text-[14px] text-ink-2">of exit fees go to the staker pool, claimable onchain.</p>
          </div>
        </div>
        <Link href="/stake" className="mt-10 inline-flex h-11 items-center rounded-xl bg-ink px-6 font-display text-[13px] font-semibold text-bg">
          Stake $VIBES
        </Link>
      </Section>

      <Section n="05" id="proof" kicker="Proof" title="Live fills and fresh cards, all on the explorer.">
        <ProofFeed limit={4} />
        <Link href="/proof" className="mt-10 inline-block text-[13px] text-ink-2 underline underline-offset-4 hover:text-ink">
          See everything on Proof
        </Link>
      </Section>

      <Section n="06" id="faq" kicker="FAQ" title="Straight answers.">
        <div className="divide-y divide-[var(--line)] hairline-t hairline-b">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-[16px] font-medium">
                {f.q}
                <span className="text-ink-3 transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
