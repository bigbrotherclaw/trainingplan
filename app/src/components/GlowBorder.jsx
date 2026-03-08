import { useRef, useEffect } from 'react';

/**
 * A wrapper that adds an animated rotating glow border around its children.
 * Uses a conic-gradient with a bright highlight that orbits the border.
 * 
 * Props:
 *  - color: The highlight color (hex or rgb)
 *  - speed: Rotation speed in seconds (default 3)
 *  - width: Border width in pixels (default 1.5)
 *  - radius: Border radius in pixels (default 16)
 *  - className: Additional classes for the outer wrapper
 *  - children: Content inside the border
 */
export default function GlowBorder({ 
  color = '#3B82F6', 
  speed = 3, 
  width = 1.5, 
  radius = 16,
  glowSize = 40,
  className = '',
  children 
}) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    
    // Inject keyframes if not already present
    const styleId = 'glow-border-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes glow-rotate {
          from { --glow-angle: 0deg; }
          to { --glow-angle: 360deg; }
        }
        @property --glow-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const borderRadius = `${radius}px`;

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      style={{ borderRadius }}
    >
      {/* Rotating gradient border */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          padding: `${width}px`,
          background: `conic-gradient(from var(--glow-angle, 0deg), transparent 0%, transparent 60%, ${color}40 75%, ${color} 80%, ${color}40 85%, transparent 100%)`,
          animation: `glow-rotate ${speed}s linear infinite`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          borderRadius,
        }}
      />
      
      {/* Glow effect (blurred version behind) */}
      <div
        className="absolute inset-0 rounded-[inherit] opacity-50 blur-md"
        style={{
          padding: `${width}px`,
          background: `conic-gradient(from var(--glow-angle, 0deg), transparent 0%, transparent 60%, ${color}30 75%, ${color}80 80%, ${color}30 85%, transparent 100%)`,
          animation: `glow-rotate ${speed}s linear infinite`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          borderRadius,
        }}
      />

      {/* Subtle static border underneath for when highlight is on the other side */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          border: `${width}px solid ${color}15`,
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
