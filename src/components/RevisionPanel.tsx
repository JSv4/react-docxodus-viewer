import { useState, useMemo } from 'react';
import type { RevisionListEntry, DocxDiffRevision, FormatChangeDetails, EditResult } from 'docxodus/core';
import { useAsyncOperation } from '../hooks/useAsyncOperation';

export type ViewerRevision = RevisionListEntry | DocxDiffRevision;
type Revision = ViewerRevision;
type Resolution = () => void | EditResult | Promise<void | EditResult>;
export interface RevisionPanelProps {
  revisions: readonly ViewerRevision[];
  onSelect?: (revision: ViewerRevision) => void;
  onAccept?: (id: string) => ReturnType<Resolution>;
  onReject?: (id: string) => ReturnType<Resolution>;
  onAcceptAll?: Resolution;
  onRejectAll?: Resolution;
  /** Optional formatting evidence keyed by native revision id. Comparison records carry their own. */
  formatDetails?: Record<string, FormatChangeDetails>;
}

type FilterType = 'all' | 'insertions' | 'deletions' | 'moves' | 'formatting' | 'structural';
const isInsertion = (r: Revision) => 'family' in r ? r.type === 'insert' : ['Inserted', 'Insertion'].includes(r.revisionType);
const isDeletion = (r: Revision) => 'family' in r ? r.type === 'delete' : ['Deleted', 'Deletion'].includes(r.revisionType);
const isMove = (r: Revision) => 'family' in r ? r.type === 'move' : r.revisionType === 'Moved';
const isFormatChange = (r: Revision) => 'family' in r ? r.type === 'format' : r.revisionType === 'FormatChanged';
const isStructural = (r: Revision) => 'family' in r && r.type === 'structure';

function getRevisionTypeLabel(revision: Revision): string {
  if (isInsertion(revision)) return 'Inserted';
  if (isDeletion(revision)) return 'Deleted';
  if (isMove(revision)) return 'family' in revision ? 'Moved' : revision.isMoveSource ? 'Moved from' : 'Moved to';
  if (isFormatChange(revision)) return 'Formatted';
  return 'family' in revision ? revision.family.replaceAll('_', ' ') : String(revision.revisionType);
}

function getRevisionTypeClass(revision: Revision): string {
  if (isInsertion(revision)) return 'rdv-revision--insertion';
  if (isDeletion(revision)) return 'rdv-revision--deletion';
  if (isMove(revision)) return 'rdv-revision--move';
  if (isFormatChange(revision)) return 'rdv-revision--format';
  return 'rdv-revision--structure';
}

function formatDate(isoDate?: string): string {
  if (!isoDate) return "";
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Filter out raw XML values and clean up property names
function isValidPropertyValue(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  // Filter out raw XML data
  if (value.includes('<') || value.includes('xmlns') || value.includes('Unid=')) return false;
  // Filter out overly long values (likely XML)
  if (value.length > 100) return false;
  return true;
}

// Make property names more readable
function formatPropertyName(name: string): string {
  // Convert camelCase to Title Case with spaces
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Format property value for display
function formatPropertyValue(value: string): string {
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  if (value === 'single') return 'Single';
  if (value === 'double') return 'Double';
  return value;
}

interface FormatChangeItem {
  property: string;
  oldValue?: string;
  newValue?: string;
}

// Get paired format changes (old → new for same property)
function getFormatChanges(details?: FormatChangeDetails): FormatChangeItem[] {
  if (!details) return [];
  const { oldProperties, newProperties } = details;
  const changes: FormatChangeItem[] = [];
  const processedKeys = new Set<string>();

  // Process old properties
  if (oldProperties) {
    for (const [key, value] of Object.entries(oldProperties)) {
      if (!isValidPropertyValue(value)) continue;
      processedKeys.add(key);
      const newValue = newProperties?.[key];
      changes.push({
        property: formatPropertyName(key),
        oldValue: formatPropertyValue(value),
        newValue: newValue && isValidPropertyValue(newValue) ? formatPropertyValue(newValue) : undefined,
      });
    }
  }

  // Process new properties not in old
  if (newProperties) {
    for (const [key, value] of Object.entries(newProperties)) {
      if (processedKeys.has(key)) continue;
      if (!isValidPropertyValue(value)) continue;
      changes.push({
        property: formatPropertyName(key),
        oldValue: undefined,
        newValue: formatPropertyValue(value),
      });
    }
  }

  return changes;
}

export function RevisionPanel({ revisions, onSelect, onAccept, onReject, onAcceptAll, onRejectAll, formatDetails }: RevisionPanelProps) {
  const action = useAsyncOperation<void | EditResult>();
  const resolve = (operation: Resolution) => {
    void action.run(async () => {
      const result = await operation();
      if (result && !result.success) throw new Error(result.error?.message ?? 'The change could not be resolved.');
      return result;
    }).catch(() => { /* Displayed by the panel. */ });
  };
  const canResolveAll = revisions.every(rev => 'family' in rev && rev.resolutionStatus === 'supported');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Pair each revision with its stable index in the original array so that
  // filtering and expansion state stay tied to the revision itself, not to a
  // shifting position within the filtered subset.
  const filteredRevisions = useMemo(() => {
    const withIds = revisions.map((revision, index) => ({ revision, id: 'family' in revision ? revision.id : `${revision.leftAnchor ?? ''}:${revision.rightAnchor ?? ''}:${revision.revisionType}:${index}` }));
    if (filter === 'all') return withIds;
    return withIds.filter(({ revision }) => {
      switch (filter) {
        case 'insertions': return isInsertion(revision);
        case 'deletions': return isDeletion(revision);
        case 'moves': return isMove(revision);
        case 'formatting': return isFormatChange(revision);
        case 'structural': return isStructural(revision);
        default: return true;
      }
    });
  }, [revisions, filter]);

  const stats = useMemo(() => ({
    total: revisions.length,
    insertions: revisions.filter(isInsertion).length,
    deletions: revisions.filter(isDeletion).length,
    moves: revisions.filter(isMove).length,
    formatting: revisions.filter(isFormatChange).length,
    structural: revisions.filter(isStructural).length,
  }), [revisions]);

  const toggleExpanded = (index: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (revisions.length === 0) {
    return (
      <div className="rdv-revision-panel">
        <div className="rdv-revision-empty">
          <div className="rdv-revision-empty__icon">📝</div>
          <p>No tracked changes found in this document.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rdv-revision-panel">
      {action.error && <p className="rdv-feature-error" role="alert">{action.error.message}</p>}
      <div className="rdv-revision-header">
        <div className="rdv-revision-stats">
          <span className="rdv-revision-stat rdv-revision-stat--total">
            {stats.total} change{stats.total !== 1 ? 's' : ''}
          </span>
          {stats.insertions > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--insertion">
              +{stats.insertions}
            </span>
          )}
          {stats.deletions > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--deletion">
              −{stats.deletions}
            </span>
          )}
          {stats.moves > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--move">
              ↔{stats.moves}
            </span>
          )}
          {stats.formatting > 0 && (
            <span className="rdv-revision-stat rdv-revision-stat--format">
              ✎{stats.formatting}
            </span>
          )}
        </div>
        <div className="rdv-review-actions">
          {onAcceptAll && <button type="button" disabled={action.isRunning || !canResolveAll} onClick={() => resolve(onAcceptAll)}>Accept all</button>}
          {onRejectAll && <button type="button" disabled={action.isRunning || !canResolveAll} onClick={() => resolve(onRejectAll)}>Reject all</button>}
        </div>
        <select
          aria-label="Filter revisions"
          className="rdv-revision-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
        >
          <option value="all">All Changes</option>
          <option value="insertions">Insertions ({stats.insertions})</option>
          <option value="deletions">Deletions ({stats.deletions})</option>
          <option value="moves">Moves ({stats.moves})</option>
          <option value="formatting">Formatting ({stats.formatting})</option>
          <option value="structural">Structure ({stats.structural})</option>
        </select>
      </div>

      <div className="rdv-revision-list">
        {filteredRevisions.map(({ revision, id }) => {
          const isExpanded = expandedIds.has(id);
          const needsTruncation = revision.text.length > 150;
          const formatChanges = getFormatChanges('family' in revision ? formatDetails?.[revision.id] : revision.formatChange);

          return (
            <div
              key={id}
              className={`rdv-revision-item ${getRevisionTypeClass(revision)}`}
            >
              <div className="rdv-revision-item__header">
                <span className="rdv-revision-type">
                  {getRevisionTypeLabel(revision)}
                </span>
                {isMove(revision) && 'moveGroupId' in revision && revision.moveGroupId !== undefined && (
                  <span className="rdv-revision-move-id">#{revision.moveGroupId}</span>
                )}
                <span className="rdv-revision-author">{revision.author || 'Unknown'}</span>
                <span className="rdv-revision-date">{formatDate(('dateUtc' in revision ? revision.dateUtc : undefined) ?? revision.date)}</span>
              </div>

              {revision.text && (
                <div className="rdv-revision-item__content">
                  <span className="rdv-revision-text">
                    {isExpanded ? revision.text : truncateText(revision.text)}
                  </span>
                  {needsTruncation && (
                    <button
                      className="rdv-revision-expand"
                      onClick={() => toggleExpanded(id)}
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {'family' in revision && revision.resolutionStatus !== 'supported' && (
                <p className="rdv-revision-diagnostic">{revision.diagnostic?.message ?? `This change is ${revision.resolutionStatus} and cannot be resolved automatically.`}</p>
              )}
              <div className="rdv-review-actions">
                {onSelect && <button type="button" onClick={() => onSelect(revision)}>Show in document</button>}
                {'family' in revision && onAccept && <button type="button" disabled={action.isRunning || revision.resolutionStatus !== 'supported'} onClick={() => resolve(() => onAccept(revision.id))}>Accept</button>}
                {'family' in revision && onReject && <button type="button" disabled={action.isRunning || revision.resolutionStatus !== 'supported'} onClick={() => resolve(() => onReject(revision.id))}>Reject</button>}
              </div>
              {formatChanges.length > 0 && (
                <div className="rdv-revision-item__format-details">
                  {formatChanges.map((change, i) => (
                    <div key={i} className="rdv-format-change">
                      <span className="rdv-format-change__property">{change.property}</span>
                      <span className="rdv-format-change__values">
                        {change.oldValue && (
                          <span className="rdv-format-change__old">{change.oldValue}</span>
                        )}
                        {change.oldValue && change.newValue && (
                          <span className="rdv-format-change__arrow">→</span>
                        )}
                        {change.newValue && (
                          <span className="rdv-format-change__new">{change.newValue}</span>
                        )}
                        {!change.oldValue && change.newValue && (
                          <span className="rdv-format-change__added">(added)</span>
                        )}
                        {change.oldValue && !change.newValue && (
                          <span className="rdv-format-change__removed">(removed)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
