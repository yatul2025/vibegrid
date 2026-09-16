/**
 * client/src/constants/themes.js
 * ===============================
 * Centralized Theme Registry for VibeGrid
 * 
 * Defines 10 selectable themes:
 * 1. Light (Classic Clean)
 * 2. Dark (Classic Midnight Navy)
 * 3. Neon Glow (Cyberpunk Electric Cyan/Magenta)
 * 4. Ocean Blue (Maritime Azure Deep)
 * 5. Forest Green (Emerald Mint Nature)
 * 6. Sunset Gradient (Warm Twilight Amber/Coral)
 * 7. Rose Pink (Elegance Blush Soft Magenta)
 * 8. Purple Dream (Royal Amethyst Violet)
 * 9. AMOLED Black (Pure Pitch #000000 OLED)
 * 10. Pastel Light (Soothing Creamy Peach/Terracotta)
 */

export const THEMES = [
  {
    id: 'light',
    name: 'Light',
    category: 'light',
    description: 'Clean, crisp modern light aesthetic with indigo accents.',
    badge: 'Classic Light',
    primary: '#6366f1',
    bgPage: '#f8fafc',
    bgCard: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    borderColor: '#e2e8f0',
    outgoingBubble: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    incomingBubble: '#f1f5f9',
    swatches: ['#f8fafc', '#ffffff', '#6366f1', '#0f172a']
  },
  {
    id: 'dark',
    name: 'Dark',
    category: 'dark',
    description: 'Deep navy midnight blue with soft indigo highlights.',
    badge: 'Classic Dark',
    primary: '#818cf8',
    bgPage: '#090d16',
    bgCard: '#131b2e',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    borderColor: '#243048',
    outgoingBubble: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    incomingBubble: '#1e293b',
    swatches: ['#090d16', '#131b2e', '#818cf8', '#f8fafc']
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    category: 'dark',
    description: 'Cyberpunk dark mode with electric cyan & neon magenta vibes.',
    badge: 'Cyberpunk',
    primary: '#00f0ff',
    bgPage: '#080811',
    bgCard: '#10101f',
    textPrimary: '#f3f4f6',
    textSecondary: '#a78bfa',
    borderColor: '#2d1b54',
    outgoingBubble: 'linear-gradient(135deg, #00f0ff 0%, #d946ef 100%)',
    incomingBubble: '#191830',
    swatches: ['#080811', '#10101f', '#00f0ff', '#d946ef']
  },
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    category: 'dark',
    description: 'Deep maritime navy with calming aqua & azure highlights.',
    badge: 'Maritime',
    primary: '#0284c7',
    bgPage: '#071526',
    bgCard: '#0c223c',
    textPrimary: '#e0f2fe',
    textSecondary: '#7dd3fc',
    borderColor: '#1b436c',
    outgoingBubble: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)',
    incomingBubble: '#0f2d4f',
    swatches: ['#071526', '#0c223c', '#0284c7', '#38bdf8']
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    category: 'dark',
    description: 'Earthy emerald & moss green palette with fresh mint tones.',
    badge: 'Nature',
    primary: '#10b981',
    bgPage: '#06150e',
    bgCard: '#0b2318',
    textPrimary: '#ecfdf5',
    textSecondary: '#6ee7b7',
    borderColor: '#1a4732',
    outgoingBubble: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    incomingBubble: '#0f2e20',
    swatches: ['#06150e', '#0b2318', '#10b981', '#34d399']
  },
  {
    id: 'sunset-gradient',
    name: 'Sunset Gradient',
    category: 'dark',
    description: 'Warm dusky twilight with coral, tangerine & amber radiance.',
    badge: 'Warm Twilight',
    primary: '#f97316',
    bgPage: '#140a18',
    bgCard: '#201227',
    textPrimary: '#fdf2f8',
    textSecondary: '#f472b6',
    borderColor: '#3e224d',
    outgoingBubble: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    incomingBubble: '#2c1736',
    swatches: ['#140a18', '#201227', '#f97316', '#ec4899']
  },
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    category: 'dark',
    description: 'Chic blush rose & soft magenta with delicate glowing borders.',
    badge: 'Elegance',
    primary: '#f43f5e',
    bgPage: '#180b13',
    bgCard: '#26121f',
    textPrimary: '#fff1f2',
    textSecondary: '#fda4af',
    borderColor: '#4a223e',
    outgoingBubble: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
    incomingBubble: '#331729',
    swatches: ['#180b13', '#26121f', '#f43f5e', '#fb7185']
  },
  {
    id: 'purple-dream',
    name: 'Purple Dream',
    category: 'dark',
    description: 'Mystical deep royal amethyst with radiant lavender accents.',
    badge: 'Mystic',
    primary: '#8b5cf6',
    bgPage: '#0e0720',
    bgCard: '#190f34',
    textPrimary: '#f5f3ff',
    textSecondary: '#c4b5fd',
    borderColor: '#371f6d',
    outgoingBubble: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)',
    incomingBubble: '#25144b',
    swatches: ['#0e0720', '#190f34', '#8b5cf6', '#c084fc']
  },
  {
    id: 'amoled-black',
    name: 'AMOLED Black',
    category: 'dark',
    description: 'Pure pitch #000000 black for OLED screens with battery saver efficiency.',
    badge: 'Pure Black',
    primary: '#3b82f6',
    bgPage: '#000000',
    bgCard: '#0a0a0a',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    borderColor: '#222222',
    outgoingBubble: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    incomingBubble: '#141414',
    swatches: ['#000000', '#0a0a0a', '#3b82f6', '#ffffff']
  },
  {
    id: 'pastel-light',
    name: 'Pastel Light',
    category: 'light',
    description: 'Soft soothing creamy warmth with gentle peach & terracotta accents.',
    badge: 'Soft Pastel',
    primary: '#e07a5f',
    bgPage: '#faf7f5',
    bgCard: '#ffffff',
    textPrimary: '#292524',
    textSecondary: '#78716c',
    borderColor: '#e7dfd8',
    outgoingBubble: 'linear-gradient(135deg, #e07a5f 0%, #f4a261 100%)',
    incomingBubble: '#f5eee8',
    swatches: ['#faf7f5', '#ffffff', '#e07a5f', '#292524']
  }
];

export const DEFAULT_THEME = 'dark';

export const getThemeById = (id) => {
  return THEMES.find((t) => t.id === id) || THEMES[1];
};
