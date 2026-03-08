import { useRef, useEffect, useState } from 'react';

/**
 * Animated rotating glow border.
 * Uses a spinning conic-gradient div behind the card, with the card
 * covering the center — leaving only the edges visible as a border.
 * No mask-composite needed.
 */
export default function GlowBorder({ 
  color = '#3B82F6', 
  speed = 3, 
  width = 2, 
  radius = 16,
  className = '',
  children 
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(dpr, dpr);
    };
    resize();
    
    // Parse hex color to RGB
    const hexToRgb = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };
    const rgb = hexToRgb(color);
    
    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const angle = ((elapsed / (speed * 1000)) * Math.PI * 2) % (Math.PI * 2);
      
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const cx = w / 2;
      const cy = h / 2;
      const borderW = width;
      const r = radius;
      
      ctx.clearRect(0, 0, w, h);
      
      // Draw the border path (rounded rect outline)
      const drawRoundedRect = (x, y, rw, rh, rad) => {
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.lineTo(x + rw - rad, y);
        ctx.arcTo(x + rw, y, x + rw, y + rad, rad);
        ctx.lineTo(x + rw, y + rh - rad);
        ctx.arcTo(x + rw, y + rh, x + rw - rad, y + rh, rad);
        ctx.lineTo(x + rad, y + rh);
        ctx.arcTo(x, y + rh, x, y + rh - rad, rad);
        ctx.lineTo(x, y + rad);
        ctx.arcTo(x, y, x + rad, y, rad);
        ctx.closePath();
      };
      
      // Create clipping region: outer rect minus inner rect = border only
      ctx.save();
      drawRoundedRect(0, 0, w, h, r);
      drawRoundedRect(borderW, borderW, w - borderW * 2, h - borderW * 2, Math.max(0, r - borderW));
      ctx.clip('evenodd');
      
      // Draw the rotating highlight on the border
      // Calculate point on the perimeter for the highlight
      const highlightX = cx + Math.cos(angle) * (w * 0.6);
      const highlightY = cy + Math.sin(angle) * (h * 0.6);
      
      // Subtle base border
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
      ctx.fillRect(0, 0, w, h);
      
      // Bright highlight gradient
      const grad = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, Math.max(w, h) * 0.5);
      grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.95)`);
      grad.addColorStop(0.15, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
      grad.addColorStop(0.35, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
      grad.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      
      ctx.restore();
      
      // Outer glow
      ctx.save();
      const glowGrad = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, Math.max(w, h) * 0.45);
      glowGrad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
      glowGrad.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`);
      glowGrad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
      ctx.fillStyle = glowGrad;
      ctx.filter = 'blur(6px)';
      drawRoundedRect(0, 0, w, h, r);
      drawRoundedRect(borderW + 2, borderW + 2, w - (borderW + 2) * 2, h - (borderW + 2) * 2, Math.max(0, r - borderW - 2));
      ctx.clip('evenodd');
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      
      rafRef.current = requestAnimationFrame(animate);
    };
    
    rafRef.current = requestAnimationFrame(animate);
    
    // Observe size changes
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, [color, speed, width, radius]);

  return (
    <div className={`relative ${className}`} style={{ borderRadius: `${radius}px` }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ borderRadius: `${radius}px` }}
      />
      <div className="relative" style={{ borderRadius: `${radius}px` }}>
        {children}
      </div>
    </div>
  );
}
