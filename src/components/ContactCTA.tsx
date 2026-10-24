import { useEffect, useRef, useState } from 'react';
import { BorderBeam } from 'border-beam';
import { toast, Toaster } from 'scrollsheet/auto';
import { useConfettiBurst } from '../lib/confetti-burst.js';
import { useColorScheme } from '../lib/useMedia';
import './ContactCTA.css';

/** Copy-email CTA: a breathing border beam, and confetti that lands on the button once it is copied. */
export default function ContactCTA({ email }: { email: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const burst = useConfettiBurst(stage, canvas, button);
  const scheme = useColorScheme();
  const [copied, setCopied] = useState(false);
  // The beam's generated stylesheet is large; render it only once mounted, so it never ships in the HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // The beam breathes only while the button is on screen and the tab is visible; otherwise its loop rests.
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let seen = false;
    const sync = () => setLive(seen && document.visibilityState !== 'hidden');
    const io = new IntersectionObserver(([entry]) => {
      seen = Boolean(entry?.isIntersecting);
      sync();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      location.href = `mailto:${email}`;
      return;
    }
    setCopied(true);
    burst();
    toast.success('Email copied', { description: email });
    setTimeout(() => setCopied(false), 2400);
  }

  const cta = (
    <button ref={button} type="button" className="contact-btn" onClick={copy}>
      <span className="t-icon-swap" data-state={copied ? 'b' : 'a'} aria-hidden="true">
        <svg className="t-icon" data-icon="a" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
        <svg className="t-icon" data-icon="b" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </span>
      {copied ? 'Copied' : 'Copy email'}
    </button>
  );

  return (
    <div className="t-confetti-stage contact-stage" ref={stage}>
      <canvas className="t-confetti-canvas" ref={canvas} aria-hidden="true" />
      {mounted ? (
        <BorderBeam active={live} size="pulse-inner" colorVariant="sunset" theme={scheme} borderRadius={999} className="contact-beam">
          {cta}
        </BorderBeam>
      ) : (
        <div className="contact-beam">{cta}</div>
      )}
      <a className="contact-mail" href={`mailto:${email}`}>
        {email}
      </a>
      <Toaster position="top-center" theme={scheme} />
    </div>
  );
}
