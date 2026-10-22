import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Sheet, type DetentSpec } from 'scrollsheet/auto';
import { OVERLAY_ATTR, lockScroll } from '../lib/overlay';
import { cue } from '../lib/sound';
import { useMedia } from '../lib/useMedia';
import '../styles/sheet.css';

/**
 * The site's one overlay: a bottom sheet on phones, a right-hand drawer from 768px.
 * scrollsheet supplies the native modal <dialog> (focus trap, Escape, inert page);
 * this adds the overlay contract from src/lib/overlay.ts: the panel is its own
 * scroll container, page-level scroll handlers ignore it, and the page behind it
 * is locked in place while it is open. Every overlay goes through here.
 */
export default function Drawer({
  open,
  onOpenChange,
  phone,
  desktop,
  className,
  style,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Detents on phones, as fractions of the screen or 'full'. */
  phone: DetentSpec[];
  /** The drawer's fixed width from 768px. */
  desktop: DetentSpec;
  className?: string;
  style?: CSSProperties;
  /** A Sheet.Trigger (or anything around one) that opens this drawer. */
  trigger?: ReactNode;
  children: ReactNode;
}) {
  const wide = useMedia('(min-width: 768px)');
  useEffect(() => (open ? lockScroll() : undefined), [open]);
  useEffect(() => { if (open) cue('bloom'); }, [open]);
  const detents = wide ? [desktop] : phone;
  // Controlled, so a drawer that closed fully expanded opens at its first detent again, not at the last one.
  const [detent, setDetent] = useState<DetentSpec>();

  return (
    <Sheet.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => isOpen || setDetent(undefined)}
      activeDetent={detent !== undefined && detents.includes(detent) ? detent : detents[0]}
      onActiveDetentChange={setDetent}
      side="bottom"
      desktopSide="right"
      detents={detents}
    >
      {trigger}
      <Sheet.Content className={className ? `sheet ${className}` : 'sheet'} style={style} {...{ [OVERLAY_ATTR]: '' }}>
        <Sheet.Handle />
        <Sheet.Close />
        {children}
      </Sheet.Content>
    </Sheet.Root>
  );
}
