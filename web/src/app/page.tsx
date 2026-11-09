import Link from "next/link";
import PasteBox from "@/components/PasteBox";
import ProofFeed from "@/components/ProofFeed";
import Constellation from "@/components/Constellation";
import Reveal from "@/components/Reveal";

const RESEARCH = "https://blog.bubblemaps.io/bubblemaps-investigates-crypto-kol-moves-onchain/";

function Section({ n, id, title, kicker, children }: { n: string; id: string; title: React.ReactNode; kicker: string; children: React.ReactNode }) {
  return (
    <section id={id} className="relative scroll-mt-20 hairline-t" aria-labelledby={`${id}-title`}>
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-32 lg:px-10">
        <span aria-hidden className="pointer-events-none absolute right-4 top-10 select-none font-display text-[120px] leading-none text-[color-mix(in_srgb,var(--ink)_5%,transparent)] sm:right-6 md:top-16 md:text-[220px] lg:right-10">
          {n}
        </span>
        <Reveal>
          <p className="label flex items-center gap-3">
            <span className="text-accent-ink">{n}</span>
            <span className="h-px w-8 bg-line-2" aria-hidden />
            <span>{kicker}</span>
          </p>
          <h2 id={`${id}-title`} className="relative mt-6 max-w-5xl font-display text-[44px] leading-[0.92] text-balance sm:text-[68px] lg:text-[92px]">
            {title}
          </h2>
        </Reveal>
        <div className="relative mt-14 md:mt-20">{children}</div>
      </div>
    </section>
  );
}

/** Schematic of how a crew call plays out. No data, just the shape. */
function Schematic() {
  return (
    <svg viewBox="0 0 720 210" className="h-auto w-full" role="img" aria-label="Diagram: caller wallets buy before the post, followers buy after it, then the crew sells into them and your exit fires">
      <defs>
        <pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill="var(--ink)" fillOpacity="0.16" />
        </pattern>
      </defs>
      <rect x="0" y="10" width="250" height="160" fill="url(#dots)" />
      {[50, 95, 140].map((y) => (
        <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="var(--line-2)" />
      ))}
      <line x1="250" x2="250" y1="0" y2="180" stroke="var(--ink)" strokeWidth="1.5" />
      <text x="250" y="198" textAnchor="middle" fontSize="13" fill="var(--ink)" fontFamily="var(--font-anton)" letterSpacing="1">
        POST
      </text>
      {/* caller and crew buys, linked like the constellation */}
      <polyline points="170,50 205,95 228,140" fill="none" stroke="var(--ink)" strokeOpacity="0.35" strokeWidth="1" />
      {[
        [170, 50],
        [205, 95],
        [228, 140],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 8} L${x + 8} ${y + 6} L${x - 8} ${y + 6} Z`} fill="var(--ink)" />
      ))}
      {/* follower buys */}
      {[290, 320, 345, 375, 400, 430].map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 ? 118 : 72} r="3" fill="var(--ink-3)" />
      ))}
      {/* sells */}
      {[
        [480, 95],
        [500, 50],
        [540, 140],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x - 8} ${y - 6} L${x + 8} ${y - 6} L${x} ${y + 8} Z`} fill="var(--accent)" />
      ))}
      {/* your exit */}
      <line x1="486" x2="486" y1="0" y2="180" stroke="var(--accent)" strokeDasharray="3 4" />
      <text x="493" y="14" fontSize="11" fill="var(--accent-ink)" fontFamily="var(--font-jetbrains)">
        your exit fires
      </text>
      <text x="8" y="198" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-jetbrains)">
        caller and crew buy
      </text>
      <text x="290" y="198" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-jetbrains)">
        followers buy
      </text>
      <text x="560" y="198" fontSize="11" fill="var(--accent-ink)" fontFamily="var(--font-jetbrains)">
        crew sells into them
      </text>
    </svg>
  );
}

const SOURCES = [
  { t: "Claimed", d: "Wallets the caller signed for themselves." },
  { t: "Public", d: "The public Kolscan KOL list and Farcaster verified wallets." },
  { t: "Repeat", d: "Wallets that keep buying with the caller across their recent tokens." },
  { t: "Early", d: "Bought in the 3 minutes before the post. Early on 2 or more of a caller's posts and it becomes crew." },
];

const FAQ = [
  {
    q: "What can I paste?",
    a: "A link to a post on X, a Farcaster cast, a public Telegram channel post (t.me/channel/123), or a token address on Solana or Base. Add the caller's @handle next to a token address to check that caller. A handle on its own is not enough: we need a post or a token to line the trades up against.",
  },
  {
    q: "Can I check calls from Telegram?",
    a: "Yes. Forward any call to @wingmancheckerbot on Telegram and it replies with what the crew is doing (still in, selling, or out) and a link to the full card. You can also paste a public channel post link here.",
  },
  {
    q: "How do you know a wallet belongs to a caller?",
    a: "Every wallet carries a badge for where it came from. Claimed: the caller signed for it. Public: it is on the public Kolscan KOL list or is a Farcaster verified wallet. Repeat: it keeps buying with this caller across their recent tokens. Early: it bought in the 3 minutes before this post. We remember early buyers per caller, and a wallet that is early on 2 or more of their posts becomes crew.",
  },
  {
    q: "What sets off my exit?",
    a: "Any watched wallet selling the token in a real swap. A plain transfer between wallets does not count. You pick which wallets to watch before you arm.",
  },
  {
    q: "What does the exit permission let Wingman do?",
    a: "Sell the one token you rode and send the proceeds only to you. On Base you approve exactly your position to the Wingman contract; only Wingman's keeper can call fire, the proceeds always go to you in USDC, and the sale has a floor at 50% of the quote when you armed. On Solana you presign the exit sale with a fixed minimum out set when you arm; the keeper holds it and sends it only on a crew sell. You can cancel any time.",
  },
  {
    q: "How fast does the exit fire?",
    a: "Wingman's keeper watches the wallets you picked. The first sell from any of them fires your exit within seconds, and your receipt shows both times so you can check the gap yourself.",
  },
  {
    q: "What if the caller has no known wallets?",
    a: "The card says so, with a coverage number. If we cannot see the crew, we do not pretend to, and there is nothing to arm an exit against.",
  },
  {
    q: "What does it cost?",
    a: "Checking a call is free. An armed exit costs 0.5% of the exit, or nothing if you stake 100,000 $VIBES. 30% of all exit fees go to WingmanPool stakers.",
  },
];

const STEPS = [
  { t: "Paste a call", d: "X, Farcaster, Telegram, or a token", g: "↗" },
  { t: "See the crew", d: "Who bought before the post", g: "→" },
  { t: "Ride with an exit", d: "Out when they sell", g: "↘" },
];

export default function Home() {
  return (
    <>
      {/* hero */}
      <section id="check" className="relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_80%_75%_at_65%_45%,black_35%,transparent_80%)] max-sm:[mask-image:radial-gradient(ellipse_100%_60%_at_60%_28%,black_30%,transparent_80%)]">
          <Constellation />
        </div>
        <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-bg" />

        <div className="relative mx-auto flex min-h-[calc(100dvh-56px)] max-w-7xl flex-col justify-center px-4 pb-16 pt-20 sm:px-6 sm:pt-16 lg:px-10">
          <p className="fade-up label flex items-center gap-2.5 text-ink-2">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            Live on Solana and Base
          </p>
          <h1 className="mt-6 font-display text-[64px] leading-[0.86] sm:text-[112px] lg:text-[clamp(112px,15vh,148px)]">
            <span className="rise">
              <span>Ride the call.</span>
            </span>
            <span className="rise">
              <span style={{ animationDelay: "90ms" }}>Leave when</span>
            </span>
            <span className="rise">
              <span className="text-accent" style={{ animationDelay: "180ms" }}>
                they leave.
              </span>
            </span>
          </h1>

          <div className="mt-10 grid gap-12 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:gap-20">
            <div className="max-w-2xl">
              <p className="fade-up max-w-xl text-[16px] leading-relaxed text-ink-2 sm:text-[18px]" style={{ animationDelay: "260ms" }}>
                Paste a call and see what the caller and their crew wallets did around the post. Then ride it with an exit that sells for you the moment a watched crew wallet sells.
              </p>
              <div className="fade-up mt-8" style={{ animationDelay: "340ms" }}>
                <PasteBox />
              </div>
              <p className="fade-up mt-6 max-w-xl text-[13px] leading-relaxed text-ink-3" style={{ animationDelay: "420ms" }}>
                <a href="https://t.me/wingmancheckerbot" target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 text-ink">
                  <span className="link">Or forward any call to @wingmancheckerbot on Telegram</span> <span className="nudge" aria-hidden>↗</span>
                </a>
                <span className="mt-3 block">
                  Onchain research, Nov 5 2026: one caller&apos;s wallets bought before 61% of his calls, about 20 seconds ahead.{" "}
                  <a href={RESEARCH} target="_blank" rel="noreferrer" className="link text-ink-2 hover:text-ink">
                    Read it
                  </a>
                </span>
              </p>
            </div>
            <ol className="fade-up hidden lg:block" style={{ animationDelay: "500ms" }} aria-label="How it works">
              {STEPS.map((s, i) => (
                <li key={s.t} className={i ? "mt-6" : ""}>
                  <a href="#how" className="group flex items-start justify-between gap-6">
                    <span>
                      <span className="block text-[16px] font-medium leading-tight text-ink">{s.t}</span>
                      <span className="mt-1 block text-[13px] text-ink-3">{s.d}</span>
                    </span>
                    <span className="nudge text-[18px] text-ink-2" aria-hidden>
                      {s.g}
                    </span>
                  </a>
                  <span className="mt-6 block h-px w-14 bg-line-2" aria-hidden />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <Section n="01" id="problem" kicker="The problem" title={<>The call is the exit for <span className="text-accent">the people who made it.</span></>}>
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {[
            { k: "Seconds before", d: "The caller and a crew of side wallets buy. Nobody following can see the call yet.", c: "text-ink" },
            { k: "The post", d: "“This coin will send.” Followers pile in and push the price up.", c: "text-ink" },
            { k: "Minutes later", d: "The crew sells into those followers. By the time the chart turns, they are out.", c: "text-accent-ink" },
          ].map((x, i) => (
            <Reveal key={x.k} delay={i * 90} className="border-t border-line-2 pt-5">
              <p className={`font-display text-[28px] leading-none ${x.c}`}>{x.k}</p>
              <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">{x.d}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-16">
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="min-w-[600px] sm:min-w-0">
              <Schematic />
            </div>
          </div>
        </Reveal>
      </Section>

      <Section n="02" id="how" kicker="How Wingman works" title="Paste a call. See the crew. Ride or pass.">
        <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
          {[
            { n: "1", t: "Paste", d: "An X post, a Farcaster cast, a Telegram channel post, or a token address with the caller's @handle. Or forward the call to our Telegram bot. We pin the post time to the second." },
            { n: "2", t: "See who bought first", d: "Caller wallets, crew and early buyers land on a flight strip around the post. Every trade links to the explorer, with how much of the early buying we can explain." },
            { n: "3", t: "Ride with an exit", d: "Buy with an exit armed on the wallets you pick. When any of them sells, you sell, and you get a receipt." },
          ].map((s, i) => (
            <li key={s.n}>
              <Reveal delay={i * 90}>
                <p className="font-display text-[88px] leading-[0.8] text-[color-mix(in_srgb,var(--ink)_22%,transparent)]">{s.n}</p>
                <p className="mt-6 font-display text-[26px] leading-none">{s.t}</p>
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">{s.d}</p>
              </Reveal>
            </li>
          ))}
        </ol>
        <Reveal className="mt-20">
          <p className="label">Where crew wallets come from</p>
          <dl className="mt-5 grid border-t border-line-2 sm:grid-cols-2 lg:grid-cols-4">
            {SOURCES.map((s) => (
              <div key={s.t} className="border-b border-line py-5 sm:pr-8">
                <dt className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink">{s.t}</dt>
                <dd className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.d}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </Section>

      <Section n="03" id="ride" kicker="Ride with an exit" title="You sell the second they do. Nothing else is touched.">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <Reveal>
            <p className="label text-accent-ink">The permission you grant</p>
            <p className="mt-4 text-[22px] leading-snug text-ink sm:text-[26px]">
              Wingman can sell this one token and send the proceeds only to you. It cannot withdraw or touch anything else.
            </p>
            <dl className="mt-10 border-t border-line-2 text-[14px] leading-relaxed">
              {[
                { k: "Trigger", v: "Any watched wallet selling the token in a real swap. A transfer does not count." },
                { k: "Base", v: "You approve exactly your position to the Wingman contract. Only Wingman's keeper can call fire, and the USDC always goes to you, never below a floor at 50% of the quote when you armed." },
                { k: "Solana", v: "You presign the exit sale with a fixed minimum out set when you arm. The keeper holds it and sends it only on a crew sell. It sells to SOL into your own wallet." },
                { k: "Cancel", v: "Any time. You own the position until the exit fires." },
                { k: "Trust", v: "Wingman decides when a watched wallet sold and sends your exit, so you trust it on timing. It can never change where the money goes or sell below your limit. Contracts are tested but not yet third party audited." },
                { k: "Fee", v: "0.5% of the exit. Free for wallets staking 100,000 $VIBES." },
              ].map((r) => (
                <div key={r.k} className="grid grid-cols-[84px_1fr] gap-4 border-b border-line py-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">{r.k}</dt>
                  <dd className="text-ink-2">{r.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div className="dotfield absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,black,transparent)] opacity-60" aria-hidden />
            <p className="label">Real receipt · Solana mainnet · Nov 9 2026 · a live call</p>
            <div className="mt-6 border-t border-line-2">
              <div className="flex items-end justify-between gap-4 border-b border-line py-5">
                <span className="text-[14px] text-ink-2">An early wallet on the call sold</span>
                <span className="font-display text-[44px] leading-none tabular-nums text-accent sm:text-[64px]">13:49:35</span>
              </div>
              <div className="flex items-end justify-between gap-4 border-b border-line py-5">
                <span className="text-[14px] text-ink-2">Our rider was out</span>
                <span className="font-display text-[44px] leading-none tabular-nums text-ink sm:text-[64px]">13:49:39</span>
              </div>
            </div>
            <p className="mt-6 font-display text-[30px] leading-none sm:text-[36px]">4 seconds later, sold back to SOL.</p>
            <p className="mt-3 text-[13px] text-ink-2">Not a staged test: a wallet we don&apos;t control sold the $Pepetide call, and the exit we armed on it fired by itself.</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
              <a className="link text-ink-2 hover:text-ink" href="https://solscan.io/tx/4uADvAA2bhaAPRmyvzQKisrzhbHQhgbkvc71tZaSJwU8MkHzq1k673gbSaiwCwsomYQ2oREGFQ3e77Cumwuq2Z2g" target="_blank" rel="noreferrer">
                Their sell tx ↗
              </a>
              <a className="link text-ink-2 hover:text-ink" href="https://solscan.io/tx/37aeizy3zK2sooQycNjmkVU4BzXbFjEysKGWyoUQkBzUg8as7wdwg96tubLjvnetj6Wr1EQ22Y2ue8HBiFvgceHk" target="_blank" rel="noreferrer">
                Wingman exit tx ↗
              </a>
              <Link className="link text-ink-2 hover:text-ink" href="/proof">
                Every fill ↗
              </Link>
            </div>
            <p className="mt-8 label">See a real card</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
              <Link className="link text-ink-2 hover:text-ink" href="/card/1c9027a0b70d95ee">
                Crew is out: the caller and their crew bought together and sold within seconds ↗
              </Link>
              <Link className="link text-ink-2 hover:text-ink" href="/card/9b9d2e15556e0ef9">
                The $Pepetide Telegram call: early buyers and the exit that fired ↗
              </Link>
            </div>
            <p className="mt-6 text-[12px] text-ink-3">
              Base, with our own test wallets playing crew and rider: crew sold 21:24:37, the WingmanExit keeper fired 21:24:41, paid in USDC.{" "}
              <a className="link hover:text-ink" href="https://basescan.org/tx/0x6e7c45d7c740316a49dc72378da58776889546f5565e1907acd441f1ed6f3451" target="_blank" rel="noreferrer">crew sell</a>{" · "}
              <a className="link hover:text-ink" href="https://basescan.org/tx/0x192ee870ee0aff8530e4c559a7b1491c80ba09ab914c2f4818a1b1678b6f98ab" target="_blank" rel="noreferrer">exit</a>
            </p>
          </Reveal>
        </div>
      </Section>

      <Section n="04" id="vibes" kicker="For $VIBES stakers" title="Stakers ride free and earn from every exit.">
        <div className="grid border-t border-line-2 sm:grid-cols-3">
          {[
            { v: "100k", d: "$VIBES staked on Base makes your armed exits free.", c: "text-ink" },
            { v: "0.5%", d: "of the exit for everyone else. Checking calls stays free.", c: "text-ink" },
            { v: "30%", d: "of exit fees go to WingmanPool stakers, claimable onchain.", c: "text-accent" },
          ].map((x, i) => (
            <Reveal key={x.v} delay={i * 90} className="border-b border-line py-8 sm:border-b-0 sm:pr-8 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-8">
              <p className={`font-display text-[72px] leading-[0.85] sm:text-[88px] ${x.c}`}>{x.v}</p>
              <p className="mt-4 max-w-[16rem] text-[15px] leading-relaxed text-ink-2">{x.d}</p>
            </Reveal>
          ))}
        </div>
        <Link href="/stake" className="group mt-12 inline-flex h-12 items-center gap-3 bg-ink px-6 font-display text-[20px] text-bg transition hover:bg-accent">
          Stake $VIBES <span className="nudge" aria-hidden>↗</span>
        </Link>
      </Section>

      <Section n="05" id="proof" kicker="Proof" title="Live fills and fresh cards, all on the explorer.">
        <ProofFeed limit={4} />
        <Link href="/proof" className="group mt-12 inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-2 hover:text-ink">
          <span className="link">See everything on Proof</span> <span className="nudge" aria-hidden>↗</span>
        </Link>
      </Section>

      <Section n="06" id="faq" kicker="FAQ" title="Straight answers.">
        <div className="border-t border-line-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[18px] font-medium text-ink transition-colors hover:text-accent-ink sm:text-[20px]">
                {f.q}
                <span className="grid h-8 w-8 shrink-0 place-items-center text-[22px] font-light text-ink-3 transition-transform duration-300 group-open:rotate-45 group-open:text-accent" aria-hidden>
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-7 text-[15px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
