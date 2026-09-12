import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../src/components/Icon';
import type { IconName } from '../../src/components/Icon';

export interface Command { id: string; label: string; hint: string; icon: IconName; run: () => void; disabled?: boolean; shortcut?: string }

export function CommandMenu({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const matches = commands.filter(command => `${command.label} ${command.hint}`.toLowerCase().includes(query.toLowerCase()));
  const choose = (command: Command) => { if (!command.disabled) { onClose(); command.run(); } };
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => element.close(); }, []);
  useEffect(() => { dialog.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, query]);
  return <dialog ref={dialog} className="command-dialog" aria-label="Command menu" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="command-search"><Icon name="search" size={21} /><input autoFocus aria-label="Search commands" role="combobox" aria-expanded="true" aria-controls="command-results" aria-activedescendant={matches[active] ? `command-${matches[active].id}` : undefined} placeholder="What would you like to do?" value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => Math.min(index + 1, matches.length - 1)); }
      if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
      if (event.key === 'Enter' && matches[active]) { event.preventDefault(); choose(matches[active]); }
    }} /><button className="keycap" onClick={onClose} aria-label="Close command menu">esc</button></div>
    <div className="command-results" id="command-results" role="listbox" aria-label="Commands">
      <p className="eyebrow">YOUR WORKSPACE</p>
      {matches.map((command, index) => <button type="button" id={`command-${command.id}`} key={command.id} role="option" aria-selected={active === index} aria-disabled={command.disabled} onMouseMove={() => setActive(index)} onClick={() => choose(command)}><Icon name={command.icon} /><span><strong>{command.label}</strong><small>{command.hint}</small></span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}
      {!matches.length && <p className="command-no-results">No matching commands. Try “review”, “find”, or “export”.</p>}
    </div><div className="command-footer"><span>↑ ↓ to navigate</span><span>↵ to select</span><span>Everything, a few keys away.</span></div>
  </dialog>;
}
