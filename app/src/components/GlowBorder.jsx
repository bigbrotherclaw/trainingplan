import { useRef, useEffect, useState } from 'react';

/**
 * Animated rotating glow border using requestAnimationFrame.
 * A bright highlight segment orbits the card border continuously.
 * 
 * Works in all browsers including iOS WKWebView (no @property needed).
 */
export default function GlowBorder({ 
  color = '#3B82F6', 
  speed = 3, 
  width = 1.5, 
  radius = 16,
  className = '',
  children 
}) {
  const [angle, setAngle] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const deg = (elapsed / (speed * 1000)) * 360 % 360;
      setAngle(deg);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [speed]);

  const borderRadius = `${radius}px`;
  const gradient = `conic-gradient(from ${angle}deg, transparent 0%, transparent 55%, ${color}40 70%, ${color} 78%, ${color}ee 82%, ${color}40 90%, transparent 100%)`;
  const glowGradient = `conic-gradient(from ${angle}deg, transparent 0%, transparent 55%, ${color}25 70%, ${color}60 78%, ${color}50 82%, ${color}25 90%, transparent 100%)`;

  const maskStyle = {
    WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  };

  return (
    <div className={`relative ${className}`} style={{ borderRadius }}>
      {/* Glow (blurred, behind) */}
      <div
        className="absolute -inset-1 rounded-[inherit] opacity-60"
        style={{
          background: glowGradient,
          filter: 'blur(8px)',
          borderRadius: `${radius + 4}px`,
        }}
      />

      {/* Sharp rotating border */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          padding: `${width}px`,
          background: gradient,
          ...maskStyle,
          borderRadius,
        }}
      />

      {/* Subtle static border for when highlight is on the other side */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          border: `${width}px solid ${color}18`,
          borderRadius,
        }}
      />

      {/* Content */}
      <div className="relative" style={{ borderRadius }}>
        {children}
      </div>
    </div>
  );
}
