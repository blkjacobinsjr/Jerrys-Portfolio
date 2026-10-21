import { lazy, Suspense, useState, type CSSProperties } from 'react';
import { Sheet, type DetentSpec } from 'scrollsheet/auto';
import { useMedia } from '../lib/useMedia';
import '../styles/sheet.css';
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
  tagline: string;
  summary: string;
  years: string;
  role: string;
  platform: string;
  url: string;
  urlLabel: string;
  tint: string;
  logo: string;
  presentation?: 'website';
  story: string;
  shaped: string[];
  proof?: string;
  shots: [Shot, Shot, Shot];
  phone: Shot;
}

const PHONE_DETENTS: DetentSpec[] = [0.64, 'full'];
const DRAWER_DETENTS: DetentSpec[] = ['560px'];

export default function Work({ items }: { items: WorkItem[] }) {
  // Side drawers size from their detents, so desktop gets one fixed width.
  const desktop = useMedia('(min-width: 768px)');
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ol className="work-list">
      {items.map((item, index) => (
        <li key={item.id} className="work-item" style={{ '--tint': item.tint, '--i': index } as CSSProperties}>
          <Sheet.Root
            open={openId === item.id}
            onOpenChange={(open) => setOpenId(open ? item.id : null)}
            side="bottom"
            desktopSide="right"
            detents={desktop ? DRAWER_DETENTS : PHONE_DETENTS}
          >
            {/* Flighty-style feature card: bold lead, muted body, the app in hand.
                The trigger is stretched over the whole card. */}
            <div className="work-face">
              <img className="work-logo" src={item.logo} width={40} height={40} alt={`${item.name} logo`} loading="lazy" decoding="async" />
              <div className="work-copy">
                <h3 className="work-lead">
                  {item.name}. {item.tagline}
                </h3>{' '}
                <p className="work-body">{item.summary}</p>
              </div>
              <p className="work-facts">
                {item.years} · {item.platform}
              </p>
              <span className={`work-shot${item.presentation === 'website' ? ' work-shot-site' : ''}`}>
              <img
                className="work-phone"
                src={item.phone.src}
                srcSet={item.phone.srcset}
                sizes="(min-width: 70rem) 460px, (min-width: 641px) 40vw, 70vw"
                width={item.phone.width}
                height={item.phone.height}
                alt={item.phone.alt}
                loading="lazy"
                decoding="async"
              />
              </span>
              <Sheet.Trigger className="work-card" aria-label={`${item.name}: ${item.summary} Open details`}>
                <span className="work-plus" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </span>
              </Sheet.Trigger>
            </div>

            <Sheet.Content className="sheet">
              <Sheet.Handle />
              <Sheet.Close />
              <div className="sheet-body" data-state={openId === item.id ? 'open' : 'closed'}>
              <header className="detail-lead">
                {item.id === 'scenaryo' && openId === item.id && (
                  <Suspense fallback={<span className="bot-slot" />}>
                    <BotAvatar type="droid" color="#F26A2E" state="default" size={56} />
                  </Suspense>
                )}
                <Sheet.Title className="detail-title">{item.name}</Sheet.Title>
                <Sheet.Description className="muted">{item.summary}</Sheet.Description>
              </header>

              <dl className="detail-facts" style={{ '--i': 1 } as CSSProperties}>
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

              <p className="detail-story" style={{ '--i': 2 } as CSSProperties}>{item.story}</p>

              <h3 className="label detail-label" style={{ '--i': 3 } as CSSProperties}>What I shaped</h3>
              <ul className="detail-list" style={{ '--i': 3 } as CSSProperties}>
                {item.shaped.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {item.proof && <p className="detail-proof muted">{item.proof}</p>}

              <div className="detail-gallery" style={{ '--i': 4 } as CSSProperties} data-scrollsheet-nested-scroll tabIndex={0} role="group" aria-label={`${item.name} screenshots`}>
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

              <a className="pill-link detail-visit" style={{ '--i': 5 } as CSSProperties} href={item.url} target="_blank" rel="noopener">
                Visit {item.urlLabel}
                <span aria-hidden="true"> ↗</span>
              </a>
              </div>
            </Sheet.Content>
          </Sheet.Root>
        </li>
      ))}
    </ol>
  );
}
