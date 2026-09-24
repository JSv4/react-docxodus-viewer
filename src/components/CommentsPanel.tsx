import { useEffect, useMemo, useRef, useState } from 'react';
import type { CharSpan, CommentListEntry, EditResult } from 'docxodus/core';
import type { DocxSessionController } from '../session';
import { useDocumentComments, useSelectionTarget } from '../hooks/useSessionFeatures';
import { Icon } from './Icon';

/** Host-supplied location details, e.g. read from the rendered comment highlight. */
export interface CommentContext { text?: string; order?: number }

export interface CommentsPanelProps {
  session: DocxSessionController;
  anchorId?: string;
  /** Selected text inside `anchorId`. Omit or pass an empty span to comment on the whole block. */
  span?: CharSpan | null;
  revisionId?: string;
  author?: string;
  /** Change this value to move keyboard focus to the comment field. */
  focusRequest?: number;
  /** Quote the commented text and order threads by document position. */
  describeComment?: (comment: CommentListEntry) => CommentContext | undefined;
  onSelect?: (anchorId: string) => void;
}

/** Thread roots (in document order when known), each followed by its replies. */
function threads(comments: CommentListEntry[], describe?: CommentsPanelProps['describeComment']) {
  const byAnchor = new Map(comments.map(comment => [comment.anchorId, comment]));
  const root = (comment: CommentListEntry) => {
    const seen = new Set<string>();
    while (comment.parentAnchorId && byAnchor.has(comment.parentAnchorId) && !seen.has(comment.anchorId)) { seen.add(comment.anchorId); comment = byAnchor.get(comment.parentAnchorId)!; }
    return comment;
  };
  const roots = comments.filter(comment => root(comment) === comment).map((comment, index) => ({ comment, index, context: describe?.(comment) }));
  roots.sort((a, b) => (a.context?.order ?? Infinity) - (b.context?.order ?? Infinity) || a.index - b.index);
  return roots.flatMap(({ comment, context }) => [{ comment, context }, ...comments.filter(reply => reply !== comment && root(reply) === comment).map(reply => ({ comment: reply, context: undefined }))]);
}

export function CommentsPanel({ session, anchorId, span, revisionId, author = 'Reviewer', focusRequest, describeComment, onSelect }: CommentsPanelProps) {
  const comments = useDocumentComments(session);
  const target = useSelectionTarget(session, anchorId, span);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (focusRequest) field.current?.focus(); }, [focusRequest]);
  const ordered = useMemo(() => threads(comments.comments, describeComment), [comments.comments, describeComment]);
  const apply = (operation: () => EditResult) => {
    try {
      const result = operation();
      if (!result.success) throw new Error(result.error?.message ?? 'The comment could not be changed.');
      setError(null);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
  };
  const submit = () => {
    if (!text.trim()) return;
    const operation = editing
      ? () => comments.updateComment(editing, text)
      : replyTo ? () => comments.addCommentReply(replyTo, author, text)
      : revisionId ? () => comments.addCommentToRevision(revisionId, author, text)
      : target ? () => comments.addComment(target.anchorId, target.span, author, text) : null;
    if (operation && apply(operation)) { setText(''); setReplyTo(null); setEditing(null); }
  };
  const compose = (next: { replyTo?: string | null; editing?: string | null; text?: string }) => {
    setReplyTo(next.replyTo ?? null); setEditing(next.editing ?? null); setText(next.text ?? ''); field.current?.focus();
  };
  return <section className="rdv-feature-panel" aria-label="Comments">
    <div className="rdv-panel-heading"><span>KEEP THE CONVERSATION CLOSE</span><h3>Comments</h3><p>Thoughts, questions, and decisions. Right where they belong.</p></div>
    {(error || comments.error) && <p role="alert">{error ?? comments.error?.message}</p>}
    {comments.comments.length === 0 && <div className="rdv-panel-empty"><Icon name="comment" size={28} /><p>No comments yet.</p><small>Select text or a paragraph to start the conversation.</small></div>}
    <ol className="rdv-comment-list">
      {ordered.map(({ comment, context }) => <li key={comment.anchorId} className={comment.parentAnchorId ? 'rdv-comment-reply' : ''}>
        <div className="rdv-comment-heading"><span className="rdv-avatar">{(comment.author || 'R').slice(0, 1).toUpperCase()}</span><strong>{comment.author}</strong>{comment.resolved && <span className="rdv-status-pill">Resolved</span>}</div>
        {context?.text && <blockquote className="rdv-comment-context">{context.text}</blockquote>}
        <p>{comment.text}</p>
        <div className="rdv-review-actions">
          {onSelect && <button type="button" onClick={() => onSelect(comment.anchorId)}>Show comment</button>}
          <button type="button" onClick={() => compose({ replyTo: comment.anchorId })}>Reply</button>
          <button type="button" onClick={() => compose({ editing: comment.anchorId, text: comment.text })}>Edit</button>
          {!comment.parentAnchorId && <button type="button" onClick={() => apply(() => comments.setCommentResolved(comment.anchorId, !comment.resolved))}>{comment.resolved ? 'Reopen' : 'Resolve'}</button>}
          <button type="button" onClick={() => apply(() => comments.removeComment(comment.anchorId))}>Delete</button>
        </div>
      </li>)}
    </ol>
    <form onSubmit={event => { event.preventDefault(); submit(); }}>
      {target && !revisionId && !replyTo && !editing && <blockquote className="rdv-selection-target" aria-label={target.span ? 'Selected text' : 'Selected block'}><span>{target.span ? 'Selected text' : 'Selected block'}</span>{target.text || 'Empty paragraph'}</blockquote>}
      <label>{editing ? 'Edit comment' : replyTo ? 'Reply' : 'New comment'}<textarea ref={field} value={text} onChange={event => setText(event.target.value)} /></label>
      {!target && !revisionId && !replyTo && !editing && <p>Select text, a document block or a revision to add a comment.</p>}
      <button className="rdv-primary-action" type="submit" disabled={!text.trim() || (!target && !revisionId && !replyTo && !editing)}>{editing ? 'Save comment' : replyTo ? 'Post reply' : target?.span && !revisionId ? 'Comment on selection' : 'Add comment'}<Icon name="arrow" size={15} /></button>
      {(replyTo || editing) && <button type="button" onClick={() => compose({})}>Cancel</button>}
    </form>
  </section>;
}
