import { useRef, useEffect, useState } from 'react';

/**
 * Animated glowing border using a spinning gradient pseudo-element.
 * 
 * Technique: A large square with a conic-gradient rotates behind the card.
 * The card sits on top covering the center. The visible gap between the
 * outer container and the inner card = the animated "border".
 * 
 * CSS transform:rotate() animation is GPU-composited and works in every
 * browser including iOS WKWebView — no @property, no Canvas, no JS animation.
 */
export default function GlowBorder({
  color = '#3B82F6',
  speed = 3,
  borderWidth = 2,
  radius = 16,
  className = '',
  children
}) {
  const spinnerRef = useRef(null);

  useEffect(() => {
    const el = spinnerRef.current;
    if (!el) return;

    let start;
    let raf;

    const animate = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const deg = (elapsed / (speed * 1000)) * 360;
      el.style.transform = `rotate(${deg}deg)`;
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        padding: `${borderWidth}px`,
        borderRadius: `${radius}px`,
        overflow: 'hidden',
      }}
    >
      {/* Spinning gradient element — oversized to fill corners during rotation */}
      <div
        ref={spinnerRef}
        style={{
          position: 'absolute',
          // Center it and make it 200% to cover corners during spin
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: `conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 260deg,
            ${color}44 280deg,
            ${color}88 310deg,
            ${color} 330deg,
            ${color}ff 340deg,
            ${color}88 350deg,
            ${color}44 360deg
          )`,
          willChange: 'transform',
        }}
      />

      {/* Subtle static glow underneath the whole thing */}
      <div
        style={{
          position: 'absolute',
          inset: '-4px',
          borderRadius: `${radius + 4}px`,
          boxShadow: `0 0 20px 2px ${color}33, 0 0 40px 4px ${color}18`,
          pointerEvents: 'none',
        }}
      />

      {/* Inner card — covers the center, leaving the border gap visible */}
      <div
        style={{
          position: 'relative',
          borderRadius: `${Math.max(0, radius - borderWidth)}px`,
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
