import { useRef, useState } from 'react';
import { BorderBeam } from 'border-beam';
import { toast, Toaster } from 'scrollsheet';
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

  return (
    <div className="t-confetti-stage contact-stage" ref={stage}>
      <canvas className="t-confetti-canvas" ref={canvas} aria-hidden="true" />
      <BorderBeam size="pulse-inner" colorVariant="sunset" theme={scheme} borderRadius={999} className="contact-beam">
        <button ref={button} type="button" className="contact-btn" onClick={copy}>
          {copied ? 'Copied' : 'Copy email'}
        </button>
      </BorderBeam>
      <a className="contact-mail" href={`mailto:${email}`}>
        {email}
      </a>
      <Toaster position="top-center" theme={scheme} />
    </div>
  );
}
