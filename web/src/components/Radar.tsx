/** Slow radar sweep behind the hero. Pure CSS, decorative. */
export default function Radar() {
  const blips = [
    { top: "28%", left: "62%", delay: "0.9s" },
    { top: "58%", left: "71%", delay: "1.6s" },
    { top: "40%", left: "34%", delay: "5.4s" },
    { top: "70%", left: "46%", delay: "7.2s" },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="radar-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="radar left-1/2 top-1/2 w-[900px] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-90 sm:w-[1100px]">
        {blips.map((b, i) => (
          <span key={i} className="blip" style={{ top: b.top, left: b.left, animationDelay: b.delay }} />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
