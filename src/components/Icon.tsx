const paths = {
  document: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M8 13h8 M8 17h5',
  open: 'M3 7v12a2 2 0 0 0 2 2h14l3-11H8l-3 9 M3 7V5h6l2 3h8v2',
  plus: 'M12 5v14 M5 12h14',
  search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  compare: 'M8 3v14 M5 6l3-3 3 3 M16 21V7 M13 18l3 3 3-3',
  label: 'M20 13l-7 7a2 2 0 0 1-3 0l-8-8V3h9l9 7a2 2 0 0 1 0 3 M7 7h.01',
  edit: 'M16 3l5 5 M4 15L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20l-6 1z',
  comment: 'M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z M7 8h10 M7 12h7',
  history: 'M3 10a9 9 0 1 1 1 7 M3 4v6h6 M12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 15v5h16v-5',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  chevron: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 12l4 4L19 6',
  focus: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',
  panel: 'M3 4h18v16H3z M15 4v16',
  undo: 'M3 8h11a6 6 0 0 1 0 12 M3 8l5-5 M3 8l5 5',
  redo: 'M21 8H10a6 6 0 0 0 0 12 M21 8l-5-5 M21 8l-5 5',
  review: 'M8 6h13 M8 12h13 M8 18h8 M3 6h.01 M3 12h.01 M3 18h.01',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v10H5z M12 15v2',
  command: 'M8 8h8v8H8z M8 8H5a3 3 0 1 1 3-3v3 M16 8V5a3 3 0 1 1 3 3h-3 M16 16h3a3 3 0 1 1-3 3v-3 M8 16v3a3 3 0 1 1-3-3h3',
  book: 'M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1z M12 5v15',
  bold: 'M6 3h7a5 5 0 0 1 0 10H6z M6 13h8a4 4 0 0 1 0 8H6z',
  italic: 'M11 3h9 M4 21h9 M15 3L9 21',
  code: 'M8 6l-6 6 6 6 M16 6l6 6-6 6',
} as const;

export type IconName = keyof typeof paths;
export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d={paths[name]} /></svg>;
}
