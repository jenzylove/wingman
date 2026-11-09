"use client";

import { useEffect, useRef } from "react";

/**
 * Wallets as a drifting dot field. The caller is the bright red node, the crew are
 * linked to it with thin red lines, everyone else is a grey wallet linked to its
 * neighbours. Every few seconds a crew wallet sells and a ring goes out from it.
 * Canvas, one rAF loop, paused offscreen and when the tab is hidden. One still frame
 * under prefers-reduced-motion.
 */

interface P {
  bx: number;
  by: number;
  ax: number;
  ay: number;
  sp: number;
  ph: number;
  r: number;
  kind: "caller" | "crew" | "wallet";
  x: number;
  y: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ACCENT = "255,59,31";
const INK = "242,239,233";

export default function Constellation({
  className = "",
  focusX = 0.68,
  focusY = 0.46,
  mobileFocusX = 0.6,
  mobileFocusY = 0.3,
  density = 1,
  crewCount = 6,
  seed = 7,
}: {
  className?: string;
  focusX?: number;
  focusY?: number;
  mobileFocusX?: number;
  mobileFocusY?: number;
  density?: number;
  crewCount?: number;
  seed?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let pts: P[] = [];
    let linkDist = 120;
    let raf = 0;
    let visible = true;
    let running = false;
    const t0 = performance.now();
    const pulses: { i: number; at: number }[] = [];
    let nextPulse = 2200;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const mobile = w < 640;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rand = rng(seed);
      const cx = w * (mobile ? mobileFocusX : focusX);
      const cy = h * (mobile ? mobileFocusY : focusY);
      const R = Math.min(w, h) * (mobile ? 0.42 : 0.36);
      const n = Math.round((mobile ? 46 : 104) * density);
      linkDist = Math.max(70, R * 0.42);
      pts = [];
      // the caller sits a little off centre, leading
      pts.push({ bx: cx - R * 0.08, by: cy - R * 0.06, ax: 4, ay: 3, sp: 0.00018, ph: 0, r: 3.6, kind: "caller", x: 0, y: 0 });
      for (let i = 0; i < crewCount; i++) {
        const a = (i / crewCount) * Math.PI * 2 + rand() * 0.6;
        const rr = R * (0.3 + rand() * 0.28);
        pts.push({
          bx: cx + Math.cos(a) * rr,
          by: cy + Math.sin(a) * rr * 0.85,
          ax: 6 + rand() * 8,
          ay: 6 + rand() * 8,
          sp: 0.00012 + rand() * 0.00016,
          ph: rand() * Math.PI * 2,
          r: 2.2,
          kind: "crew",
          x: 0,
          y: 0,
        });
      }
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        // mostly a loose ring, a few strays further out
        const stray = rand() < 0.12;
        const rr = stray ? R * (1.05 + rand() * 0.5) : R * (0.55 + Math.sqrt(rand()) * 0.5);
        pts.push({
          bx: cx + Math.cos(a) * rr,
          by: cy + Math.sin(a) * rr * 0.88,
          ax: 8 + rand() * 16,
          ay: 8 + rand() * 16,
          sp: 0.00008 + rand() * 0.00018,
          ph: rand() * Math.PI * 2,
          r: rand() < 0.2 ? 1.6 : 1,
          kind: "wallet",
          x: 0,
          y: 0,
        });
      }
    }

    function draw(now: number) {
      const t = now - t0;
      const c = ctx!;
      c.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x = p.bx + Math.sin(t * p.sp + p.ph) * p.ax;
        p.y = p.by + Math.cos(t * p.sp * 0.8 + p.ph * 1.3) * p.ay;
      }
      const caller = pts[0];

      // grey web between neighbouring wallets
      c.lineWidth = 0.6;
      const L2 = linkDist * linkDist;
      for (let i = 1 + crewCount; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          const k = 1 - Math.sqrt(d2) / linkDist;
          c.strokeStyle = `rgba(${INK},${(k * 0.16).toFixed(3)})`;
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
          c.stroke();
        }
      }

      // crew: linked to the caller and to each other
      c.lineWidth = 0.8;
      for (let i = 1; i <= crewCount; i++) {
        const a = pts[i];
        c.strokeStyle = `rgba(${ACCENT},0.42)`;
        c.beginPath();
        c.moveTo(caller.x, caller.y);
        c.lineTo(a.x, a.y);
        c.stroke();
        const b = pts[i === crewCount ? 1 : i + 1];
        c.strokeStyle = `rgba(${ACCENT},0.16)`;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }

      // dots
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        if (p.kind === "wallet") {
          c.fillStyle = `rgba(${INK},${p.r > 1.2 ? 0.7 : 0.38})`;
        } else if (p.kind === "crew") {
          c.fillStyle = `rgb(${ACCENT})`;
        } else {
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
          g.addColorStop(0, `rgba(${ACCENT},0.45)`);
          g.addColorStop(1, `rgba(${ACCENT},0)`);
          c.fillStyle = g;
          c.beginPath();
          c.arc(p.x, p.y, 26, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "#fff";
        }
        c.beginPath();
        c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fill();
      }

      // a crew wallet sells: a ring goes out from it
      if (!reduce && running) {
        if (t > nextPulse) {
          pulses.push({ i: 1 + Math.floor(Math.random() * crewCount), at: t });
          nextPulse = t + 3800 + Math.random() * 3000;
        }
        for (let k = pulses.length - 1; k >= 0; k--) {
          const q = pulses[k];
          const age = (t - q.at) / 1600;
          if (age < 0) continue;
          if (age >= 1) {
            pulses.splice(k, 1);
            continue;
          }
          const p = pts[q.i];
          c.strokeStyle = `rgba(${ACCENT},${((1 - age) * 0.8).toFixed(3)})`;
          c.lineWidth = 1;
          c.beginPath();
          c.arc(p.x, p.y, 3 + age * 30, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }

    function loop(now: number) {
      draw(now);
      if (running) raf = requestAnimationFrame(loop);
    }
    function start() {
      if (reduce || running || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    build();
    draw(t0 + 4000);
    start();

    const ro = new ResizeObserver(() => {
      // resizing clears the canvas, so repaint right away rather than wait for the next frame
      build();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [focusX, focusY, mobileFocusX, mobileFocusY, density, crewCount, seed]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none block h-full w-full ${className}`} />;
}
