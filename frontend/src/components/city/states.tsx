import { type ReactNode, useState } from 'react';

import Icon from '../Icon';

/* What a section shows while it loads, and when its data doesn't arrive. */

/** A section's data failed: plain words, Try again, and the technical message one click away. */
export function SectionError({
  title,
  text = 'Everything else on this page still works.',
  error,
  onRetry,
}: {
  title: string;
  text?: string;
  error: unknown;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const message = error instanceof Error ? error.message : '';
  return (
    <div className="card">
      <div className="state-card" role="status">
        <span className="state-ic warn">
          <Icon name="alert" size={22} />
        </span>
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="acts">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            Try again
          </button>
          {message && (
            <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? 'Hide details' : 'Show details'}
            </button>
          )}
        </div>
        {open && <div className="state-detail">{message}</div>}
      </div>
    </div>
  );
}

/** Nothing to show, with a reason and a way out. */
export function EmptyState({
  icon,
  title,
  text,
  children,
}: {
  icon: ReactNode;
  title: string;
  text: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="state-card center">
      <span className="state-ic">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children && <div className="acts">{children}</div>}
    </div>
  );
}

/** Grey bars in the shape of a card, while its data loads. */
export function CardSkeleton({ lines = 4, tall = false }: { lines?: number; tall?: boolean }) {
  return (
    <div className={`card sec-skel${tall ? ' tall' : ''}`} aria-hidden="true">
      <div className="card-b">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className={`skel sk-line w${index % 4}`} />
        ))}
      </div>
    </div>
  );
}
