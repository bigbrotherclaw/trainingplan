import { useRef, useEffect, useState } from 'react';

/**
 * Glowing circulating border — a soft glowing dot orbits the card edge.
 * SVG rounded-rect path with animated dash offset. iOS WKWebView safe.
 */
export default function GlowBorder({
  color = '#3B82F6',
  speed = 4,
  borderWidth = 1.5,
  radius = 16,
  className = '',
  children
}) {
  const containerRef = useRef(null);
  const dotRef = useRef(null);
  const trailRef = useRef(null);
  const dot2Ref = useRef(null);
  const trail2Ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const { offsetWidth: w, offsetHeight: h } = el;
      if (w > 0 && h > 0) setSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const dot = dotRef.current;
    const trail = trailRef.current;
    const dot2 = dot2Ref.current;
    const trail2 = trail2Ref.current;
    if (!dot || !trail || !dot2 || !trail2) return;

    const totalLength = dot.getTotalLength();
    if (!totalLength) return;

    // Dot: tiny bright segment (~4% of perimeter)
    const dotLen = totalLength * 0.04;
    dot.style.strokeDasharray = `${dotLen} ${totalLength - dotLen}`;
    dot2.style.strokeDasharray = `${dotLen} ${totalLength - dotLen}`;
    
    // Trail: soft fade behind the dot (~15% of perimeter)
    const trailLen = totalLength * 0.15;
    trail.style.strokeDasharray = `${trailLen} ${totalLength - trailLen}`;
    trail2.style.strokeDasharray = `${trailLen} ${totalLength - trailLen}`;

    // Half-perimeter offset so snake 2 is exactly opposite snake 1
    const halfLen = totalLength / 2;

    let start;
    let raf;
    const animate = (ts) => {
      if (!start) start = ts;
      const progress = ((ts - start) / (speed * 1000)) % 1;
      const offset1 = totalLength * (1 - progress);
      const offset2 = offset1 + halfLen;
      dot.style.strokeDashoffset = offset1;
      trail.style.strokeDashoffset = offset1;
      dot2.style.strokeDashoffset = offset2;
      trail2.style.strokeDashoffset = offset2;
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [size, speed]);

  const { w, h } = size;
  const r = Math.min(radius, w / 2, h / 2);
  const inset = borderWidth / 2;
  const iw = w - borderWidth;
  const ih = h - borderWidth;
  const ir = Math.max(0, r - inset);

  const d = w > 0 && h > 0
    ? `M ${inset + ir} ${inset} H ${inset + iw - ir} A ${ir} ${ir} 0 0 1 ${inset + iw} ${inset + ir} V ${inset + ih - ir} A ${ir} ${ir} 0 0 1 ${inset + iw - ir} ${inset + ih} H ${inset + ir} A ${ir} ${ir} 0 0 1 ${inset} ${inset + ih - ir} V ${inset + ir} A ${ir} ${ir} 0 0 1 ${inset + ir} ${inset} Z`
    : '';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {w > 0 && h > 0 && (
        <svg
          width={w}
          height={h}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 2 }}
        >
          {/* Static dim border */}
          <path d={d} fill="none" stroke={color} strokeOpacity={0.08} strokeWidth={borderWidth} />
          
          {/* Soft trailing glow — snake 1 */}
          <path
            ref={trailRef}
            d={d}
            fill="none"
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={borderWidth * 3}
            strokeLinecap="round"
          />

          {/* Bright dot — snake 1 */}
          <path
            ref={dotRef}
            d={d}
            fill="none"
            stroke={color}
            strokeOpacity={0.85}
            strokeWidth={borderWidth}
            strokeLinecap="round"
          />

          {/* Soft trailing glow — snake 2 (opposite) */}
          <path
            ref={trail2Ref}
            d={d}
            fill="none"
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={borderWidth * 3}
            strokeLinecap="round"
          />

          {/* Bright dot — snake 2 (opposite) */}
          <path
            ref={dot2Ref}
            d={d}
            fill="none"
            stroke={color}
            strokeOpacity={0.85}
            strokeWidth={borderWidth}
            strokeLinecap="round"
          />
        </svg>
      )}
      <div className="relative" style={{ zIndex: 1, margin: `${borderWidth * 4}px` }}>
        {children}
      </div>
    </div>
  );
}
