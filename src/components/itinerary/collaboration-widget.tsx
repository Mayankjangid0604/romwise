"use client";

import { useState, useTransition } from "react";
import { toggleVote, addComment, deleteComment } from "@/app/actions/collaboration";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, MessageSquare, Trash2 } from "lucide-react";

type Vote = { id: string; value: number; userId: string };
type Comment = { id: string; content: string; userId: string; user: { name: string | null } };

interface CollaborationWidgetProps {
  tripId: string;
  itemId: string;
  votes: Vote[];
  comments: Comment[];
  currentUserId?: string;
  canEdit: boolean;
}

export function CollaborationWidget({ tripId, itemId, votes = [], comments = [], currentUserId, canEdit }: CollaborationWidgetProps) {
  const [isPending, startTransition] = useTransition();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");

  const upvotes = votes.filter(v => v.value === 1).length;
  const downvotes = votes.filter(v => v.value === -1).length;
  const myVote = votes.find(v => v.userId === currentUserId)?.value || 0;

  const handleVote = (value: 1 | -1) => {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await toggleVote(tripId, itemId, value);
      } catch (err) {
        console.error("toggleVote error:", err);
      }
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !canEdit) return;
    
    startTransition(async () => {
      try {
        await addComment(tripId, itemId, newComment);
        setNewComment("");
      } catch (err) {
        console.error("addComment error:", err);
      }
    });
  };

  const handleDeleteComment = (commentId: string) => {
    startTransition(() => {
      deleteComment(tripId, commentId);
    });
  };

  return (
    <div className="mt-4 pt-3 border-t border-ink-100 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <button 
            data-testid="upvote-btn"
            disabled={!canEdit || isPending}
            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 transition-colors ${
              myVote === 1 ? 'bg-green-100 text-green-700' : 'bg-ink-50 text-ink-500 hover:text-green-600 hover:bg-green-50'
            }`}
            onClick={() => handleVote(1)}
          >
            <ThumbsUp className="w-3 h-3" /> {upvotes}
          </button>
          <button 
            disabled={!canEdit || isPending}
            className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 transition-colors ${
              myVote === -1 ? 'bg-red-100 text-red-700' : 'bg-ink-50 text-ink-500 hover:text-red-600 hover:bg-red-50'
            }`}
            onClick={() => handleVote(-1)}
          >
            <ThumbsDown className="w-3 h-3" /> {downvotes}
          </button>
        </div>
        <button 
          data-testid="comment-btn"
          className="text-xs text-ink-500 flex items-center gap-1 hover:text-indigo-600"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageSquare className="w-3 h-3" />
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </button>
      </div>
      {showComments && (
        <div className="bg-ink-50/50 rounded-lg p-3 space-y-3">
          {comments.length > 0 ? (
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2 items-start group">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {c.user?.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="bg-white border rounded-md p-2 flex-1 text-xs relative">
                    <p className="font-medium text-ink-700">{c.user?.name || "Unknown"}</p>
                    <p className="text-ink-600 mt-1">{c.content}</p>
                    {(currentUserId === c.userId || !canEdit /* hack for creator */) && (
                      <button 
                        onClick={() => handleDeleteComment(c.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-400 text-center py-2">No comments yet. Start the discussion!</p>
          )}

          {canEdit && (
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-ink-100">
              <input
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                disabled={isPending}
                className="flex-1 bg-white border border-ink-200 rounded text-xs px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button type="submit" size="sm" disabled={isPending || !newComment.trim()} className="h-auto py-1 px-3 text-xs">
                Send
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
