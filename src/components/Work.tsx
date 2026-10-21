import { lazy, Suspense, type CSSProperties } from 'react';
import { Sheet, type DetentSpec } from 'scrollsheet';
import { useMedia } from '../lib/useMedia';
import 'scrollsheet/styles.css';
import '../styles/card-stack.css';
import './Work.css';

const BotAvatar = lazy(() => import('bot-avatars').then((m) => ({ default: m.BotAvatar })));

export interface Shot {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
}

export interface WorkItem {
  id: string;
  name: string;
  summary: string;
  years: string;
  role: string;
  platform: string;
  url: string;
  urlLabel: string;
  tint: string;
  story: string;
  shaped: string[];
  proof?: string;
  shots: [Shot, Shot, Shot];
}

/** Resting pose and fan delta per card, in container units (card-stack-hover recipe geometry). */
const POSES = [
  { cx: '6cqw', cy: '10cqh', rot: '-3deg', dx: '-3cqw', dy: '-5cqh', drot: '-2deg' },
  { cx: '30cqw', cy: '20cqh', rot: '2deg', dx: '3cqw', dy: '3cqh', drot: '2deg' },
  { cx: '76cqw', cy: '14cqh', rot: '5deg', dx: '4cqw', dy: '-4cqh', drot: '4deg' },
] as const;

const SIZES = ['(min-width: 70rem) 680px, 62vw', '(min-width: 70rem) 680px, 62vw', '(min-width: 70rem) 190px, 18vw'];

function Shots({ shots }: { shots: WorkItem['shots'] }) {
  return (
    <span className="t-stack" aria-hidden="true">
      {shots.map((shot, i) => {
        const pose = POSES[i]!;
        const style = {
          '--cx': pose.cx,
          '--cy': pose.cy,
          '--rot': pose.rot,
          '--dx': pose.dx,
          '--dy': pose.dy,
          '--drot': pose.drot,
          zIndex: i,
        } as CSSProperties;
        return (
          <span key={shot.src} className={`t-stack-card ${i === 2 ? 'is-phone' : ''}`} style={style}>
            <img
              src={shot.src}
              srcSet={shot.srcset}
              sizes={SIZES[i]}
              width={shot.width}
              height={shot.height}
              alt=""
              loading="lazy"
              decoding="async"
            />
          </span>
        );
      })}
    </span>
  );
}

const PHONE_DETENTS: DetentSpec[] = [0.64, 'full'];
const DRAWER_DETENTS: DetentSpec[] = ['560px'];

export default function Work({ items }: { items: WorkItem[] }) {
  // Side drawers size from their detents, so desktop gets one fixed width.
  const desktop = useMedia('(min-width: 768px)');
  return (
    <ol className="work-list">
      {items.map((item, index) => (
        <li key={item.id} className="work-item" style={{ '--tint': item.tint, '--i': index } as CSSProperties}>
          <Sheet.Root side="bottom" desktopSide="right" detents={desktop ? DRAWER_DETENTS : PHONE_DETENTS}>
            <Sheet.Trigger className="work-card" aria-label={`${item.name}: ${item.summary} Open details`}>
              <Shots shots={item.shots} />
            </Sheet.Trigger>
            <div className="work-meta">
              <h3>{item.name}</h3>
              <p className="muted">{item.summary}</p>
              <span className="work-years">{item.years}</span>
            </div>

            <Sheet.Content className="work-sheet">
              <Sheet.Handle />
              <Sheet.Close />
              <header className="work-sheet-head">
                {item.id === 'scenaryo' && (
                  <Suspense fallback={<span className="bot-slot" />}>
                    <BotAvatar type="droid" color="#F26A2E" state="default" size={56} />
                  </Suspense>
                )}
                <Sheet.Title className="work-sheet-title">{item.name}</Sheet.Title>
                <Sheet.Description className="muted">{item.summary}</Sheet.Description>
              </header>

              <dl className="work-facts">
                <div>
                  <dt>Role</dt>
                  <dd>{item.role}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{item.platform}</dd>
                </div>
                <div>
                  <dt>When</dt>
                  <dd>{item.years}</dd>
                </div>
              </dl>

              <p className="work-story">{item.story}</p>

              <h3 className="label">What I shaped</h3>
              <ul className="work-shaped">
                {item.shaped.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {item.proof && <p className="work-proof muted">{item.proof}</p>}

              <div className="work-gallery" data-scrollsheet-nested-scroll tabIndex={0} role="group" aria-label={`${item.name} screenshots`}>
                {item.shots.map((shot) => (
                  <img
                    key={shot.src}
                    src={shot.src}
                    srcSet={shot.srcset}
                    sizes="(min-width: 768px) 480px, 90vw"
                    width={shot.width}
                    height={shot.height}
                    alt={shot.alt}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>

              <a className="pill-link" href={item.url} target="_blank" rel="noopener">
                Visit {item.urlLabel}
                <span aria-hidden="true"> ↗</span>
              </a>
            </Sheet.Content>
          </Sheet.Root>
        </li>
      ))}
    </ol>
  );
}
