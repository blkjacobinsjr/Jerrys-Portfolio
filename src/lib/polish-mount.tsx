import { createRoot } from 'react-dom/client';
import ThemeToggle from '../components/ThemeToggle';

/** POLISH (t174): mounts the toggler, and the Enter beam (border-beam, ~12 kB) only while the enter screen is open. */
function mount(parent: Element | null, node: React.ReactNode, first = false) {
  if (!parent) return;
  const host = document.createElement('span');
  host.style.display = 'contents';
  first ? parent.prepend(host) : parent.append(host);
  createRoot(host).render(node);
}

mount(document.body, <ThemeToggle />, true);
if (document.documentElement.dataset.enter === 'open')
  void import('../components/EnterBeam').then(({ default: EnterBeam }) => mount(document.querySelector('.enter-beam'), <EnterBeam />));
