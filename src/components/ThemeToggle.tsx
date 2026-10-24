import { AnimatedThemeToggler } from './ui/animated-theme-toggler';

/** POLISH (t174): Magic UI's toggler, top right, only with ?polish=1. It flips the site's existing light/dark tokens. */
export default function ThemeToggle() {
  if (document.documentElement.dataset.polish !== 'on') return null;
  return <AnimatedThemeToggler className="theme-toggle" aria-label="Toggle theme" />;
}
