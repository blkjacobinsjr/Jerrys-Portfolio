import type { ImageMetadata } from 'astro';

import scenaryo1 from '../assets/work/scenaryo-1.webp';
import scenaryo2 from '../assets/work/scenaryo-2.webp';
import scenaryo3 from '../assets/work/scenaryo-3.webp';
import tiding1 from '../assets/work/tiding-1.webp';
import tiding2 from '../assets/work/tiding-2.webp';
import tiding3 from '../assets/work/tiding-3.webp';
import foodnote1 from '../assets/work/foodnote-1.webp';
import foodnote2 from '../assets/work/foodnote-2.webp';
import foodnote3 from '../assets/work/foodnote-3.webp';
import subzro1 from '../assets/work/subzro-1.webp';
import subzro2 from '../assets/work/subzro-2.webp';
import subzro3 from '../assets/work/subzro-3.webp';
import thumbScenextras from '../assets/work/thumb-scenextras.webp';
import thumbPokefight from '../assets/work/thumb-pokefight.webp';
import thumbPriori from '../assets/work/thumb-priori.webp';
import thumbFoodie from '../assets/work/thumb-foodie.webp';
import thumbBienmonk from '../assets/work/thumb-bienmonk.webp';
import personChristoph from '../assets/work/person-christoph.webp';
import personEnrique from '../assets/work/person-enrique.webp';
import draperAward from '../assets/stops/draper-award.webp';
import buildspaceGrad from '../assets/stops/buildspace-grad.webp';
import buildspaceBadge from '../assets/stops/buildspace-badge.webp';

export const person = {
  name: 'Jerry Doughan',
  role: 'Product designer and frontend developer',
  email: 'jr.a.schmalz@gmail.com',
  linkedin: 'https://www.linkedin.com/in/jasdoughan/',
  github: 'https://github.com/blkjacobinsjr',
  spotify: 'https://open.spotify.com/playlist/2oMArrXe9JmGpjVJ5z6lds',
  cv: '/jerry-doughan-cv.pdf',
} as const;

export interface Project {
  id: string;
  name: string;
  summary: string;
  years: string;
  role: string;
  platform: string;
  url: string;
  urlLabel: string;
  /** Brand tint for the card surface, as an OKLCH color. */
  tint: string;
  /** Desktop, desktop, phone. The phone frame sits on top of the stack. */
  shots: [ImageMetadata, ImageMetadata, ImageMetadata];
  shotAlts: [string, string, string];
  story: string;
  shaped: string[];
  proof?: string;
}

export const projects: Project[] = [
  {
    id: 'scenaryo',
    name: 'Scenaryo',
    summary: 'Talk to the characters you love, and shape the scene as it unfolds.',
    years: 'Now',
    role: 'Co-founder. Product, design, frontend',
    platform: 'Web, iOS, Android',
    url: 'https://scenaryo.app/research',
    urlLabel: 'scenaryo.app',
    tint: 'oklch(0.93 0.045 45)',
    shots: [scenaryo1, scenaryo2, scenaryo3],
    shotAlts: [
      'Scenaryo landing page: Characters that feel impossibly real',
      'Scenaryo video section: See a scene come to life',
      'Scenaryo iPhone app with the scene theme picker open',
    ],
    story:
      'The evolution of SceneXtras. You enter a story mid-conflict, earn a character’s trust, and steer where it goes. Characters remember you, keep their boundaries, and stay true to their arc.',
    shaped: [
      'Character system design: memory, boundaries, and trust that has to be earned.',
      'Voice and text chat, scene rewinds, and crossover group chats on iPhone.',
      'A web and native product language that feels like a film, not a chat window.',
    ],
    proof: 'Part of Microsoft for Startups, Google for Startups, ElevenLabs, NVIDIA Inception, and LAUNCH.',
  },
  {
    id: 'tiding',
    name: 'Tiding',
    summary: 'A peptide tracker where Pip keeps the daily check-in friendly.',
    years: '2026',
    role: 'Co-founder, sceneXtras Inc.',
    platform: 'iOS',
    url: 'https://trytiding.app/',
    urlLabel: 'trytiding.app',
    tint: 'oklch(0.93 0.035 230)',
    shots: [tiding1, tiding2, tiding3],
    shotAlts: [
      'Tiding landing page: Peptide tracker app, peptides meet personality',
      'Tiding section: Your protocol has a rhythm, keep the record current',
      'Tiding on iPhone with the mascot Pip',
    ],
    story:
      'Doses, injection sites, vial levels, bloodwork, supplements, and notes in one place. The routine stays clear, and a small mascot named Pip makes the check-in something you want to do.',
    shaped: [
      'One-tap logging: the dose, the site, the time.',
      'Today at a glance: what is due now and what is still ahead.',
      'A mascot that gives a clinical routine some personality.',
    ],
  },
  {
    id: 'foodnote',
    name: 'FoodNote',
    summary: 'Calorie tracking with AI meal logging and a hamster named Hammy.',
    years: 'Live',
    role: 'Design and frontend',
    platform: 'Web',
    url: 'https://food-note-frontend.vercel.app/',
    urlLabel: 'food-note-frontend.vercel.app',
    tint: 'oklch(0.93 0.04 70)',
    shots: [foodnote1, foodnote2, foodnote3],
    shotAlts: [
      'FoodNote landing page: Your calories, actually tracked',
      'FoodNote section: Less calculating, more living',
      'FoodNote Today screen with remaining calories and weight trend',
    ],
    story:
      'Describe a meal in plain words and the math is done for you. A weight journal that remembers, and a plan that adapts while it keeps you above a safe floor.',
    shaped: [
      'Describe it, we do the math: free-text meals turned into calories and macros.',
      'A projected goal date that moves with every weigh-in.',
      'Hammy, a calorie-tracking pet you can drag around the page.',
    ],
  },
  {
    id: 'subzro',
    name: 'Subzro',
    summary: 'Subscription intelligence that turns recurring charges into clear decisions.',
    years: '2023',
    role: 'Product direction, UI design, frontend',
    platform: 'Web, mobile first',
    url: 'https://subzro.vercel.app/',
    urlLabel: 'subzro.vercel.app',
    tint: 'oklch(0.92 0.04 265)',
    shots: [subzro1, subzro2, subzro3],
    shotAlts: [
      'Subzro dashboard on iPhone with monthly spend',
      'Subzro insights overview',
      'Subzro subscription dashboard',
    ],
    story:
      'Most subscription apps stop at listing charges. Subzro frames recurring spend as a living system: what costs the most, what gets used the least, and what you can win back today.',
    shaped: [
      'One dashboard for monthly exposure, top spend, and alerts.',
      'Savings framed as money you can win back, not budget advice.',
      'No bank link required, so trust starts in the first session.',
    ],
  },
];

export interface EarlierWork {
  name: string;
  note: string;
  year: string;
  url?: string;
  thumb: ImageMetadata;
}

export const earlier: EarlierWork[] = [
  {
    name: 'SceneXtras',
    note: 'Chat with story-accurate characters in 3 taps. 30 min average sessions, 1.5k waitlist.',
    year: '2023',
    url: 'https://scenextras.com',
    thumb: thumbScenextras,
  },
  { name: 'PokeFight', note: 'A turn-based web game on the PokéAPI.', year: '2023', url: 'https://wbs-poke-fight.vercel.app/', thumb: thumbPokefight },
  { name: 'Foodie Recipes', note: 'A recipe site on a headless CMS.', year: '2023', url: 'https://wbs-cookbook-express.vercel.app/', thumb: thumbFoodie },
  { name: 'Priori', note: 'A to-do list that asks you questions to rank your tasks.', year: '2023', url: 'https://jnyjdk.csb.app/', thumb: thumbPriori },
  { name: 'Bien Monk, Blackman', note: 'Song, video concept, and the ad campaign behind it.', year: '2022', thumb: thumbBienmonk },
];

export interface Stop {
  id: string;
  when: string;
  place: string;
  title: string;
  where: string;
  notes: string[];
  /** The diorama's most prominent colour, art-directed; lights the glow behind it. */
  glow: string;
  /** Badge shown on the stop; "now" marks the current one. */
  flag?: 'now' | 'declined' | 'side';
  story?: string;
  photos?: { src: ImageMetadata; alt: string }[];
  link?: { href: string; label: string };
}

/** Career path, oldest first. Dioramas live in src/assets/icons/<id>.webp. */
export const path: Stop[] = [
  {
    id: 'coventry',
    glow: '#d0623f',
    when: '2013',
    place: 'Coventry University',
    title: 'BA Advertising and Marketing',
    where: 'Coventry, UK',
    notes: ['Dissertation: sustainable development as a marketing strategy.', 'Before that, a BTEC in creative media production at Telford College.'],
  },
  {
    id: 'workinghana',
    glow: '#f2b149',
    when: 'Uni',
    place: 'Work in Ghana',
    title: 'Student project',
    where: 'While at university',
    notes: ['Bootstrapped as a student project, defying geographical constraints.'],
    flag: 'side',
  },
  {
    id: 'opentable',
    glow: '#2f6a4a',
    when: '2017',
    place: 'OpenTable',
    title: 'Bilingual customer support',
    where: 'London',
    notes: ['Supported diners in German and English on iOS and Android.', 'Trained restaurants on the reservation system and designed their floor plans.'],
  },
  {
    id: 'dotdigital',
    glow: '#6f9fc8',
    when: '2018',
    place: 'Dotdigital',
    title: 'EMEA marketing executive',
    where: 'London',
    notes: ['Campaigns that brought in Vodafone Germany, Kuehne + Nagel, and Dörr Group.', 'Launched a localized website and ran PPC and SEO.'],
  },
  {
    id: 'siteminder',
    glow: '#c79a55',
    when: '2020',
    place: 'SiteMinder',
    title: 'DACH marketing and events',
    where: 'London',
    notes: ['The link between the global marketing director, partnerships, BDRs, and sales.', 'Turned Tableau, Marketo, and Analytics data into monthly strategy reports.'],
  },
  {
    id: 'peloton',
    glow: '#d49a5e',
    when: '2021',
    place: 'Peloton',
    title: 'Bilingual member advisor',
    where: 'London',
    notes: ['Technical support for VIP members.', 'Wrote troubleshooting guides and fed product suggestions back to the hardware and software teams.'],
  },
  {
    id: 'tiktokdeclined',
    glow: '#e0a640',
    when: '2022',
    place: 'TikTok',
    title: 'Offer declined',
    where: 'Berlin',
    notes: ['Said no to TikTok and went to Benify instead.'],
    flag: 'declined',
  },
  {
    id: 'benify',
    glow: '#c98a4b',
    when: '2022',
    place: 'Benify',
    title: 'Field marketing specialist',
    where: 'Berlin',
    notes: ['Beat the previous regional campaigns by 50%.', '32.35% email open rate and a 7% average click-through rate on leads.', 'Brought in media partners like totalrewards.de and FAZ.'],
  },
  {
    id: 'hkw',
    glow: '#5fb3c4',
    when: '2023',
    place: 'Haus der Kulturen der Welt',
    title: 'Executive assistant to the director',
    where: 'Berlin',
    notes: ['Primary contact and scheduler for the director’s cultural program.', 'Helped prepare openings and major events.'],
  },
  {
    id: 'wbs',
    glow: '#a04a2c',
    when: '2023',
    place: 'WBS Coding School',
    title: 'Web development',
    where: 'Berlin',
    notes: ['From "Hello, World!" to a full-stack app in four months.', 'Final project: Subzro. Plus a Google UX certificate with 100% on every course.'],
  },
  {
    id: 'buildspace',
    when: '2024',
    place: 'buildspace',
    title: 'nights & weekends, season 5',
    where: 'Online and San Francisco',
    glow: '#4b5fb0',
    story: 'Season 5 of nights & weekends, buildspace’s six-week program for building an idea on nights and weekends. I came out a graduate.',
    notes: ['The format: start any idea from zero and leave with its first fans, users, or revenue.', 'Graduated, with the San Francisco badge and lanyard to show for it.'],
    photos: [
      { src: buildspaceBadge, alt: 'A black nights and weekends season 5 San Francisco badge on a buildspace lanyard' },
      { src: buildspaceGrad, alt: 'A white buildspace grad badge on a buildspace lanyard' },
    ],
  },
  {
    id: 'draper',
    when: '2024',
    place: 'Draper University',
    title: 'Degree of Change Agent',
    where: 'San Mateo and San Francisco',
    glow: '#3f78c4',
    story:
      'Hero training at Tim Draper’s school for founders. We paddled through shark-infested water, hiked 20 miles a day, sat through 10-minute ice baths, shot rifles, and learned to build as a team. It ended on stage, pitching to Tim Draper himself.',
    notes: [
      'Demo day: my demo went rogue on stage, so I showed Tim the app on my phone. The character I picked was Tim himself, from the film Trust Machine.',
      '“Six million characters?” he asked. That was the scale of it.',
      'I prepped for the pitch with an AI version of Tim that gave me tips.',
      'Our waitlist passed 300 sign-ups in its first week. 104 other founders made the journey with me.',
    ],
    photos: [{ src: draperAward, alt: 'The glass Draper University award conferring the Degree of Change Agent, Summer 2024' }],
    link: {
      href: 'https://www.linkedin.com/posts/jasdoughan_demo-day-at-draper-university-was-wild-picture-ugcPost-7223066913948532736-DZw1/',
      label: 'Read the demo day story',
    },
  },
  {
    id: 'scenaryo',
    glow: '#e5483a',
    when: 'Now',
    place: 'Scenaryo',
    title: 'Co-founder',
    where: 'Berlin',
    notes: ['Building a fanfiction layer for movies: talk to the characters you love.'],
    flag: 'now',
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  context: string;
  avatar: ImageMetadata;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "Jerry's greatest strength is his extraordinary eye for user experience and user interface design. He pays attention to the smallest details that can elevate an app from ‘good’ to ‘great,’ and from ‘great’ to ‘delightful’.",
    name: 'Christoph Suessmeier',
    context: 'Subzro collaborator',
    avatar: personChristoph,
  },
  {
    quote:
      "I wholeheartedly recommend Jerry, whose transition from marketing to mastering web development showcases an adaptability and passion for technology that's as contagious as his 'can-do' mindset…",
    name: 'Enrique Coscarelli',
    context: 'Former bootcamp instructor',
    avatar: personEnrique,
  },
];
