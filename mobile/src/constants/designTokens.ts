export const ACCENT = '#00B4D8';
export const DARK = '#0D0D0D';
export const CARD_BG = '#FAFAFA';
export const CARD_BORDER = '#F0F0F0';

export type CategoryStyle = {
  bg: string;
  text: string;
  emoji: string;
  label: string;
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  social:    { bg: '#F0E6FF', text: '#7C3AED', emoji: '✨', label: 'Social' },
  sports:    { bg: '#E0F7FA', text: '#0090AA', emoji: '🏃', label: 'Sports' },
  food:      { bg: '#FFF0E4', text: '#C87838', emoji: '☕', label: 'Food' },
  outdoors:  { bg: '#E8F4E8', text: '#2E7D32', emoji: '🌅', label: 'Outdoors' },
  music:     { bg: '#FCE4EC', text: '#C62828', emoji: '🎧', label: 'Music' },
  arts:      { bg: '#FFF0E4', text: '#B5420A', emoji: '🎨', label: 'Arts' },
  tech:      { bg: '#E3F2FD', text: '#1565C0', emoji: '💻', label: 'Tech' },
  wellness:  { bg: '#E8F5E9', text: '#2E7D32', emoji: '🧘', label: 'Wellness' },
  education: { bg: '#FFF8E1', text: '#F57F17', emoji: '📚', label: 'Education' },
  gaming:    { bg: '#F3E5F5', text: '#6A1B9A', emoji: '🎮', label: 'Gaming' },
};

export const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  bg: '#F5F5F5',
  text: '#666666',
  emoji: '✨',
  label: 'Other',
};

const AVATAR_PASTELS: Array<{ bg: string; text: string }> = [
  { bg: '#FFD5CC', text: '#8B3A2A' },
  { bg: '#C5F0E0', text: '#1A5C42' },
  { bg: '#DDD5F3', text: '#4A3580' },
  { bg: '#FFF3CC', text: '#7A5500' },
  { bg: '#D4EEFF', text: '#1A5580' },
  { bg: '#FFD4EC', text: '#8B1A5C' },
  { bg: '#D4F3D4', text: '#1A6A1A' },
  { bg: '#FFE8CC', text: '#8B4A00' },
];

/** Returns a consistent pastel bg+text pair for a given name — same name always = same color. */
export function nameToAvatarColor(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PASTELS[Math.abs(hash) % AVATAR_PASTELS.length];
}
