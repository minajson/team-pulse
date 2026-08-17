"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

/**
 * Ambient background: individual points drifting, finding each other, and
 * forming a network. It is the product's idea in one image — separate people,
 * connected — and it is drawn here rather than played as a video so it scales
 * to any projector, costs no bandwidth, and never has to buffer mid-session.
 *
 * Deliberately slow and low-contrast: it lives behind type that must stay
 * readable from the back of a room.
 */
export function PulseField({
  className,
  tone = "ink",
  density = 34,
  linkDistance = 190,
  speed = 1,
  interactive = false,
}: {
  className?: string;
  tone?: "ink" | "chalk";
  density?: number;
  linkDistance?: number;
  speed?: number;
  interactive?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rgb = tone === "chalk" ? "247, 247, 250" : "30, 62, 240";
    const accent = tone === "chalk" ? "242, 166, 26" : "30, 62, 240";

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let raf = 0;
    let running = true;

    const seed = () => {
      nodes = Array.from({ length: density }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22 * speed,
        vy: (Math.random() - 0.5) * 0.22 * speed,
        r: 1.1 + Math.random() * 2.1,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length === 0) seed();
      if (reduce) draw(0);
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        if (!reduce) {
          node.x += node.vx;
          node.y += node.vy;
          // Wrap rather than bounce — bouncing reads as a boundary, and the
          // point of the image is that the field has no edges.
          if (node.x < -40) node.x = width + 40;
          if (node.x > width + 40) node.x = -40;
          if (node.y < -40) node.y = height + 40;
          if (node.y > height + 40) node.y = -40;
        }

        // A gentle pull toward the pointer, so the join screen feels alive
        // when someone walks up to the laptop.
        const p = pointer.current;
        if (interactive && p && !reduce) {
          const dx = p.x - node.x;
          const dy = p.y - node.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 240 && dist > 1) {
            node.x += (dx / dist) * 0.22;
            node.y += (dy / dist) * 0.22;
          }
        }
      }

      // Links first, so nodes sit on top of them.
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist > linkDistance) continue;
          const strength = 1 - dist / linkDistance;
          ctx.strokeStyle = `rgba(${rgb}, ${strength * 0.16})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const node of nodes) {
        const beat = reduce ? 1 : 0.75 + Math.sin(time / 900 + node.phase) * 0.25;
        ctx.fillStyle = `rgba(${accent}, ${0.16 + beat * 0.2})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * beat, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (time: number) => {
      if (!running) return;
      draw(time);
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => {
      pointer.current = null;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    if (!reduce) raf = requestAnimationFrame(loop);
    if (interactive) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerleave", onLeave);
    }

    // Stop drawing entirely when the tab is hidden — a projector laptop should
    // not burn a core on an invisible canvas.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        running = true;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [tone, density, linkDistance, speed, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
