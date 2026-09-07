// ═══════════════════════════════════════════════════════════════════════════
// ICON REGISTRY — inline SVG (master brief §6: no emoji as UI).
// Skill logos: monokrom (currentColor) secara default, warna brand saat hover.
// viewBox 24×24. Dipakai lewat Icon.astro (set:html).
// ═══════════════════════════════════════════════════════════════════════════

// ─── UI icons (stroke, currentColor) ────────────────────────────────────────
export const ui: Record<string, string> = {
  arrowUpRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  arrowRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  arrowDown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  arrowUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  sun:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  translate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h8M9 3v2c0 4-2.5 7-6 8M6 9c0 2.5 2.5 5 6 6M13 21l4-9 4 9M14.5 17h5"/></svg>',
  mail:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  linkedin:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C21.4 8.65 22 11 22 14.1V21h-4v-6.1c0-1.45-.03-3.32-2.02-3.32-2.02 0-2.33 1.58-2.33 3.21V21h-4z"/></svg>',
  menu:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c.5 4.5 3 7 7.5 7.5C15 10 12.5 12.5 12 17c-.5-4.5-3-7-7.5-7.5C9 9 11.5 6.5 12 2z"/></svg>',
};

// ─── Skill brand logos ──────────────────────────────────────────────────────
// { svg, color } — svg monokrom (currentColor); color = warna brand saat hover.
export const skillIcons: Record<string, { svg: string; color: string }> = {
  JavaScript: {
    color: '#E9CA2E',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="4" opacity="0.14"/><path d="M7.2 17.4c.4.7 1 1.3 2 1.3.9 0 1.4-.4 1.4-1.1 0-.8-.6-1-1.6-1.5l-.5-.2c-1.6-.7-2.6-1.5-2.6-3.2 0-1.6 1.2-2.8 3-2.8 1.3 0 2.3.5 3 1.7l-1.6 1c-.3-.6-.7-.8-1.4-.8-.6 0-1 .4-1 .8 0 .6.4.9 1.3 1.3l.5.2c1.9.8 2.9 1.6 2.9 3.4 0 1.9-1.5 2.9-3.5 2.9-2 0-3.2-.9-3.8-2.2zM15 17.5c.3.6.6 1.1 1.4 1.1.7 0 1.1-.3 1.1-1.3v-6.6h2v6.6c0 2.2-1.3 3.2-3.2 3.2-1.7 0-2.7-.9-3.2-1.9z"/></svg>',
  },
  Python: {
    color: '#4B8BBE',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.9 2c-1.7 0-3 .2-4 .6-1 .4-1.4 1.1-1.4 2.3v1.7h5.5v.7H4.8c-1.4 0-2.6.8-3 2.4-.4 1.8-.4 2.9 0 4.8.3 1.4 1.1 2.4 2.5 2.4h1.6v-2c0-1.5 1.3-2.9 2.9-2.9h3.9c1.2 0 2.2-1 2.2-2.2V4.9c0-1.2-1-2.1-2.2-2.4-1-.3-1.5-.5-2.6-.5zM9.4 4.2c.5 0 .9.4.9.9s-.4.9-.9.9-.9-.4-.9-.9.4-.9.9-.9z"/><path d="M12.1 22c1.7 0 3-.2 4-.6 1-.4 1.4-1.1 1.4-2.3v-1.7H12v-.7h7.2c1.4 0 2.6-.8 3-2.4.4-1.8.4-2.9 0-4.8-.3-1.4-1.1-2.4-2.5-2.4h-1.6v2c0 1.5-1.3 2.9-2.9 2.9h-3.9c-1.2 0-2.2 1-2.2 2.2v4.1c0 1.2 1 2.1 2.2 2.4 1 .3 1.5.5 2.6.5zm2.5-2.2c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"/></svg>',
  },
  CSS: {
    color: '#2965F1',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16l-1.5 16.5L12 22l-6.5-2.5L4 3zm12.9 4H8.2l.2 2h8.1l-.5 5.6-3.9 1.1-3.9-1.1-.2-2.6h1.9l.1 1.2 2.1.6 2.1-.6.2-2.2H7.9L7.4 5.9h9.7l-.2 1.1z"/></svg>',
  },
  'Microsoft Excel': {
    color: '#21A366',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="16" rx="2" opacity="0.14"/><path d="M13 5h7a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-7V5z" opacity="0.2"/><path d="M3 6.5 12 5v14l-9-1.5v-11zM6 9l1.6 3L6 15h1.7l.9-2 .9 2H11l-1.7-3L11 9H9.4l-.8 1.8L7.8 9H6z"/></svg>',
  },
  'Microsoft Word': {
    color: '#2B579A',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="16" rx="2" opacity="0.14"/><path d="M13 5h7a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-7V5z" opacity="0.2"/><path d="M3 6.5 12 5v14l-9-1.5v-11zm2.2 2.6.9 5.4h1.4l.7-3.3.7 3.3h1.4l.9-5.4H9.9l-.5 3.4-.7-3.4H7.4l-.7 3.4-.5-3.4H5.2z"/></svg>',
  },
  Notion: {
    color: 'currentColor',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4.7c0-.9.5-1.4 1.5-1.5l11-.9c.9-.1 1.6.2 2.2.9l2.3 2.4c.4.4.5.8.5 1.4v11.8c0 1-.5 1.6-1.7 1.7l-12.4.8c-1 .1-1.7-.3-2.2-1L4.3 18c-.2-.3-.3-.7-.3-1.1V4.7z" opacity="0.14"/><path d="M6.5 6.3v9.8c0 .5.3.7.9.7l1.1-.1V9.4l1 .1 3.2 4.9 1.6-.1V7l-1 .1v5l-3.1-4.9-2.7-.9zm-.4-1.6 9-.7c.4 0 .5.1.2.4l-1.3 1c-.3.2-.6.3-1 .3l-6.4-.4c-.5 0-.6-.3-.1-.6l-.4.1z"/></svg>',
  },
  'Google Workspace': {
    color: '#4285F4',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 10v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6 6 0 1 1 0-12c1.9 0 3.2.8 3.9 1.5l2.6-2.5C16.9 2.9 14.7 2 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"/></svg>',
  },
  Discord: {
    color: '#5865F2',
    svg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.3 5.4A16.6 16.6 0 0 0 15.2 4l-.2.4a12 12 0 0 1 3.6 1.8 15.5 15.5 0 0 0-13.3 0A12 12 0 0 1 9 4.4L8.8 4a16.6 16.6 0 0 0-4.1 1.4C2 9.3 1.3 13.1 1.6 16.9a16.7 16.7 0 0 0 5.1 2.6l.6-1a11 11 0 0 1-1.7-.8l.4-.3a11.8 11.8 0 0 0 10 0l.4.3c-.5.3-1.1.6-1.7.8l.6 1a16.7 16.7 0 0 0 5.1-2.6c.4-4.4-.7-8.2-3.1-11.5zM8.5 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>',
  },
};
