import { useState } from 'react';
import type { EditResult } from 'docxodus/core';
import type { DocxSessionController } from '../session';
import { useDocumentComments } from '../hooks/useSessionFeatures';

export interface CommentsPanelProps {
  session: DocxSessionController;
  anchorId?: string;
  revisionId?: string;
  author?: string;
  onSelect?: (anchorId: string) => void;
}

export function CommentsPanel({ session, anchorId, revisionId, author = 'Reviewer', onSelect }: CommentsPanelProps) {
  const comments = useDocumentComments(session);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      : anchorId ? () => comments.addComment(anchorId, null, author, text) : null;
    if (operation && apply(operation)) { setText(''); setReplyTo(null); setEditing(null); }
  };
  return <section className="rdv-feature-panel" aria-label="Comments">
    <h3>Comments</h3>
    {(error || comments.error) && <p role="alert">{error ?? comments.error?.message}</p>}
    {comments.comments.length === 0 && <p>No comments in this document.</p>}
    <ol className="rdv-comment-list">
      {comments.comments.map(comment => <li key={comment.anchorId} className={comment.parentAnchorId ? 'rdv-comment-reply' : ''}>
        <div><strong>{comment.author}</strong>{comment.resolved && <span> · Resolved</span>}</div>
        <p>{comment.text}</p>
        <div className="rdv-review-actions">
          {onSelect && <button type="button" onClick={() => onSelect(comment.anchorId)}>Show comment</button>}
          <button type="button" onClick={() => { setReplyTo(comment.anchorId); setEditing(null); setText(''); }}>Reply</button>
          <button type="button" onClick={() => { setEditing(comment.anchorId); setReplyTo(null); setText(comment.text); }}>Edit</button>
          {!comment.parentAnchorId && <button type="button" onClick={() => apply(() => comments.setCommentResolved(comment.anchorId, !comment.resolved))}>{comment.resolved ? 'Reopen' : 'Resolve'}</button>}
          <button type="button" onClick={() => apply(() => comments.removeComment(comment.anchorId))}>Delete</button>
        </div>
      </li>)}
    </ol>
    <form onSubmit={event => { event.preventDefault(); submit(); }}>
      <label>{editing ? 'Edit comment' : replyTo ? 'Reply' : 'New comment'}<textarea value={text} onChange={event => setText(event.target.value)} /></label>
      {!anchorId && !revisionId && !replyTo && !editing && <p>Select a document block or revision to add a comment.</p>}
      <button type="submit" disabled={!text.trim() || (!anchorId && !revisionId && !replyTo && !editing)}>{editing ? 'Save comment' : replyTo ? 'Post reply' : 'Add comment'}</button>
      {(replyTo || editing) && <button type="button" onClick={() => { setReplyTo(null); setEditing(null); setText(''); }}>Cancel</button>}
    </form>
  </section>;
}
