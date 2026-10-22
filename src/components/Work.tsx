import { lazy, Suspense, useState, type CSSProperties } from 'react';
import { Sheet } from 'scrollsheet/auto';
import Drawer from './Drawer';
import WorkGallery from './WorkGallery';
import './Work.css';

const BotAvatar = lazy(() => import('bot-avatars').then((m) => ({ default: m.BotAvatar })));

export interface Shot {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
}

/** A drawer screenshot, with one ~1200px candidate from srcset for the carousel's WebGL texture. */
export interface Screenshot extends Shot {
  texture: string;
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
  shots: [Screenshot, Screenshot, Screenshot];
  phone: Shot;
}

export default function Work({ items }: { items: WorkItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ol className="work-list">
      {items.map((item, index) => (
        <li key={item.id} className="work-item" style={{ '--tint': item.tint, '--i': index } as CSSProperties}>
          {/* Flighty-style feature card: bold lead, muted body, the app in hand.
              The trigger is stretched over the whole card. */}
          <Drawer
            open={openId === item.id}
            onOpenChange={(open) => setOpenId(open ? item.id : null)}
            phone={[0.64, 'full']}
            desktop="560px"
            trigger={
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
            }
          >
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

            <WorkGallery name={item.name} shots={item.shots} open={openId === item.id} />

            <a className="pill-link detail-visit" style={{ '--i': 5 } as CSSProperties} href={item.url} target="_blank" rel="noopener">
              Visit {item.urlLabel}
              <span aria-hidden="true"> ↗</span>
            </a>
            </div>
          </Drawer>
        </li>
      ))}
    </ol>
  );
}
