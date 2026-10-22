import './StopLogo.css';

/**
 * An organisation's mark for a path stop: in the drawer header and, smaller, on the path rail.
 * Pass `decorative` where the organisation's name sits right beside it.
 */
export default function StopLogo({ src, name, size, decorative = false, className }: { src: string; name: string; size: number; decorative?: boolean; className?: string }) {
  return (
    <img
      className={className ? `stop-logo ${className}` : 'stop-logo'}
      src={src}
      width={size}
      height={size}
      alt={decorative ? '' : `${name} logo`}
      loading="lazy"
      decoding="async"
    />
  );
}
