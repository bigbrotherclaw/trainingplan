import { useRef, useEffect } from 'react';

/**
 * Animated rotating glow border.
 * 
 * How it works:
 * 1. Outer wrapper has padding (= border width) and the animated gradient background
 * 2. Children sit inside with their own bg, covering the center
 * 3. The gap between outer edge and children = visible "border"
 * 4. A radial gradient highlight moves around the perimeter via JS
 * 
 * No Canvas, no conic-gradient, no mask-composite. Just radial-gradient + JS.
 */
export default function GlowBorder({ 
  color = '#3B82F6', 
  speed = 3, 
  width = 2, 
  radius = 16,
  className = '',
  children 
}) {
  const borderRef = useRef(null);
  const glowRef = useRef(null);

  useEffect(() => {
    const el = borderRef.current;
    const glow = glowRef.current;
    if (!el) return;

    let raf;
    let start;

    const animate = (ts) => {
      if (!start) start = ts;
      const t = ((ts - start) / (speed * 1000)) % 1;

      const rect = el.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(animate); return; }

      // Move along rectangle perimeter
      const perim = 2 * (w + h);
      const pos = t * perim;
      let x, y;
      if (pos < w) { x = pos; y = 0; }
      else if (pos < w + h) { x = w; y = pos - w; }
      else if (pos < 2 * w + h) { x = w - (pos - w - h); y = h; }
      else { x = 0; y = h - (pos - 2 * w - h); }

      const bg = `radial-gradient(circle 60px at ${x}px ${y}px, ${color} 0%, ${color}99 15%, ${color}33 40%, ${color}11 60%, transparent 80%)`;
      el.style.background = bg;

      if (glow) {
        glow.style.background = `radial-gradient(circle 100px at ${x}px ${y}px, ${color}55 0%, ${color}20 30%, transparent 65%)`;
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [color, speed]);

  return (
    <div className={`relative ${className}`}>
      {/* Outer glow (behind everything) */}
      <div
        ref={glowRef}
        className="absolute pointer-events-none"
        style={{
          inset: '-6px',
          borderRadius: `${radius + 6}px`,
          filter: 'blur(12px)',
        }}
      />

      {/* Border layer — this is the visible border */}
      <div
        ref={borderRef}
        className="relative"
        style={{
          padding: `${width}px`,
          borderRadius: `${radius}px`,
          // Fallback static border
          background: `${color}15`,
        }}
      >
        {/* Children go here — they must have their own bg to cover the center */}
        <div style={{ borderRadius: `${Math.max(0, radius - width)}px`, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
