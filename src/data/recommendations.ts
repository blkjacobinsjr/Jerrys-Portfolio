import type { ImageMetadata } from 'astro';

import akatosLogo from '../assets/recommendations/logo-akatos.webp';
import dataikuLogo from '../assets/recommendations/logo-dataiku.webp';
import exxetaLogo from '../assets/recommendations/logo-exxeta.webp';
import gateLogo from '../assets/recommendations/logo-gate.webp';
import generalCatalystLogo from '../assets/recommendations/logo-general-catalyst.webp';
import googleLogo from '../assets/recommendations/logo-google.webp';
import microsoftLogo from '../assets/recommendations/logo-microsoft.webp';
import nasaLogo from '../assets/recommendations/logo-nasa.webp';
import omrLogo from '../assets/recommendations/logo-omr.webp';
import christophPortrait from '../assets/recommendations/christoph.webp';
import danPortrait from '../assets/recommendations/dan-goldin.webp';
import gavinPortrait from '../assets/recommendations/gavin.webp';
import ianPortrait from '../assets/recommendations/ian.webp';
import inigoPortrait from '../assets/recommendations/inigo.webp';
import jerryJiangPortrait from '../assets/recommendations/jerry-jiang.webp';
import nikoPortrait from '../assets/recommendations/niko.webp';
import noahPortrait from '../assets/recommendations/noah.webp';
import woundiounPortrait from '../assets/recommendations/woundioun.webp';
import { testimonials, type Testimonial } from './site';

type EmployerPosition = {
  kind: 'employer';
  title: string;
  detail: string;
  company: string;
  companyUrl: string;
  logo: ImageMetadata;
};

type PublicHeadline = {
  kind: 'headline';
  title: string;
  detail: string;
};

export interface Recommendation {
  name: string;
  linkedin: string;
  portrait: ImageMetadata;
  quote: string;
  context: string;
  proof: string;
  position: EmployerPosition | PublicHeadline;
}

const existingTestimonial = (name: string): Testimonial => {
  const testimonial = testimonials.find((item) => item.name === name);
  if (!testimonial) throw new Error(`Missing source testimonial for ${name}`);
  return testimonial;
};

const gavin = existingTestimonial('Gavin Laugenie');
const ian = existingTestimonial('Ian Green');
const christoph = existingTestimonial('Christoph Suessmeier');

export const recommendations: Recommendation[] = [
  {
    name: 'Iñigo Martín-Calero',
    linkedin: 'https://www.linkedin.com/in/icalero',
    portrait: inigoPortrait,
    quote:
      'Jerry turns ambitious ideas into products people want to talk about. I thought sceneXtras was so good that I encouraged him to launch and introduced him to investors and Basebone. The Reddit response and the first 614 sign-ups reflected the interest I was seeing. He combines strong product instincts with the determination to get his work into people’s hands.',
    context: 'Former Clivi founder · supported the SceneXtras launch',
    proof: 'Clivi founder · about €0.9M raised',
    position: {
      kind: 'employer',
      title: 'Account Strategist',
      detail: 'Google · formerly founder of Clivi',
      company: 'Google',
      companyUrl: 'https://google.com/',
      logo: googleLogo,
    },
  },
  {
    name: 'Woundioun Sissoko',
    linkedin: 'https://www.linkedin.com/in/wunni',
    portrait: woundiounPortrait,
    quote:
      'I advised Jerry as he built sceneXtras and saw a two-person team achieve impressive results through organic growth. He stays close to the work and keeps building with a clear vision. I introduced him to founders and investors because I believe in the team and in his ability to turn that vision into a product people value.',
    context: 'Advisor to sceneXtras (2025)',
    proof: '2B+ views for Birkenstock, Lovable, Puma · ex-Interim CMO Layla (acq. by Expedia) · ex-Growth Lovable',
    position: {
      kind: 'employer',
      title: 'Co-founder & CEO',
      detail: 'GATE STUDIOS · advisor to sceneXtras',
      company: 'GATE STUDIOS',
      companyUrl: 'https://www.dont-gate.com/',
      logo: gateLogo,
    },
  },
  {
    name: 'Jerry Jiang',
    linkedin: 'https://www.linkedin.com/in/jerrymjiang',
    portrait: jerryJiangPortrait,
    quote:
      'Jerry is one of the scrappiest builders I know, with the kind of Tobi Lutke energy that keeps a big idea moving. He pitched sceneXtras as “AI that Walt Disney would love,” then backed the ambition with 90-minute average visits, 50.4% D30 retention, paying users before launch, and $0 CAC in 2025. He thinks big and keeps his feet on the ground.',
    context: 'Founder of Akatos · building in Waterloo',
    proof: 'Akatos founder · Vercel AI Accelerator ’25',
    position: {
      kind: 'employer',
      title: 'Candidate for Mayor of Waterloo',
      detail: 'Founder, Akatos',
      company: 'Akatos',
      companyUrl: 'https://akatos.com/',
      logo: akatosLogo,
    },
  },
  {
    name: gavin.name,
    linkedin: 'https://www.linkedin.com/in/gavin-laugenie',
    portrait: gavinPortrait,
    quote: gavin.quote,
    context: gavin.context,
    proof: 'Email Council member, DMA UK',
    position: {
      kind: 'employer',
      title: gavin.title,
      detail: 'Dataiku',
      company: 'Dataiku',
      companyUrl: 'https://www.dataiku.com/',
      logo: dataikuLogo,
    },
  },
  {
    name: ian.name,
    linkedin: 'https://www.linkedin.com/in/igreendesign/',
    portrait: ianPortrait,
    quote: ian.quote,
    context: ian.context,
    proof: '12+ years · fintech · SaaS · AI product design',
    position: {
      kind: 'headline',
      title: ian.title,
      detail: ian.also ?? 'Fintech, product strategy, SaaS and AI',
    },
  },
  {
    name: christoph.name,
    linkedin: 'https://www.linkedin.com/in/csuessmeier',
    portrait: christophPortrait,
    quote: christoph.quote,
    context: christoph.context,
    proof: 'Subzro collaboration · UX/UI craft · product detail',
    position: {
      kind: 'employer',
      title: christoph.title,
      detail: 'Exxeta · Munich',
      company: 'Exxeta',
      companyUrl: 'https://www.exxeta.com/',
      logo: exxetaLogo,
    },
  },
];

type Source =
  | { kind: 'linkedin-post'; href: string; label: string }
  | { kind: 'translation'; label: string }
  | { kind: 'email'; label: string };

type SupportNote = {
  name: string;
  linkedin: string;
  quote: string;
  title: string;
  source: Source;
  company: string;
  companyUrl: string;
  logo: ImageMetadata;
  portrait: { kind: 'image'; image: ImageMetadata; alt: string } | { kind: 'initials'; value: string };
};

export const supportNotes: SupportNote[] = [
  {
    name: 'Dan Goldin',
    linkedin: 'https://www.linkedin.com/in/dansgoldin',
    quote: 'Congrats Jerry Schmalz, good luck lots of support from here!',
    title: '9th NASA Administrator',
    source: {
      kind: 'linkedin-post',
      href: 'https://www.linkedin.com/posts/jasdoughan_late-to-the-linkedin-party-but-weve-been-ugcPost-7222291638549671936-LUng',
      label: 'LinkedIn comment',
    },
    company: 'NASA',
    companyUrl: 'https://www.nasa.gov/',
    logo: nasaLogo,
    portrait: { kind: 'image', image: danPortrait, alt: 'NASA official portrait of Dan Goldin' },
  },
  {
    name: 'Niko Bonatsos',
    linkedin: 'https://www.linkedin.com/in/bonatsos',
    quote: 'Thank you Jerry! Love the mission.',
    title: 'Former MD, General Catalyst · early Snap and Discord backer',
    source: { kind: 'email', label: 'Email' },
    company: 'General Catalyst',
    companyUrl: 'https://www.generalcatalyst.com/',
    logo: generalCatalystLogo,
    portrait: { kind: 'image', image: nikoPortrait, alt: 'Niko Bonatsos' },
  },
  {
    name: 'Noah Leidinger',
    linkedin: 'https://www.linkedin.com/in/noah-leidinger-55737419b',
    quote: 'Just tested a chat with Michael Burry from The Big Short, had to laugh, really cool work.',
    title: 'Managing Director, OMR X',
    source: { kind: 'translation', label: 'Translated from German' },
    company: 'OMR X',
    companyUrl: 'https://omr.com/',
    logo: omrLogo,
    portrait: { kind: 'image', image: noahPortrait, alt: 'Noah Leidinger' },
  },
  {
    name: 'Mike Campbell',
    linkedin: 'https://www.linkedin.com/in/mike-campbell-profile',
    quote: 'I watched the demo video, very impressive!',
    title: 'Microsoft AI Global Growth',
    source: { kind: 'email', label: 'Email' },
    company: 'Microsoft',
    companyUrl: 'https://www.microsoft.com/',
    logo: microsoftLogo,
    portrait: { kind: 'initials', value: 'MC' },
  },
];
