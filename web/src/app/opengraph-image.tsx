import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Wingman: ride the call, leave when they leave";

const ACCENT = "#FF3B1F";

async function font(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  const [anton, mono] = await Promise.all([font("Anton", 400), font("JetBrains+Mono", 500)]);
  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 500; style: "normal" }[] = [];
  if (anton) fonts.push({ name: "Anton", data: anton, weight: 400, style: "normal" });
  if (mono) fonts.push({ name: "Mono", data: mono, weight: 500, style: "normal" });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#050505", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", fontFamily: "Anton" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width={48} height={39} viewBox="0 0 32 26">
            <path d="M16 3 L24 13 L19.5 13 L16 8.6 L12.5 13 L8 13 Z" fill={ACCENT} />
            <path d="M7 15 L13.5 23 L9.5 23 L7 19.8 L4.5 23 L0.5 23 Z" fill={ACCENT} />
            <path d="M25 15 L31.5 23 L27.5 23 L25 19.8 L22.5 23 L18.5 23 Z" fill={ACCENT} />
          </svg>
          <span style={{ fontSize: 40, color: "#f2efe9" }}>WINGMAN</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 112, lineHeight: 0.92, textTransform: "uppercase" }}>
          <span style={{ color: "#f2efe9" }}>Ride the call.</span>
          <span style={{ color: ACCENT }}>Leave when they leave.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Mono", fontSize: 24, color: "#b4b4b4" }}>
          <span>Crew sold 13:49:35 · you were out 13:49:39</span>
          <span>wingman.jdollar.site</span>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
