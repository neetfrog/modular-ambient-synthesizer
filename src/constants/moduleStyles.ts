// Shared module styling constants and utilities

export const MODULE_STYLES = {
  // Panel gradient
  panelBg: 'linear-gradient(160deg, #12122a 0%, #0d0d1f 60%, #0a0a18 100%)',
  panelBorder: '1px solid #2a2a4a',
  panelShadow:
    '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)',

  // Header
  headerBg: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
  headerBorder: '1px solid rgba(255,255,255,0.05)',

  // Section backgrounds
  sectionBg: '#08081a',
  sectionBorder: '1px solid #1a1a30',

  // Text colors
  darkText: '#555577',
  muted: '#444466',
  midText: '#666688',

  // Generic button
  getButtonStyle: (isActive: boolean, accentColor: string) => ({
    background: isActive ? `${accentColor}33` : '#0a0a18',
    border: `1px solid ${isActive ? accentColor : '#2a2a4a'}`,
    color: isActive ? accentColor : '#555577',
    fontFamily: 'monospace',
    cursor: 'pointer' as const,
    boxShadow: isActive ? `0 0 8px ${accentColor}44` : 'none',
    transition: 'all 0.15s',
  }),

  // I/O section header
  ioHeaderStyle: {
    fontSize: 7,
    color: '#444466',
    fontFamily: 'monospace',
    letterSpacing: '0.06em',
  },
} as const;

export const COMMON_DIMENSIONS = {
  knobMd: { outer: 52, inner: 36, stroke: 4, fontSize: 10 },
  knobSm: { outer: 36, inner: 24, stroke: 3, fontSize: 9 },
  knobLg: { outer: 68, inner: 48, stroke: 5, fontSize: 11 },
  jackSize: 20,
  jackLabelFontSize: 7,
} as const;
