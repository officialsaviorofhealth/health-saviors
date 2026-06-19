'use client';

export function NoiseTexture() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden="true">
      <svg className="absolute inset-0 w-full h-full opacity-[0.018]">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    </div>
  );
}
