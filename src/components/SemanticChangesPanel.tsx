import { useMemo, useState } from 'react';
import type { SemanticChangeSet, SemanticValue } from 'docxodus/core';

function formatValue(value: SemanticValue): string {
  if (value.kind === 'absent') return 'Absent';
  if (value.kind === 'object' || value.kind === 'array') return JSON.stringify(value.value, null, 2);
  return String(value.value);
}

export function SemanticChangesPanel({ changes, onSelect }: { changes: SemanticChangeSet; onSelect?: (anchorId: string) => void }) {
  const [family, setFamily] = useState('all');
  const families = useMemo(() => [...new Set(changes.changes.map(change => change.family))].sort(), [changes]);
  const visible = changes.changes.filter(change => family === 'all' || change.family === family);
  return <section className="rdv-feature-panel" aria-label="Semantic changes">
    <h3>Document changes</h3>
    <label>Change family <select value={family} onChange={event => setFamily(event.target.value)}>
      <option value="all">All changes ({changes.changeCount})</option>
      {families.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
    </select></label>
    {visible.length === 0 && <p>No changes in this category.</p>}
    <ol className="rdv-change-list">{visible.map(change => <li key={change.id}>
      <strong>{change.family.replaceAll('_', ' ')} · {change.operation}</strong>
      <p>{change.path}</p>
      <div className="rdv-before-after"><pre>{formatValue(change.before)}</pre><span aria-label="changed to">→</span><pre>{formatValue(change.after)}</pre></div>
      {onSelect && (change.rightAnchor || change.leftAnchor) && <button type="button" onClick={() => onSelect((change.rightAnchor || change.leftAnchor)!)}>Show in document</button>}
    </li>)}</ol>
  </section>;
}
