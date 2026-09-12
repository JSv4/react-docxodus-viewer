import { useCallback, useDeferredValue, useState } from 'react';
import { useSessionQuery } from '../../src';
import type { DocxSession, DocxSessionController } from '../../src';
import { Icon } from '../../src/components/Icon';

export function DocumentNavigator({ session, onSelect, onClose }: { session: DocxSessionController; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query);
  const selector = useCallback((document: DocxSession) => search.trim()
    ? document.findAllByText(search, { ignoreCase: true })
    : document.findByKind('h', 'body'), [search]);
  const { data: matches, error } = useSessionQuery(session, selector);
  return <aside className="document-navigator" aria-label="Document navigator"><div className="navigator-heading"><strong>Navigate</strong><button className="icon-button" aria-label="Close navigator" onClick={onClose}><Icon name="close" size={16} /></button></div>
    <label className="navigator-search"><Icon name="search" size={16} /><input autoFocus aria-label="Find in document" placeholder="Find a word or phrase…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <p className="eyebrow">{search ? `${matches?.length ?? 0} MATCHING BLOCKS` : 'DOCUMENT OUTLINE'}</p>
    {error && <p role="alert">{error.message}</p>}
    <ol>{matches?.slice(0, 100).map((match, index) => <li key={match.id}><button type="button" onClick={() => onSelect(match.id)}><span>{String(index + 1).padStart(2, '0')}</span><p>{match.autoNumberPrefix && `${match.autoNumberPrefix} `}{match.textPreview || 'Untitled section'}</p><Icon name="chevron" size={13} /></button></li>)}</ol>
    {!matches?.length && <div className="navigator-empty"><Icon name={search ? 'search' : 'book'} size={24} /><p>{search ? 'No matches for this phrase.' : 'Headings will appear here.'}</p><small>{search ? 'Try a shorter phrase or another word.' : 'Search any text to jump directly to its place in the document.'}</small></div>}
    {(matches?.length ?? 0) > 100 && <p className="muted-copy">Showing the first 100 matches. Refine your search to see fewer.</p>}
  </aside>;
}
