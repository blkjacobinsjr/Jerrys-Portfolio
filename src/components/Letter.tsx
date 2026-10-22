import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import TearTicket from './TearTicket';
import { canUseGL } from '../lib/gl';
import { cue } from '../lib/sound';
import { mailto, openMail, sheetImage, TOPICS, type Topic } from '../lib/letter';
import './Letter.css';

const PaperCrumple = lazy(() => import('./PaperCrumple'));

/** How long the crumple and the opening take (seconds in PaperCrumple, milliseconds here), and the longest we wait for the paper. */
const CRUMPLE_MS = 650;
const OPEN_MS = 900;
const GIVE_UP_MS = 4000;
const MARGIN = 24;

type Act = 'intro' | 'reset';
interface Sheet {
  width: number;
  height: number;
  fill: string;
}

/**
 * A letter to me, after Carter Ogunsola's contact page. Write it, then tear the stub off the
 * postage ticket (React Bits TearTicket) to send it. The whole letter is a sheet of React Bits
 * PaperCrumple while it opens on load and when you start over; reduced motion keeps it still.
 */
export default function Letter({ email }: { email: string }) {
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [from, setFrom] = useState('');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [sent, setSent] = useState(0);
  const [draft, setDraft] = useState(0);
  const [act, setAct] = useState<Act | null>(null);
  const [crumpled, setCrumpled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const letter = useRef<HTMLFormElement>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };
  const measure = (): Sheet | null => {
    const el = letter.current;
    if (!el || !canUseGL()) return null;
    const box = el.getBoundingClientRect();
    return { width: box.width, height: box.height, fill: getComputedStyle(el).backgroundColor };
  };
  const play = (next: Act) => {
    const size = measure();
    if (!size) return false;
    clear();
    setSheet(size);
    setCrumpled(false);
    setHidden(next === 'intro');
    setAct(next);
    // If the paper never arrives (slow network, lost WebGL context) the letter must not stay hidden.
    later(done, GIVE_UP_MS);
    return true;
  };
  const done = () => {
    clear();
    setAct(null);
    setHidden(false);
  };

  useEffect(() => setDate(new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()), []);
  useLayoutEffect(() => {
    play('intro');
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = body.trim().length > 0;
  const status = sent ? 'Sent to your mail app' : ready ? 'Ready to send' : 'Being written';
  const blank = () => {
    setTopic(TOPICS[0]);
    setFrom('');
    setBody('');
    setName('');
    setSent(0);
    setDraft((n) => n + 1);
  };
  const startOver = () => {
    cue('crumple');
    if (act || !play('reset')) blank();
  };
  // The paper is on screen: for the intro it opens by itself, for a reset it crumples first, the letter is wiped while it is balled up, then it opens blank.
  const onReady = () => {
    clear();
    if (act === 'reset') {
      setHidden(true);
      setCrumpled(true);
      later(blank, CRUMPLE_MS / 2);
      later(() => setCrumpled(false), CRUMPLE_MS);
      later(done, CRUMPLE_MS + OPEN_MS);
    } else later(done, OPEN_MS);
  };
  const send = () => {
    setSent((n) => n + 1);
    cue('success');
    openMail(mailto(email, { topic, from, body, name }));
  };

  return (
    <div className="letter-desk" data-act={act ?? undefined}>
      <form ref={letter} className="letter" data-hidden={hidden ? '' : undefined} aria-labelledby="letter-title" onSubmit={(event) => { event.preventDefault(); if (ready) send(); }}>
        <header className="letter-head">
          <span className="letter-mark" aria-hidden="true">JD</span>
          <div>
            <h1 id="letter-title">Jerry Doughan</h1>
            <p>Product designer &amp; frontend developer</p>
            <p>{email} · Berlin</p>
          </div>
        </header>

        <p className="letter-date">{date}</p>
        <p className="letter-dear">Dear Jerry,</p>

        <fieldset className="letter-re">
          <legend>Re ::</legend>
          {TOPICS.map((t) => (
            <label key={t}>
              <input type="radio" name="topic" value={t} checked={topic === t} onChange={() => setTopic(t)} />
              <span aria-hidden="true">[{topic === t ? 'x' : ' '}]</span> {t}
            </label>
          ))}
        </fieldset>

        <label className="letter-line">
          <span>From ::</span>
          <input type="email" name="from" autoComplete="email" placeholder="you@studio.com" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>

        <label className="letter-body">
          <span className="sr-only">Your message</span>
          <textarea name="message" rows={6} placeholder="What are we making?" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        <p className="letter-sincerely">Sincerely,</p>
        <label className="letter-line letter-sign">
          <span className="sr-only">Your name</span>
          <input type="text" name="name" autoComplete="name" placeholder="your name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="letter-actions">
          <button type="submit" className="letter-send" disabled={!ready}>
            Send with your mail app
          </button>
          <button type="button" className="letter-reset" onClick={startOver}>
            Start over
          </button>
        </div>
      </form>

      {act && sheet ? (
        <div className="letter-paper" style={{ top: -MARGIN, left: -MARGIN, width: sheet.width + 2 * MARGIN, height: sheet.height + 2 * MARGIN }} aria-hidden="true">
          <Suspense fallback={null}>
            <PaperCrumple
              src={sheetImage(sheet.width, sheet.height, sheet.fill)}
              alt=""
              width={sheet.width}
              height={sheet.height}
              sceneHeight={sheet.height + 2 * MARGIN}
              releaseBehavior="restore"
              crumpleDuration={CRUMPLE_MS / 1000}
              releaseDuration={OPEN_MS / 1000}
              paperColor={sheet.fill}
              shadowOpacity={0.1}
              draggable={false}
              disabled
              startCrumpled={act === 'intro'}
              crumpled={crumpled}
              onReady={onReady}
              onError={done}
            />
          </Suspense>
        </div>
      ) : null}

      <div className="letter-ticket">
        <TearTicket
          key={`ticket-${draft}`}
          orientation="vertical"
          width={232}
          height={340}
          stubSize={92}
          radius={6}
          holes={14}
          holeSize={5}
          rotate={3}
          tiltMax={6}
          background="#f4f0e8"
          stubBackground="#ece6da"
          color="#1c1b19"
          disabled={!ready}
          onTear={send}
          ariaLabel={ready ? 'Tear to send: tear off the stub to send the letter' : 'Write first, then tear off the stub to send it'}
          stub={
            <span className="ticket-stub">
              <span className="ticket-barcode" aria-hidden="true" />
              {ready ? 'Tear to send' : 'Write first'}
            </span>
          }
        >
          <dl className="ticket-body">
            <dt className="ticket-title">Jerry Doughan :: Post</dt>
            <dd>Berlin · Counter 01</dd>
            <dt>Re</dt>
            <dd>{topic}</dd>
            <dt>From</dt>
            <dd>{from || '—'}</dd>
            <dt>Status</dt>
            <dd><span role="status">{status}</span></dd>
          </dl>
        </TearTicket>
      </div>
    </div>
  );
}
