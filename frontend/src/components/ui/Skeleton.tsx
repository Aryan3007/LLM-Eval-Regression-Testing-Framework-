import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
}

export function Skeleton({ width = '100%', height = '1rem', className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      style={{ width, height }}
      className={`rounded bg-stone-200 motion-safe:animate-pulse ${className}`}
    />
  );
}
