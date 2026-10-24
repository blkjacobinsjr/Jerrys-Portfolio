import { createRoot } from 'react-dom/client';
import EnterBeam from '../components/EnterBeam';
import ThemeToggle from '../components/ThemeToggle';

/** POLISH (t174): mounts the toggler and the Enter beam only once ?polish=1 is on, so a normal visit never downloads them. */
function mount(parent: Element | null, node: React.ReactNode, first = false) {
  if (!parent) return;
  const host = document.createElement('span');
  host.style.display = 'contents';
  first ? parent.prepend(host) : parent.append(host);
  createRoot(host).render(node);
}

mount(document.body, <ThemeToggle />, true);
mount(document.querySelector('.enter-beam'), <EnterBeam />);
