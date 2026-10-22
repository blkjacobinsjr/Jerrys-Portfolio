import { lazy, Suspense, useEffect, useState } from 'react';
import TearTicket from './TearTicket';
import { canUseGL } from '../lib/gl';
import { onFirstIntent } from '../lib/intent';
import { mailto, TOPICS, type Topic } from '../lib/letter';
import './Letter.css';

const PaperCrumple = lazy(() => import('./PaperCrumple'));

/**
 * A letter to me, after Carter Ogunsola's contact page. Write it, then tear the stub off the
 * postage ticket (React Bits TearTicket) to send it; crumple the draft note (React Bits
 * PaperCrumple) to start over.
 */
export default function Letter({ email, note }: { email: string; note: string }) {
  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [from, setFrom] = useState('');
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [sent, setSent] = useState(0);
  const [draft, setDraft] = useState(0);
  const [paper, setPaper] = useState(false);

  useEffect(() => setDate(new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date()).toUpperCase()), []);
  useEffect(() => (canUseGL() ? onFirstIntent(() => setPaper(true)) : undefined), []);

  const ready = body.trim().length > 0;
  const status = sent ? 'Sent to your mail app' : ready ? 'Ready to send' : 'Being written';
  const reset = () => {
    setTopic(TOPICS[0]);
    setFrom('');
    setBody('');
    setName('');
    setSent(0);
    setDraft((n) => n + 1);
  };
  const send = () => {
    setSent((n) => n + 1);
    location.href = mailto(email, { topic, from, body, name });
  };

  const noteImage = <img className="letter-note-still" src={note} alt="" width={480} height={320} />;

  return (
    <div className="letter-desk">
      <form className="letter" aria-labelledby="letter-title" onSubmit={(event) => { event.preventDefault(); if (ready) send(); }}>
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

        <button type="submit" className="letter-send" disabled={!ready}>
          Send with your mail app
        </button>
      </form>

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

      <div className="letter-note">
        {paper ? (
          <Suspense fallback={noteImage}>
            <PaperCrumple
              key={`note-${draft}`}
              src={note}
              alt="A draft note: crumple it to start the letter over"
              width={240}
              height={160}
              sceneHeight={220}
              releaseBehavior="restore"
              paperColor="#f4f0e8"
              shadowOpacity={0.06}
              onStateChange={(state) => state === 'crumpled' && reset()}
            />
          </Suspense>
        ) : (
          noteImage
        )}
        <button type="button" className="letter-reset" onClick={reset}>
          Start over
        </button>
      </div>
    </div>
  );
}
