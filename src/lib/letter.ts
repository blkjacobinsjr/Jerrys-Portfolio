/** What the /contact letter is about: the Re :: line. */
export const TOPICS = ['A new product', 'Consultancy', 'Just a hello'] as const;
export type Topic = (typeof TOPICS)[number];

export interface LetterFields {
  topic: Topic;
  from: string;
  body: string;
  name: string;
}

/** The letter goes out through the visitor's own mail app: the site has no form backend. */
export function mailto(email: string, { topic, from, body, name }: LetterFields): string {
  const signed = name.trim();
  const reply = from.trim();
  const subject = signed ? `${topic}, from ${signed}` : topic;
  const text = `Dear Jerry,\n\n${body.trim()}\n\nSincerely,\n${signed || 'A visitor'}${reply ? `\n${reply}` : ''}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
