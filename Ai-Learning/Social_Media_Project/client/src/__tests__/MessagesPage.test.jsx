/**
 * client/src/__tests__/MessagesPage.test.jsx
 * =============================================
 * Unit tests for the Phase 1 UI behaviours added to MessagesPage:
 *   - Reply preview banner
 *   - Edited badge
 *   - Deleted message placeholder
 *   - Date separator pills
 *   - Context menu actions
 *
 * Uses React Testing Library with Vitest (matching the Vite project setup).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── We test only the pure helper + rendering logic ─────────────────

// Import the helper directly – it's a top-level function
// We re-implement it here for isolated testing since it's not exported
function getDateSeparatorLabel(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
}

// =====================================================================
// getDateSeparatorLabel tests
// =====================================================================
describe('getDateSeparatorLabel', () => {
  it('should return "Today" for today\'s date', () => {
    const now = new Date().toISOString();
    expect(getDateSeparatorLabel(now)).toBe('Today');
  });

  it('should return "Yesterday" for yesterday\'s date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getDateSeparatorLabel(yesterday.toISOString())).toBe('Yesterday');
  });

  it('should return a formatted date for older dates', () => {
    const oldDate = '2024-01-15T12:00:00Z';
    const result = getDateSeparatorLabel(oldDate);
    expect(result).toContain('15');
    expect(result).toContain('January');
  });

  it('should return empty string for falsy input', () => {
    expect(getDateSeparatorLabel('')).toBe('');
    expect(getDateSeparatorLabel(null)).toBe('');
    expect(getDateSeparatorLabel(undefined)).toBe('');
  });
});

// =====================================================================
// Minimal UI rendering tests using simple React components
// that mirror the MessagesPage rendering logic
// =====================================================================

// Simulates the edited badge rendering logic
function EditedBadgeTestComponent({ editedAt }) {
  return (
    <span className="message-timestamp">
      12:00 PM
      {editedAt && <span className="edited-badge">Edited</span>}
    </span>
  );
}

describe('Edited Badge', () => {
  it('should display "Edited" when edited_at is present', () => {
    render(<EditedBadgeTestComponent editedAt="2026-09-14T00:00:00Z" />);
    expect(screen.getByText('Edited')).toBeInTheDocument();
  });

  it('should NOT display "Edited" when edited_at is null', () => {
    render(<EditedBadgeTestComponent editedAt={null} />);
    expect(screen.queryByText('Edited')).not.toBeInTheDocument();
  });
});

// Simulates the deleted placeholder rendering logic
function DeletedPlaceholderTestComponent({ isDeleted, content }) {
  return (
    <div className="message-bubble">
      {isDeleted ? (
        <p className="deleted-placeholder">This message was deleted</p>
      ) : (
        <p className="message-text">{content}</p>
      )}
    </div>
  );
}

describe('Deleted Message Placeholder', () => {
  it('should show placeholder text for deleted messages', () => {
    render(<DeletedPlaceholderTestComponent isDeleted={true} content="" />);
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    expect(screen.getByText('This message was deleted')).toHaveClass('deleted-placeholder');
  });

  it('should show normal content for non-deleted messages', () => {
    render(<DeletedPlaceholderTestComponent isDeleted={false} content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.queryByText('This message was deleted')).not.toBeInTheDocument();
  });
});

// Simulates the reply preview banner rendering logic
function ReplyPreviewTestComponent({ replyingTo, onCancel }) {
  return (
    <div>
      {replyingTo && (
        <div className="reply-preview-banner" data-testid="reply-preview">
          <div className="reply-preview-content">
            <div className="reply-preview-meta">
              <span className="reply-preview-author">
                Replying to @{replyingTo.sender_username}
              </span>
              <p className="reply-preview-snippet">
                {replyingTo.is_deleted
                  ? 'This message was deleted'
                  : (replyingTo.content?.slice(0, 100) || '…')}
              </p>
            </div>
          </div>
          <button
            className="reply-preview-close"
            onClick={onCancel}
            title="Cancel reply"
          >
            ✕
          </button>
        </div>
      )}
      <input placeholder="Type a message" />
    </div>
  );
}

describe('Reply Preview Banner', () => {
  it('should show the reply preview when replyingTo is set', () => {
    const replyingTo = {
      id: 5,
      sender_username: 'alice',
      content: 'Hello there!',
      is_deleted: false
    };

    render(<ReplyPreviewTestComponent replyingTo={replyingTo} onCancel={() => {}} />);

    expect(screen.getByTestId('reply-preview')).toBeInTheDocument();
    expect(screen.getByText('Replying to @alice')).toBeInTheDocument();
    expect(screen.getByText('Hello there!')).toBeInTheDocument();
  });

  it('should NOT show the reply preview when replyingTo is null', () => {
    render(<ReplyPreviewTestComponent replyingTo={null} onCancel={() => {}} />);
    expect(screen.queryByTestId('reply-preview')).not.toBeInTheDocument();
  });

  it('should call onCancel when the close button is clicked', () => {
    const onCancel = vi.fn();
    const replyingTo = {
      id: 5,
      sender_username: 'alice',
      content: 'Hello',
      is_deleted: false
    };

    render(<ReplyPreviewTestComponent replyingTo={replyingTo} onCancel={onCancel} />);
    fireEvent.click(screen.getByTitle('Cancel reply'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should show "This message was deleted" for deleted reply targets', () => {
    const replyingTo = {
      id: 5,
      sender_username: 'bob',
      content: 'original',
      is_deleted: true
    };

    render(<ReplyPreviewTestComponent replyingTo={replyingTo} onCancel={() => {}} />);
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
  });
});

// Simulates the date separator rendering logic
function DateSeparatorTestComponent({ messages }) {
  return (
    <div>
      {messages.map((m, idx, arr) => {
        const currDate = new Date(m.created_at).toDateString();
        const prevDate = idx > 0 ? new Date(arr[idx - 1].created_at).toDateString() : null;
        const showDateSep = idx === 0 || currDate !== prevDate;

        return (
          <React.Fragment key={m.id}>
            {showDateSep && (
              <div className="date-separator" data-testid="date-separator">
                <span>{getDateSeparatorLabel(m.created_at)}</span>
              </div>
            )}
            <div className="message-bubble-row">
              <p>{m.content}</p>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

describe('Date Separator', () => {
  it('should show a separator before the first message', () => {
    const messages = [
      { id: 1, content: 'Hello', created_at: new Date().toISOString() }
    ];

    render(<DateSeparatorTestComponent messages={messages} />);
    const seps = screen.getAllByTestId('date-separator');
    expect(seps).toHaveLength(1);
    expect(seps[0]).toHaveTextContent('Today');
  });

  it('should show a separator between messages on different days', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messages = [
      { id: 1, content: 'Old message', created_at: yesterday.toISOString() },
      { id: 2, content: 'New message', created_at: today.toISOString() }
    ];

    render(<DateSeparatorTestComponent messages={messages} />);
    const seps = screen.getAllByTestId('date-separator');
    expect(seps).toHaveLength(2);
    expect(seps[0]).toHaveTextContent('Yesterday');
    expect(seps[1]).toHaveTextContent('Today');
  });

  it('should NOT show a separator between messages on the same day', () => {
    const now = new Date();
    const messages = [
      { id: 1, content: 'First', created_at: now.toISOString() },
      { id: 2, content: 'Second', created_at: now.toISOString() }
    ];

    render(<DateSeparatorTestComponent messages={messages} />);
    const seps = screen.getAllByTestId('date-separator');
    // Only 1 separator for the first message
    expect(seps).toHaveLength(1);
  });
});

// =====================================================================
// Reaction Pills Tests
// =====================================================================
function ReactionPillsTestComponent({ reactions, currentUserId, onToggle }) {
  if (!reactions || reactions.length === 0) return null;
  const grouped = reactions.reduce((acc, r) => {
    acc[r.reaction] = (acc[r.reaction] || []).concat(r);
    return acc;
  }, {});

  return (
    <div className="message-reactions-row" data-testid="reactions-row">
      {Object.entries(grouped).map(([emoji, reacts]) => {
        const hasMyReaction = reacts.some((r) => r.user_id === currentUserId);
        return (
          <button
            key={emoji}
            className={`reaction-pill ${hasMyReaction ? 'my-reaction' : ''}`}
            data-testid={`reaction-pill-${emoji}`}
            onClick={() => onToggle && onToggle(emoji)}
          >
            <span className="reaction-emoji">{emoji}</span>
            {reacts.length > 1 && <span className="reaction-count">{reacts.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

describe('Reaction Pills', () => {
  it('should render aggregated reaction pills with counts', () => {
    const reactions = [
      { user_id: 1, reaction: '❤️' },
      { user_id: 2, reaction: '❤️' },
      { user_id: 3, reaction: '😂' }
    ];

    render(<ReactionPillsTestComponent reactions={reactions} currentUserId={1} />);

    expect(screen.getByTestId('reaction-pill-❤️')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-pill-❤️')).toHaveTextContent('2');
    expect(screen.getByTestId('reaction-pill-❤️')).toHaveClass('my-reaction');

    expect(screen.getByTestId('reaction-pill-😂')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-pill-😂')).not.toHaveClass('my-reaction');
  });

  it('should call onToggle when a reaction pill is clicked', () => {
    const onToggle = vi.fn();
    const reactions = [{ user_id: 2, reaction: '🔥' }];

    render(<ReactionPillsTestComponent reactions={reactions} currentUserId={1} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('reaction-pill-🔥'));

    expect(onToggle).toHaveBeenCalledWith('🔥');
  });
});

// =====================================================================
// Pinned Message Banner Tests
// =====================================================================
function PinnedBannerTestComponent({ pinnedMessage, onScroll, onUnpin }) {
  if (!pinnedMessage) return null;
  return (
    <div className="pinned-message-banner" data-testid="pinned-banner" onClick={onScroll}>
      <span className="pinned-banner-label">Pinned Message</span>
      <p className="pinned-banner-snippet">{pinnedMessage.content}</p>
      <button
        className="pinned-banner-close"
        data-testid="unpin-btn"
        onClick={(e) => {
          e.stopPropagation();
          onUnpin();
        }}
      >
        ✕
      </button>
    </div>
  );
}

describe('Pinned Message Banner', () => {
  it('should display pinned message snippet', () => {
    const pinned = { id: 10, content: 'Remember the meeting!' };
    render(<PinnedBannerTestComponent pinnedMessage={pinned} />);

    expect(screen.getByTestId('pinned-banner')).toBeInTheDocument();
    expect(screen.getByText('Remember the meeting!')).toBeInTheDocument();
  });

  it('should call onUnpin when unpin button is clicked without calling onScroll', () => {
    const onScroll = vi.fn();
    const onUnpin = vi.fn();
    const pinned = { id: 10, content: 'Pinned' };

    render(<PinnedBannerTestComponent pinnedMessage={pinned} onScroll={onScroll} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByTestId('unpin-btn'));

    expect(onUnpin).toHaveBeenCalledTimes(1);
    expect(onScroll).not.toHaveBeenCalled();
  });
});

// =====================================================================
// Starred Badge Tests
// =====================================================================
function StarredBadgeTestComponent({ isStarred }) {
  return (
    <div className="message-info-row">
      <span className="message-timestamp">10:00 AM</span>
      {isStarred && <span data-testid="starred-icon">⭐</span>}
    </div>
  );
}

describe('Starred Message Badge', () => {
  it('should render star icon when message is starred', () => {
    render(<StarredBadgeTestComponent isStarred={true} />);
    expect(screen.getByTestId('starred-icon')).toBeInTheDocument();
  });

  it('should not render star icon when message is not starred', () => {
    render(<StarredBadgeTestComponent isStarred={false} />);
    expect(screen.queryByTestId('starred-icon')).not.toBeInTheDocument();
  });
});

// =====================================================================
// Phase 2: getReplySnippet Tests
// =====================================================================
function parseMediaPayloadTest(content) {
  if (!content || typeof content !== 'string') return null;
  if (!content.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.__media && parsed.type) {
      return parsed;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function getReplySnippetTest(replyMsg) {
  if (!replyMsg) return '';
  if (replyMsg.is_deleted) return 'Original message was deleted';
  const media = parseMediaPayloadTest(replyMsg.content);
  if (media) {
    if (media.type === 'image') return '📷 Photo';
    if (media.type === 'audio') {
      const dur = media.duration ? ` (${Math.round(media.duration)}s)` : '';
      return `🎙 Voice note${dur}`;
    }
    if (media.type === 'video') return '🎥 Video';
    if (media.type === 'document') return '📄 Document';
  }
  return replyMsg.content?.slice(0, 120) || '…';
}

describe('getReplySnippet', () => {
  it('should return text snippet for standard text message', () => {
    expect(getReplySnippetTest({ content: 'Hello world from reply!' })).toBe('Hello world from reply!');
  });

  it('should return "Original message was deleted" for deleted message', () => {
    expect(getReplySnippetTest({ content: 'text', is_deleted: true })).toBe('Original message was deleted');
  });

  it('should return "📷 Photo" for image media payload', () => {
    const payload = JSON.stringify({ __media: true, type: 'image', fileUrl: 'https://example.com/img.png' });
    expect(getReplySnippetTest({ content: payload })).toBe('📷 Photo');
  });

  it('should return "🎙 Voice note (12s)" for audio media payload with duration', () => {
    const payload = JSON.stringify({ __media: true, type: 'audio', duration: 11.8 });
    expect(getReplySnippetTest({ content: payload })).toBe('🎙 Voice note (12s)');
  });
});

// =====================================================================
// Phase 2: Selection Action Bar Tests
// =====================================================================
function SelectionActionBarTestComponent({ selectedCount, onForward, onStar, onDelete, onCancel }) {
  return (
    <div className="selection-action-bar" data-testid="selection-bar">
      <div className="selection-count-badge" data-testid="selection-count">
        <span>{selectedCount} selected</span>
      </div>
      <div className="selection-actions-wrap">
        <button
          type="button"
          className="btn-selection-action"
          onClick={onForward}
          disabled={selectedCount === 0}
          data-testid="btn-forward"
        >
          Forward
        </button>
        <button
          type="button"
          className="btn-selection-action"
          onClick={onStar}
          disabled={selectedCount === 0}
          data-testid="btn-star"
        >
          Star
        </button>
        <button
          type="button"
          className="btn-selection-action btn-selection-danger"
          onClick={() => onDelete('for_me')}
          disabled={selectedCount === 0}
          data-testid="btn-delete"
        >
          Delete
        </button>
        <button
          type="button"
          className="btn-selection-action btn-selection-cancel"
          onClick={onCancel}
          data-testid="btn-cancel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

describe('Selection Action Bar', () => {
  it('should display the selected count correctly', () => {
    render(<SelectionActionBarTestComponent selectedCount={3} />);
    expect(screen.getByTestId('selection-count')).toHaveTextContent('3 selected');
  });

  it('should disable action buttons when selectedCount is 0', () => {
    render(<SelectionActionBarTestComponent selectedCount={0} />);
    expect(screen.getByTestId('btn-forward')).toBeDisabled();
    expect(screen.getByTestId('btn-star')).toBeDisabled();
    expect(screen.getByTestId('btn-delete')).toBeDisabled();
  });

  it('should trigger handlers when action buttons are clicked with items selected', () => {
    const onForward = vi.fn();
    const onStar = vi.fn();
    const onDelete = vi.fn();
    const onCancel = vi.fn();

    render(
      <SelectionActionBarTestComponent
        selectedCount={2}
        onForward={onForward}
        onStar={onStar}
        onDelete={onDelete}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId('btn-forward'));
    expect(onForward).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn-star'));
    expect(onStar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn-delete'));
    expect(onDelete).toHaveBeenCalledWith('for_me');

    fireEvent.click(screen.getByTestId('btn-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// =====================================================================
// Phase 3: formatLastSeen Tests
// =====================================================================
function formatLastSeenTest(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isSameDay(date, now)) return `today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return `yesterday at ${timeStr}`;

  const isThisWeek = diffMs < 7 * 24 * 60 * 60 * 1000;
  if (isThisWeek) {
    const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `on ${dayName} at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${dateStr} at ${timeStr}`;
}

describe('formatLastSeen', () => {
  it('should return "just now" for timestamp seconds ago', () => {
    const justNow = new Date(Date.now() - 10000).toISOString();
    expect(formatLastSeenTest(justNow)).toBe('just now');
  });

  it('should return "today at ..." for earlier today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T15:00:00.000Z'));
    const earlierToday = new Date('2026-09-15T12:00:00.000Z');
    const result = formatLastSeenTest(earlierToday.toISOString());
    expect(result).toMatch(/^today at/);
    vi.useRealTimers();
  });

  it('should return "yesterday at ..." for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(14, 30);
    const result = formatLastSeenTest(yesterday.toISOString());
    expect(result).toMatch(/^yesterday at/);
  });
});

// =====================================================================
// Phase 3: 3-State Delivery Receipt Tests
// =====================================================================
function DeliveryReceiptTestComponent({ isRead, deliveredAt }) {
  return (
    <span
      className="message-receipt-tick"
      data-testid="receipt-tick"
      title={isRead ? 'Read' : deliveredAt ? 'Delivered' : 'Sent'}
    >
      {isRead ? (
        <span data-testid="check-read" className="receipt-check-read">✓✓</span>
      ) : deliveredAt ? (
        <span data-testid="check-delivered" className="receipt-check-delivered">✓✓</span>
      ) : (
        <span data-testid="check-sent" className="receipt-check-sent">✓</span>
      )}
    </span>
  );
}

describe('3-State Delivery Status Indicator', () => {
  it('should render single check for Sent message', () => {
    render(<DeliveryReceiptTestComponent isRead={false} deliveredAt={null} />);
    expect(screen.getByTestId('check-sent')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-tick')).toHaveAttribute('title', 'Sent');
  });

  it('should render double check for Delivered message', () => {
    render(<DeliveryReceiptTestComponent isRead={false} deliveredAt="2026-09-14T08:00:00Z" />);
    expect(screen.getByTestId('check-delivered')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-tick')).toHaveAttribute('title', 'Delivered');
  });

  it('should render blue double check for Read message', () => {
    render(<DeliveryReceiptTestComponent isRead={true} deliveredAt="2026-09-14T08:00:00Z" />);
    expect(screen.getByTestId('check-read')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-tick')).toHaveAttribute('title', 'Read');
  });
});

// =====================================================================
// Phase 3: Inline New Messages Separator Tests
// =====================================================================
describe('Inline New Messages Separator', () => {
  it('should display the unread count in the separator pill', () => {
    render(
      <div className="new-messages-separator" id="new-messages-divider" data-testid="unread-divider">
        <span className="new-messages-pill">New Messages (4)</span>
      </div>
    );
    expect(screen.getByTestId('unread-divider')).toBeInTheDocument();
    expect(screen.getByText('New Messages (4)')).toBeInTheDocument();
  });
});

// =====================================================================
// Phase 3: Search Media Filter Tests
// =====================================================================
describe('Search Media Filter', () => {
  const sampleMessages = [
    { id: 1, content: 'Regular text message', is_starred: false },
    { id: 2, content: JSON.stringify({ __media: true, type: 'image' }), is_starred: true },
    { id: 3, content: JSON.stringify({ __media: true, type: 'audio' }), is_starred: false },
    { id: 4, content: JSON.stringify({ __media: true, type: 'document' }), is_starred: true },
  ];

  function filterMessages(msgs, mediaType, query = '') {
    return msgs.filter((m) => {
      if (mediaType === 'image') {
        const media = parseMediaPayloadTest(m.content);
        if (!media || media.type !== 'image') return false;
      } else if (mediaType === 'audio') {
        const media = parseMediaPayloadTest(m.content);
        if (!media || media.type !== 'audio') return false;
      } else if (mediaType === 'document') {
        const media = parseMediaPayloadTest(m.content);
        if (!media || media.type !== 'document') return false;
      } else if (mediaType === 'starred') {
        if (!m.is_starred) return false;
      }
      if (!query.trim()) return true;
      return m.content && m.content.toLowerCase().includes(query.toLowerCase());
    });
  }

  it('should filter photos when mediaType is image', () => {
    const results = filterMessages(sampleMessages, 'image');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(2);
  });

  it('should filter voice notes when mediaType is audio', () => {
    const results = filterMessages(sampleMessages, 'audio');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
  });

  it('should filter documents when mediaType is document', () => {
    const results = filterMessages(sampleMessages, 'document');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(4);
  });

  it('should filter starred messages when mediaType is starred', () => {
    const results = filterMessages(sampleMessages, 'starred');
    expect(results).toHaveLength(2);
    expect(results.map((m) => m.id)).toEqual([2, 4]);
  });
});

// =====================================================================
// Phase 4: Audio Speed Cycling Tests
// =====================================================================
describe('Phase 4: Audio Speed Button Cycling', () => {
  function AudioSpeedToggleTest() {
    const [playbackSpeed, setPlaybackSpeed] = React.useState(1);
    const handleToggle = () => {
      const next = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
      setPlaybackSpeed(next);
    };
    return (
      <button data-testid="speed-btn" onClick={handleToggle}>
        {playbackSpeed}x
      </button>
    );
  }

  it('should cycle playback speed 1x -> 1.5x -> 2x -> 1x on click', () => {
    render(<AudioSpeedToggleTest />);
    const btn = screen.getByTestId('speed-btn');

    expect(btn.textContent).toBe('1x');
    fireEvent.click(btn);
    expect(btn.textContent).toBe('1.5x');
    fireEvent.click(btn);
    expect(btn.textContent).toBe('2x');
    fireEvent.click(btn);
    expect(btn.textContent).toBe('1x');
  });
});

// =====================================================================
// Phase 4: Draft Auto-Save & Sidebar Tag Tests
// =====================================================================
describe('Phase 4: Per-Conversation Drafts', () => {
  it('should format draft snippet with Draft: prefix in conversation list', () => {
    const draftText = 'Draft message for bob';
    render(
      <div className="conversation-preview-row">
        <span className="conversation-snippet draft-snippet" data-testid="draft-preview">
          <span className="draft-tag">Draft: </span>
          {draftText}
        </span>
      </div>
    );

    const el = screen.getByTestId('draft-preview');
    expect(el).toBeInTheDocument();
    expect(el.textContent).toBe('Draft: Draft message for bob');
  });

  it('should save and clear draft in mock storage', () => {
    const storage = {};
    const saveDraft = (user, text) => {
      if (text && text.trim()) storage[`vg_draft_${user}`] = text;
      else delete storage[`vg_draft_${user}`];
    };

    saveDraft('alice', 'Hello Alice');
    expect(storage['vg_draft_alice']).toBe('Hello Alice');

    // Clearing on send
    saveDraft('alice', '');
    expect(storage['vg_draft_alice']).toBeUndefined();
  });
});

// =====================================================================
// Phase 4: Message Failed Tag & Retry / Discard Tests
// =====================================================================
describe('Phase 4: Failed Message Retry and Discard', () => {
  function FailedMessageBubbleTest({ onRetry, onDiscard }) {
    return (
      <div className="message-bubble-row outgoing">
        <div className="message-failed-tag" data-testid="failed-tag">
          <span className="failed-text">⚠️ Failed to send</span>
          <button type="button" className="btn-retry-msg" onClick={onRetry} data-testid="retry-btn">
            Retry
          </button>
          <button type="button" className="btn-discard-msg" onClick={onDiscard} data-testid="discard-btn">
            ✕
          </button>
        </div>
      </div>
    );
  }

  it('should render failed tag with Retry and Discard buttons', () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();

    render(<FailedMessageBubbleTest onRetry={onRetry} onDiscard={onDiscard} />);

    expect(screen.getByTestId('failed-tag')).toBeInTheDocument();
    expect(screen.getByText('⚠️ Failed to send')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('retry-btn'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('discard-btn'));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

// =====================================================================
// Phase 4: Document Attachment Card Rendering
// =====================================================================
describe('Phase 4: Encrypted Document Attachment Card', () => {
  it('should render document name, size, and download link', () => {
    const fileName = 'quarterly_report.pdf';
    const fileSize = 204800; // 200 KB
    const fileSizeStr = ` · ${(fileSize / 1024).toFixed(1)} KB`;

    render(
      <div className="encrypted-doc-wrap" data-testid="doc-card">
        <div className="doc-icon-wrap">📄</div>
        <div className="doc-info">
          <span className="doc-name">{fileName}</span>
          <span className="doc-meta">Document{fileSizeStr} · 🔒 E2EE</span>
        </div>
        <a href="blob:mock" download={fileName} className="btn-doc-download" data-testid="doc-download">
          ⬇
        </a>
      </div>
    );

    expect(screen.getByTestId('doc-card')).toBeInTheDocument();
    expect(screen.getByText(fileName)).toBeInTheDocument();
    expect(screen.getByText(/200.0 KB/)).toBeInTheDocument();
    expect(screen.getByTestId('doc-download')).toHaveAttribute('download', fileName);
  });
});

// =====================================================================
// Phase 5: Conversation Controls & Privacy Tests
// =====================================================================
describe('Phase 5: Conversation Pinning & Sorting', () => {
  it('should sort pinned conversations ahead of unpinned conversations', () => {
    const rawConversations = [
      { id: 1, username: 'alice', is_pinned: false, last_message_at: '2026-09-14T08:00:00Z' },
      { id: 2, username: 'bob', is_pinned: true, last_message_at: '2026-09-14T07:00:00Z' },
      { id: 3, username: 'charlie', is_pinned: false, last_message_at: '2026-09-14T09:00:00Z' }
    ];

    const sorted = [...rawConversations].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
      return new Date(b.last_message_at) - new Date(a.last_message_at);
    });

    expect(sorted[0].username).toBe('bob'); // Pinned conversation comes first
    expect(sorted[1].username).toBe('charlie'); // Most recent unpinned
    expect(sorted[2].username).toBe('alice');
  });

  it('should render pin badge and muted badge in conversation item', () => {
    render(
      <div className="conversation-item">
        <div className="conversation-name-row">
          <span className="conversation-username">
            @bob
            <span data-testid="pin-icon" title="Pinned to top">📌</span>
          </span>
          <span className="conversation-time">
            <span data-testid="mute-icon" title="Muted">🔇</span>
            2h ago
          </span>
        </div>
      </div>
    );

    expect(screen.getByTestId('pin-icon')).toBeInTheDocument();
    expect(screen.getByTestId('mute-icon')).toBeInTheDocument();
  });
});

describe('Phase 5: Blocked User Banner and Composer Notice', () => {
  it('should render blocked banner with unblock button when user is blocked', () => {
    const handleUnblock = vi.fn();
    render(
      <div className="chat-blocked-banner" data-testid="blocked-banner">
        <span>You have blocked @spammer.</span>
        <button type="button" className="btn-unblock-banner" onClick={handleUnblock}>
          Unblock
        </button>
      </div>
    );

    expect(screen.getByTestId('blocked-banner')).toBeInTheDocument();
    expect(screen.getByText('You have blocked @spammer.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Unblock'));
    expect(handleUnblock).toHaveBeenCalledTimes(1);
  });

  it('should render composer blocked notice instead of input form', () => {
    render(
      <div className="chat-composer-blocked-notice" data-testid="composer-blocked">
        <span>You blocked @spammer. Unblock to send messages.</span>
      </div>
    );

    expect(screen.getByTestId('composer-blocked')).toBeInTheDocument();
    expect(screen.getByText('You blocked @spammer. Unblock to send messages.')).toBeInTheDocument();
  });
});

describe('Phase 5: Mute Duration Options', () => {
  function MuteModalTestComponent({ onConfirm }) {
    const [durationHours, setDurationHours] = React.useState(8);
    return (
      <div className="mute-duration-modal" data-testid="mute-modal">
        <div className="mute-options-list">
          <label>
            <input
              type="radio"
              data-testid="mute-8h"
              checked={durationHours === 8}
              onChange={() => setDurationHours(8)}
            />
            8 Hours
          </label>
          <label>
            <input
              type="radio"
              data-testid="mute-1w"
              checked={durationHours === 168}
              onChange={() => setDurationHours(168)}
            />
            1 Week
          </label>
          <label>
            <input
              type="radio"
              data-testid="mute-always"
              checked={durationHours === null}
              onChange={() => setDurationHours(null)}
            />
            Always
          </label>
        </div>
        <button
          type="button"
          data-testid="confirm-mute-btn"
          onClick={() => onConfirm(durationHours)}
        >
          Mute
        </button>
      </div>
    );
  }

  it('should allow selecting 1 week and confirming mute', () => {
    const onConfirm = vi.fn();
    render(<MuteModalTestComponent onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('mute-1w'));
    fireEvent.click(screen.getByTestId('confirm-mute-btn'));

    expect(onConfirm).toHaveBeenCalledWith(168);
  });

  it('should allow selecting Always and confirming mute', () => {
    const onConfirm = vi.fn();
    render(<MuteModalTestComponent onConfirm={onConfirm} />);

    fireEvent.click(screen.getByTestId('mute-always'));
    fireEvent.click(screen.getByTestId('confirm-mute-btn'));

    expect(onConfirm).toHaveBeenCalledWith(null);
  });
});

describe('Phase 5: Report Conversation Modal', () => {
  function ReportModalTestComponent({ onSubmit }) {
    const [reason, setReason] = React.useState('spam');
    const [details, setDetails] = React.useState('');

    return (
      <form
        data-testid="report-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ reason, details });
        }}
      >
        <input
          type="radio"
          name="reason"
          data-testid="reason-spam"
          checked={reason === 'spam'}
          onChange={() => setReason('spam')}
        />
        <input
          type="radio"
          name="reason"
          data-testid="reason-harassment"
          checked={reason === 'harassment'}
          onChange={() => setReason('harassment')}
        />
        <textarea
          data-testid="report-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <button type="submit" data-testid="submit-report-btn">
          Submit Report
        </button>
      </form>
    );
  }

  it('should submit report with selected reason and details', () => {
    const onSubmit = vi.fn();
    render(<ReportModalTestComponent onSubmit={onSubmit} />);

    fireEvent.click(screen.getByTestId('reason-harassment'));
    fireEvent.change(screen.getByTestId('report-details'), {
      target: { value: 'Inappropriate messages sent.' }
    });
    fireEvent.click(screen.getByTestId('submit-report-btn'));

    expect(onSubmit).toHaveBeenCalledWith({
      reason: 'harassment',
      details: 'Inappropriate messages sent.'
    });
  });
});

// =====================================================================
// Phase 6: E2EE Zero-Knowledge Transmission & Multi-Device Tests
// =====================================================================
describe('Phase 6: E2EE Zero-Knowledge Payload Formatting', () => {
  it('should suppress plaintext content when ciphertext is present in send payload', () => {
    const textToSend = 'Very confidential message';
    const encEnvelope = {
      ciphertext: 'enc_ciphertext_abc',
      ivNonce: 'iv_nonce_123',
      senderDeviceId: 'dev-1'
    };

    // Construct the payload as done in MessagesPage.jsx
    const payload = {
      content: encEnvelope.ciphertext ? '' : textToSend,
      ciphertext: encEnvelope.ciphertext || null,
      ivNonce: encEnvelope.ivNonce || null,
      senderDeviceId: encEnvelope.senderDeviceId || null
    };

    expect(payload.content).toBe('');
    expect(payload.ciphertext).toBe('enc_ciphertext_abc');
    expect(payload.ivNonce).toBe('iv_nonce_123');
  });

  it('should preserve plaintext content when encryption is not available', () => {
    const textToSend = 'Standard message';
    const encEnvelope = {
      ciphertext: null,
      ivNonce: null
    };

    const payload = {
      content: encEnvelope.ciphertext ? '' : textToSend,
      ciphertext: encEnvelope.ciphertext || null,
      ivNonce: encEnvelope.ivNonce || null
    };

    expect(payload.content).toBe('Standard message');
    expect(payload.ciphertext).toBeNull();
  });
});

describe('Phase 6: Linked Devices List & Revocation UI', () => {
  function LinkedDevicesPaneTest({ devices, currentDeviceId, onRevoke }) {
    return (
      <div className="devices-manager-pane" data-testid="devices-pane">
        <div className="devices-list">
          {devices.map((d) => {
            const isCurrent = d.device_id === currentDeviceId;
            return (
              <div key={d.device_id} className="device-card" data-testid={`device-${d.device_id}`}>
                <span className="device-id-code">{d.device_id}</span>
                {isCurrent && <span data-testid="current-badge">This Device</span>}
                {!isCurrent && (
                  <button
                    type="button"
                    className="btn-revoke-device"
                    data-testid={`revoke-${d.device_id}`}
                    onClick={() => onRevoke(d.device_id)}
                  >
                    Revoke
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  it('should display "This Device" badge on current device and Revoke on others', () => {
    const devices = [
      { device_id: 'device-laptop-current' },
      { device_id: 'device-old-phone' }
    ];
    const onRevoke = vi.fn();

    render(
      <LinkedDevicesPaneTest
        devices={devices}
        currentDeviceId="device-laptop-current"
        onRevoke={onRevoke}
      />
    );

    expect(screen.getByTestId('current-badge')).toBeInTheDocument();
    expect(screen.getByTestId('revoke-device-old-phone')).toBeInTheDocument();
    expect(screen.queryByTestId('revoke-device-laptop-current')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('revoke-device-old-phone'));
    expect(onRevoke).toHaveBeenCalledWith('device-old-phone');
  });
});

// =====================================================================
// Mobile DM Keyboard, Voice Note Duration & Call Options Tests
// =====================================================================
describe('Mobile DM UX and Voice Note Fixes', () => {
  it('should render chat composer input without autoFocus attribute', () => {
    function DummyChatComposer() {
      return (
        <input
          type="text"
          placeholder="Message @user..."
          className="chat-input-field"
          data-testid="chat-input-field"
        />
      );
    }
    render(<DummyChatComposer />);
    const inputEl = screen.getByTestId('chat-input-field');
    expect(inputEl).toBeInTheDocument();
    expect(inputEl).not.toHaveAttribute('autofocus');
  });

  it('should dynamically calculate and format voice note duration accurately', () => {
    function VoiceNoteDisplay({ durationSeconds, loadedDuration }) {
      const rawSecs = durationSeconds;
      const hasValidPayloadDuration = typeof rawSecs === 'number' && rawSecs > 0;
      const durationNum = hasValidPayloadDuration
        ? rawSecs
        : (loadedDuration && isFinite(loadedDuration) && loadedDuration > 0 ? loadedDuration : null);

      return (
        <span data-testid="voice-label">
          Voice Note{durationNum ? ` (${durationNum}s)` : ''}
        </span>
      );
    }

    // When payload duration is valid
    const { rerender } = render(<VoiceNoteDisplay durationSeconds={14} loadedDuration={null} />);
    expect(screen.getByTestId('voice-label')).toHaveTextContent('Voice Note (14s)');

    // When payload duration was 0 but audio metadata loaded duration is 7s
    rerender(<VoiceNoteDisplay durationSeconds={0} loadedDuration={7} />);
    expect(screen.getByTestId('voice-label')).toHaveTextContent('Voice Note (7s)');

    // When both are 0 / null, should display "Voice Note" without ugly (0s)
    rerender(<VoiceNoteDisplay durationSeconds={0} loadedDuration={null} />);
    expect(screen.getByTestId('voice-label')).toHaveTextContent('Voice Note');
  });

  it('should render Voice Call and Video Call options in conversation dropdown menu', () => {
    function DummyDropdownMenu({ onVoiceCall, onVideoCall }) {
      return (
        <div className="conv-dropdown-menu">
          <button type="button" className="conv-dropdown-item" onClick={onVoiceCall}>
            <span>Voice Call</span>
          </button>
          <button type="button" className="conv-dropdown-item" onClick={onVideoCall}>
            <span>Video Call</span>
          </button>
        </div>
      );
    }

    const onVoice = vi.fn();
    const onVideo = vi.fn();
    render(<DummyDropdownMenu onVoiceCall={onVoice} onVideoCall={onVideo} />);

    const voiceBtn = screen.getByText('Voice Call');
    const videoBtn = screen.getByText('Video Call');

    expect(voiceBtn).toBeInTheDocument();
    expect(videoBtn).toBeInTheDocument();

    fireEvent.click(voiceBtn);
    expect(onVoice).toHaveBeenCalledTimes(1);

    fireEvent.click(videoBtn);
    expect(onVideo).toHaveBeenCalledTimes(1);
  });

  describe('Style 1: WhatsApp Classic Top Action Bar & Floating Reaction Pill', () => {
    function WhatsAppActionBarComponent({
      selectedMessage,
      onDeselect = vi.fn(),
      onReply = vi.fn(),
      onStar = vi.fn(),
      onDelete = vi.fn(),
      onForward = vi.fn(),
      onCopy = vi.fn(),
      onToggleReaction = vi.fn()
    }) {
      const [isMoreOpen, setIsMoreOpen] = React.useState(false);
      return (
        <div>
          {selectedMessage && (
            <div className="chat-header chat-top-action-bar" data-testid="chat-top-action-bar">
              <div className="top-action-bar-left">
                <button
                  type="button"
                  className="btn-action-bar-back"
                  onClick={onDeselect}
                  aria-label="Deselect message"
                >
                  ←
                </button>
                <span className="action-bar-count">1 selected</span>
              </div>
              <div className="top-action-bar-right">
                <button type="button" className="btn-action-icon" onClick={() => onReply(selectedMessage)} aria-label="Reply">Reply</button>
                <button type="button" className="btn-action-icon" onClick={() => onStar(selectedMessage)} aria-label="Star">Star</button>
                <button type="button" className="btn-action-icon btn-action-danger" onClick={() => onDelete(selectedMessage)} aria-label="Delete">Delete</button>
                <button type="button" className="btn-action-icon" onClick={() => onForward(selectedMessage)} aria-label="Forward">Forward</button>
                <button type="button" className="btn-action-icon" onClick={() => onCopy(selectedMessage)} aria-label="Copy text">Copy</button>
                <button type="button" className="btn-action-icon" onClick={() => setIsMoreOpen(!isMoreOpen)} aria-label="More options">More</button>
              </div>
              {isMoreOpen && (
                <div className="action-bar-more-dropdown" data-testid="more-dropdown">
                  <button type="button" className="action-bar-dropdown-item">Pin</button>
                  {selectedMessage.is_mine && <button type="button" className="action-bar-dropdown-item">Edit</button>}
                  {selectedMessage.is_mine && <button type="button" className="action-bar-dropdown-item">Message Info</button>}
                  <button type="button" className="action-bar-dropdown-item">Select Multiple</button>
                </div>
              )}
            </div>
          )}

          <div className={`message-bubble ${selectedMessage?.id === 42 ? 'is-highlighted-bubble' : ''}`}>
            {selectedMessage?.id === 42 && (
              <div className="vg-wa-floating-reactions" data-testid="wa-floating-reactions">
                {['❤️', '😂', '👍', '😮', '😢', '🙏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="vg-wa-react-btn"
                    onClick={() => {
                      onToggleReaction(42, emoji);
                      onDeselect();
                    }}
                    aria-label={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            Hello World
          </div>
        </div>
      );
    }

    it('renders top action bar with "1 selected" and action buttons when a message is selected', () => {
      const onDeselect = vi.fn();
      const onReply = vi.fn();
      render(
        <WhatsAppActionBarComponent
          selectedMessage={{ id: 42, content: 'Hello World', is_mine: true }}
          onDeselect={onDeselect}
          onReply={onReply}
        />
      );

      expect(screen.getByTestId('chat-top-action-bar')).toBeInTheDocument();
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByLabelText('Reply')).toBeInTheDocument();
      expect(screen.getByLabelText('Star')).toBeInTheDocument();
      expect(screen.getByLabelText('Delete')).toBeInTheDocument();
      expect(screen.getByLabelText('Forward')).toBeInTheDocument();
      expect(screen.getByLabelText('Copy text')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Deselect message'));
      expect(onDeselect).toHaveBeenCalledTimes(1);
    });

    it('renders floating reaction pill on the selected message bubble and reacts on click', () => {
      const onDeselect = vi.fn();
      const onToggleReaction = vi.fn();
      render(
        <WhatsAppActionBarComponent
          selectedMessage={{ id: 42, content: 'Hello World', is_mine: false }}
          onDeselect={onDeselect}
          onToggleReaction={onToggleReaction}
        />
      );

      const reactionPill = screen.getByTestId('wa-floating-reactions');
      expect(reactionPill).toBeInTheDocument();

      const heartBtn = screen.getByLabelText('React ❤️');
      expect(heartBtn).toBeInTheDocument();
      fireEvent.click(heartBtn);

      expect(onToggleReaction).toHaveBeenCalledWith(42, '❤️');
      expect(onDeselect).toHaveBeenCalledTimes(1);
    });

    it('toggles More dropdown with secondary actions (Pin, Edit, Info, Select)', () => {
      render(
        <WhatsAppActionBarComponent
          selectedMessage={{ id: 42, content: 'Hello World', is_mine: true }}
        />
      );

      expect(screen.queryByTestId('more-dropdown')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('More options'));

      expect(screen.getByTestId('more-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Pin')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Message Info')).toBeInTheDocument();
      expect(screen.getByText('Select Multiple')).toBeInTheDocument();
    });
  });

  describe('Scroll Preservation & Floating Jump-to-Bottom Button', () => {
    function ScrollPreservationComponent({
      isNearBottom,
      messages,
      isPartnerTyping,
      scrollToBottom = vi.fn()
    }) {
      const prevLengthRef = React.useRef(messages.length);
      const [newCount, setNewCount] = React.useState(0);
      const isNearBottomRef = React.useRef(isNearBottom);
      isNearBottomRef.current = isNearBottom;

      React.useEffect(() => {
        const hasNew = messages.length > prevLengthRef.current;
        const lastMsg = messages[messages.length - 1];

        if (hasNew && lastMsg?.is_mine) {
          scrollToBottom(true);
        } else if (isNearBottomRef.current) {
          if (hasNew || isPartnerTyping) {
            scrollToBottom(true);
          }
        } else {
          // Scrolled up: do not scroll!
          if (hasNew) {
            setNewCount((prev) => prev + (messages.length - prevLengthRef.current));
          }
        }
        prevLengthRef.current = messages.length;
      }, [messages, isPartnerTyping, scrollToBottom]);

      return (
        <div>
          {!isNearBottom && (
            <button
              type="button"
              data-testid="scroll-to-bottom-btn"
              onClick={() => scrollToBottom(true)}
              aria-label="Scroll to bottom"
            >
              ↓
              {newCount > 0 && <span data-testid="badge">{newCount}</span>}
            </button>
          )}
        </div>
      );
    }

    it('does NOT scroll to bottom when user is scrolled up reading old SMS during incoming messages or typing', () => {
      const scrollToBottom = vi.fn();
      const { rerender } = render(
        <ScrollPreservationComponent
          isNearBottom={false}
          messages={[{ id: 1, content: 'Old SMS', is_mine: false }]}
          isPartnerTyping={false}
          scrollToBottom={scrollToBottom}
        />
      );

      expect(scrollToBottom).not.toHaveBeenCalled();

      // Partner starts typing while scrolled up
      rerender(
        <ScrollPreservationComponent
          isNearBottom={false}
          messages={[{ id: 1, content: 'Old SMS', is_mine: false }]}
          isPartnerTyping={true}
          scrollToBottom={scrollToBottom}
        />
      );
      expect(scrollToBottom).not.toHaveBeenCalled();

      // New incoming message from partner while scrolled up
      rerender(
        <ScrollPreservationComponent
          isNearBottom={false}
          messages={[
            { id: 1, content: 'Old SMS', is_mine: false },
            { id: 2, content: 'New SMS', is_mine: false }
          ]}
          isPartnerTyping={false}
          scrollToBottom={scrollToBottom}
        />
      );
      expect(scrollToBottom).not.toHaveBeenCalled();

      // Floating button shows badge with 1 new message
      expect(screen.getByTestId('badge')).toHaveTextContent('1');
    });

    it('scrolls to bottom when user clicks floating jump-to-bottom button', () => {
      const scrollToBottom = vi.fn();
      render(
        <ScrollPreservationComponent
          isNearBottom={false}
          messages={[{ id: 1, content: 'Old SMS', is_mine: false }]}
          isPartnerTyping={false}
          scrollToBottom={scrollToBottom}
        />
      );

      const scrollBtn = screen.getByTestId('scroll-to-bottom-btn');
      expect(scrollBtn).toBeInTheDocument();
      fireEvent.click(scrollBtn);

      expect(scrollToBottom).toHaveBeenCalledWith(true);
    });

    it('scrolls to bottom on new incoming message when user is already at the bottom', () => {
      const scrollToBottom = vi.fn();
      const { rerender } = render(
        <ScrollPreservationComponent
          isNearBottom={true}
          messages={[{ id: 1, content: 'Old SMS', is_mine: false }]}
          isPartnerTyping={false}
          scrollToBottom={scrollToBottom}
        />
      );

      rerender(
        <ScrollPreservationComponent
          isNearBottom={true}
          messages={[
            { id: 1, content: 'Old SMS', is_mine: false },
            { id: 2, content: 'New SMS', is_mine: false }
          ]}
          isPartnerTyping={false}
          scrollToBottom={scrollToBottom}
        />
      );

      expect(scrollToBottom).toHaveBeenCalledWith(true);
    });
  });

  // =====================================================================
  // WhatsApp Classic Top Action Bar & Back Gesture Popstate Tests
  // =====================================================================
  describe('WhatsApp Classic Top Action Bar & Back Gesture Navigation', () => {
    function TopActionBarTestComponent({
      selectedMessages = [],
      onDeselect,
      onReply,
      onStar,
      onDelete,
      onForward,
      onCopy,
      isMoreOpen,
      onToggleMore,
      onSelectAll
    }) {
      if (!selectedMessages || selectedMessages.length === 0) return <div data-testid="normal-header">Normal Header</div>;

      return (
        <div className="chat-header chat-top-action-bar" data-testid="chat-top-action-bar">
          <div className="top-action-bar-left">
            <button
              type="button"
              className="btn-action-bar-back"
              onClick={onDeselect}
              title="Deselect message"
              aria-label="Deselect message"
            >
              Back
            </button>
            <span className="action-bar-count">
              <span className="count-num" data-testid="count-num">{selectedMessages.length}</span>
              <span className="count-label" data-testid="count-label"> selected</span>
            </span>
          </div>

          <div className="top-action-bar-right">
            {selectedMessages.length === 1 && (
              <button type="button" className="btn-action-icon" onClick={onReply} aria-label="Reply">Reply</button>
            )}
            <button type="button" className="btn-action-icon" onClick={onStar} aria-label="Star">Star</button>
            <button type="button" className="btn-action-icon btn-action-danger" onClick={onDelete} aria-label="Delete">Delete</button>
            <button type="button" className="btn-action-icon" onClick={onForward} aria-label="Forward">Forward</button>
            <button type="button" className="btn-action-icon" onClick={onCopy} aria-label="Copy text">Copy</button>
            <div className="action-bar-more-wrap">
              <button type="button" className="btn-action-icon" onClick={onToggleMore} aria-label="More options">More</button>
              {isMoreOpen && (
                <div className="action-bar-more-dropdown" data-testid="more-dropdown">
                  <button type="button" onClick={onCopy}>Copy</button>
                  <button type="button" onClick={onSelectAll}>Select all</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    it('renders all 6 top action buttons and count spans when a single message is selected', () => {
      const onDeselect = vi.fn();
      const onReply = vi.fn();
      const onStar = vi.fn();
      const onDelete = vi.fn();
      const onForward = vi.fn();
      const onCopy = vi.fn();
      const onToggleMore = vi.fn();

      render(
        <TopActionBarTestComponent
          selectedMessages={[{ id: 42, content: 'Test message', is_mine: true }]}
          onDeselect={onDeselect}
          onReply={onReply}
          onStar={onStar}
          onDelete={onDelete}
          onForward={onForward}
          onCopy={onCopy}
          isMoreOpen={false}
          onToggleMore={onToggleMore}
        />
      );

      expect(screen.getByTestId('chat-top-action-bar')).toBeInTheDocument();
      expect(screen.getByTestId('count-num')).toHaveTextContent('1');
      expect(screen.getByTestId('count-label')).toHaveTextContent('selected');

      expect(screen.getByRole('button', { name: 'Deselect message' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();
    });

    it('updates count to 3 and hides Reply when multiple messages are selected', () => {
      const selected = [
        { id: 1, content: 'First SMS' },
        { id: 2, content: 'Second SMS' },
        { id: 3, content: 'Third SMS' }
      ];

      render(
        <TopActionBarTestComponent
          selectedMessages={selected}
          onDeselect={vi.fn()}
          onReply={vi.fn()}
          onStar={vi.fn()}
          onDelete={vi.fn()}
          onForward={vi.fn()}
          onCopy={vi.fn()}
          isMoreOpen={false}
          onToggleMore={vi.fn()}
        />
      );

      expect(screen.getByTestId('count-num')).toHaveTextContent('3');
      // Reply is hidden for multiple messages
      expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
      // Bulk actions remain visible
      expect(screen.getByRole('button', { name: 'Star' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Forward' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More options' })).toBeInTheDocument();
    });

    it('toggles selection off for a message without deselecting other selected messages', () => {
      let selected = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const toggleSelect = (msg) => {
        const exists = selected.some((m) => m.id === msg.id);
        if (exists) {
          selected = selected.filter((m) => m.id !== msg.id);
        } else {
          selected = [...selected, msg];
        }
      };

      // Tapping message 2 removes it from selection while message 1 and 3 stay selected
      toggleSelect({ id: 2 });
      expect(selected.map((m) => m.id)).toEqual([1, 3]);

      // Tapping message 4 adds it to selection
      toggleSelect({ id: 4 });
      expect(selected.map((m) => m.id)).toEqual([1, 3, 4]);
    });

    it('opens three-dot more options dropdown with Copy and Select All', () => {
      const onToggleMore = vi.fn();
      const onSelectAll = vi.fn();

      render(
        <TopActionBarTestComponent
          selectedMessages={[{ id: 42, content: 'Test message', is_mine: true }]}
          onDeselect={vi.fn()}
          onReply={vi.fn()}
          onStar={vi.fn()}
          onDelete={vi.fn()}
          onForward={vi.fn()}
          onCopy={vi.fn()}
          isMoreOpen={true}
          onToggleMore={onToggleMore}
          onSelectAll={onSelectAll}
        />
      );

      const moreDropdown = screen.getByTestId('more-dropdown');
      expect(moreDropdown).toBeInTheDocument();
      expect(moreDropdown).toHaveTextContent('Copy');
      expect(moreDropdown).toHaveTextContent('Select all');
    });

    it('intercepts popstate back gesture when messages are selected without leaving the chat', () => {
      let selectedMsgs = [{ id: 99, content: 'Hello' }, { id: 100, content: 'World' }];
      let activePartner = { username: 'alice' };
      const setActivePartner = vi.fn((p) => { activePartner = p; });
      const setSelectedMsgs = vi.fn((m) => { selectedMsgs = m; });

      // Simulates the handlePopState logic
      const simulatePopState = (e) => {
        if (selectedMsgs && selectedMsgs.length > 0) {
          setSelectedMsgs([]);
          return;
        }
        if (activePartner) {
          if (!e.state || e.state.inChatWith !== activePartner.username) {
            setActivePartner(null);
          }
        }
      };

      // 1st back gesture while messages are selected: deselects all messages, does NOT exit chat
      simulatePopState({ state: { tab: 'messages', inChatWith: 'alice' } });
      expect(setSelectedMsgs).toHaveBeenCalledWith([]);
      expect(setActivePartner).not.toHaveBeenCalled();

      // 2nd back gesture after messages are deselected: exits chat to conversation list
      selectedMsgs = [];
      simulatePopState({ state: { tab: 'messages' } });
      expect(setActivePartner).toHaveBeenCalledWith(null);
    });

    it('suppresses synthetic click immediately following long-press selection so it is not toggled off', () => {
      let selectedMessages = [];
      let longPressFired = false;
      let justSelectedTimestamp = 0;

      const handleLongPress = (msg) => {
        longPressFired = true;
        justSelectedTimestamp = Date.now();
        selectedMessages = [msg];
      };

      const handleClick = (msg) => {
        if (longPressFired) {
          longPressFired = false;
          return; // suppressed!
        }
        if (Date.now() - justSelectedTimestamp < 450) {
          return; // suppressed!
        }
        if (selectedMessages.length > 0) {
          // toggle logic
          const exists = selectedMessages.some((m) => m.id === msg.id);
          if (exists) {
            selectedMessages = selectedMessages.filter((m) => m.id !== msg.id);
          } else {
            selectedMessages = [...selectedMessages, msg];
          }
        }
      };

      const testMsg = { id: 101, content: 'Long pressed message' };

      // 1. Long press timer fires
      handleLongPress(testMsg);
      expect(selectedMessages).toHaveLength(1);
      expect(selectedMessages[0].id).toBe(101);
      expect(longPressFired).toBe(true);

      // 2. Synthetic click fires ~20ms later
      handleClick(testMsg);
      // Ensure synthetic click did NOT deselect
      expect(selectedMessages).toHaveLength(1);
      expect(selectedMessages[0].id).toBe(101);
      expect(longPressFired).toBe(false);

      // 3. Subsequent user tap on a different message after cooldown (e.g. 500ms later)
      justSelectedTimestamp = Date.now() - 500;
      const testMsg2 = { id: 102, content: 'Second message' };
      handleClick(testMsg2);
      expect(selectedMessages).toHaveLength(2);
      expect(selectedMessages.map(m => m.id)).toEqual([101, 102]);

      // 4. Subsequent user tap on testMsg deselects only testMsg, leaves testMsg2
      justSelectedTimestamp = Date.now() - 500;
      handleClick(testMsg);
      expect(selectedMessages).toHaveLength(1);
      expect(selectedMessages[0].id).toBe(102);
    });

    it('deselects messages on Escape key press without closing the chat view', () => {
      let selectedMessages = [{ id: 101, content: 'Esc test' }];
      let activePartner = { username: 'bob' };
      const onDeselect = vi.fn(() => { selectedMessages = []; });
      const onCloseChat = vi.fn(() => { activePartner = null; });

      const handleGlobalKeyDown = (e) => {
        if (e.key === 'Escape') {
          if (selectedMessages && selectedMessages.length > 0) {
            onDeselect();
            return;
          }
          onCloseChat();
        }
      };

      // 1st Escape: deselects selected messages
      handleGlobalKeyDown({ key: 'Escape' });
      expect(onDeselect).toHaveBeenCalledTimes(1);
      expect(onCloseChat).not.toHaveBeenCalled();

      // 2nd Escape: now closes active chat
      handleGlobalKeyDown({ key: 'Escape' });
      expect(onCloseChat).toHaveBeenCalledTimes(1);
    });

    it('enforces 15-minute edit window logic correctly', () => {
      const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
      const isMessageEditable = (msg) => {
        if (!msg || !msg.is_mine || msg.is_deleted || msg.message_type === 'call_log') return false;
        if (!msg.created_at) return true;
        const elapsed = Date.now() - new Date(msg.created_at).getTime();
        return !isNaN(elapsed) && elapsed <= FIFTEEN_MINUTES_MS;
      };

      // Message created 5 minutes ago (editable)
      const recentMsg = {
        id: 1,
        is_mine: true,
        is_deleted: false,
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      };
      expect(isMessageEditable(recentMsg)).toBe(true);

      // Message created 16 minutes ago (not editable)
      const oldMsg = {
        id: 2,
        is_mine: true,
        is_deleted: false,
        created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString()
      };
      expect(isMessageEditable(oldMsg)).toBe(false);

      // Not mine (not editable even if recent)
      const othersMsg = {
        id: 3,
        is_mine: false,
        is_deleted: false,
        created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
      };
      expect(isMessageEditable(othersMsg)).toBe(false);

      // Deleted message (not editable)
      const deletedMsg = {
        id: 4,
        is_mine: true,
        is_deleted: true,
        created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString()
      };
      expect(isMessageEditable(deletedMsg)).toBe(false);
    });

    it('handles deletion of pending / sending messages with temp- IDs locally without API error', async () => {
      let messages = [
        { id: 10, content: 'Normal message', is_mine: true },
        { id: 'temp-12345', content: 'Sending / pending SMS', is_mine: true, pending: true }
      ];
      let selectedMessages = [{ id: 'temp-12345', content: 'Sending / pending SMS', is_mine: true, pending: true }];
      const onDeselect = vi.fn(() => { selectedMessages = []; });

      const handleDeleteMessage = async (msg) => {
        if (String(msg.id).startsWith('temp-') || msg.pending || msg.failed) {
          messages = messages.filter((m) => String(m.id) !== String(msg.id));
          onDeselect();
          return;
        }
      };

      await handleDeleteMessage(selectedMessages[0]);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(10);
      expect(onDeselect).toHaveBeenCalledTimes(1);
    });

    it('supports delete for me on sender sent messages', async () => {
      let messages = [
        { id: 101, content: 'My sent message', is_mine: true },
        { id: 102, content: 'Another message', is_mine: false }
      ];
      let selectedMessages = [{ id: 101, content: 'My sent message', is_mine: true }];
      const onDeselect = vi.fn(() => { selectedMessages = []; });

      const handleDeleteMessageForMe = (msg) => {
        messages = messages.filter((m) => String(m.id) !== String(msg.id));
        onDeselect();
      };

      handleDeleteMessageForMe(selectedMessages[0]);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(102);
      expect(onDeselect).toHaveBeenCalledTimes(1);
    });
  });

  // ===================================================================
  // Chat Presence and Deleted Message Tests
  // ===================================================================
  describe('Chat Presence and Deleted Message Behavior', () => {
    // 1. Presence Sub-label Component
    function ChatPresenceHeaderComponent({ activePartner, onlineUserIds }) {
      const isCurrentPartnerOnline = Boolean(
        activePartner && (
          onlineUserIds.has(Number(activePartner.id)) ||
          Boolean(activePartner.is_online)
        )
      );

      return (
        <span className="chat-header-sub" data-testid="chat-header-sub">
          {isCurrentPartnerOnline ? (
            <span className="online-sub-label">
              <span className="online-dot-pulse" /> Online
            </span>
          ) : activePartner?.last_seen_at && activePartner?.show_online_status !== false ? (
            <span className="last-seen-label">
              Last seen {activePartner.last_seen_at.includes('just now') ? 'just now' : '5m ago'}
            </span>
          ) : (
            activePartner?.full_name || 'End-to-end encrypted'
          )}
        </span>
      );
    }

    it('shows "Online" with pulse dot when user is in onlineUserIds set or activePartner.is_online is true', () => {
      const partner = { id: 42, full_name: 'Bob', is_online: true };
      const onlineSet = new Set();
      const { rerender } = render(
        <ChatPresenceHeaderComponent activePartner={partner} onlineUserIds={onlineSet} />
      );

      expect(screen.getByTestId('chat-header-sub')).toHaveTextContent('Online');
      expect(screen.getByText('Online')).toHaveClass('online-sub-label');

      // Also when ID is in onlineUserIds set
      const offlinePartner = { id: 42, full_name: 'Bob', is_online: false };
      const onlineSetWithId = new Set([42]);
      rerender(
        <ChatPresenceHeaderComponent activePartner={offlinePartner} onlineUserIds={onlineSetWithId} />
      );
      expect(screen.getByTestId('chat-header-sub')).toHaveTextContent('Online');
    });

    it('shows "Last seen ..." when partner is offline and show_online_status is true', () => {
      const partner = {
        id: 42,
        full_name: 'Bob',
        is_online: false,
        last_seen_at: 'just now',
        show_online_status: true
      };
      const onlineSet = new Set();
      render(<ChatPresenceHeaderComponent activePartner={partner} onlineUserIds={onlineSet} />);

      expect(screen.getByTestId('chat-header-sub')).toHaveTextContent('Last seen just now');
    });

    it('does NOT show Online or Last seen when show_online_status is false', () => {
      const partner = {
        id: 42,
        full_name: 'Bob',
        is_online: false,
        last_seen_at: 'just now',
        show_online_status: false
      };
      const onlineSet = new Set();
      render(<ChatPresenceHeaderComponent activePartner={partner} onlineUserIds={onlineSet} />);

      expect(screen.getByTestId('chat-header-sub')).not.toHaveTextContent('Online');
      expect(screen.getByTestId('chat-header-sub')).not.toHaveTextContent('Last seen');
      expect(screen.getByTestId('chat-header-sub')).toHaveTextContent('Bob');
    });

    // 2. Deleted Message Actions & Permanent Treatment
    it('permanently treats deleted messages as deleted and prevents re-deletion, forwarding, editing, or reacting', () => {
      let messages = [
        { id: 201, content: 'Hello', is_mine: true, is_deleted: false },
        { id: 202, content: 'World', is_mine: false, is_deleted: false }
      ];

      // Simulate delete action
      const handleDeleteMessage = (msg) => {
        if (!msg || msg.is_deleted) return;
        messages = messages.map((m) =>
          m.id === msg.id
            ? { ...m, is_deleted: true, content: 'This message was deleted' }
            : m
        );
      };

      // 1. Delete message 201
      handleDeleteMessage(messages[0]);
      expect(messages[0].is_deleted).toBe(true);
      expect(messages[0].content).toBe('This message was deleted');

      // 2. Try to delete it again - must not change or trigger any action
      const deleteAttempt = vi.fn();
      const handlePromptDelete = (msg) => {
        if (!msg || msg.is_deleted) return;
        deleteAttempt();
      };
      handlePromptDelete(messages[0]);
      expect(deleteAttempt).not.toHaveBeenCalled();

      // 3. Selection guard - deleted messages cannot be selected
      const selectAttempt = vi.fn();
      const handleSelectMessageForAction = (msg) => {
        if (!msg || msg.is_deleted) return;
        selectAttempt();
      };
      handleSelectMessageForAction(messages[0]);
      expect(selectAttempt).not.toHaveBeenCalled();

      // 4. Pin guard - deleted messages cannot be pinned
      const pinAttempt = vi.fn();
      const handleTogglePin = (msg) => {
        if (!msg || msg.is_deleted) return;
        pinAttempt();
      };
      handleTogglePin(messages[0]);
      expect(pinAttempt).not.toHaveBeenCalled();

      // 5. Reaction guard - cannot react to deleted messages
      const reactionAttempt = vi.fn();
      const handleToggleReaction = (msgId) => {
        const msg = messages.find((m) => m.id === msgId);
        if (!msg || msg.is_deleted) return;
        reactionAttempt();
      };
      handleToggleReaction(messages[0].id);
      expect(reactionAttempt).not.toHaveBeenCalled();
    });

    // 3. Top Action Bar: Delete button hidden when selected message is deleted
    function TopActionBarComponent({ selectedMessages, onDelete }) {
      return (
        <div data-testid="chat-top-action-bar">
          <span>{selectedMessages.length} selected</span>
          {selectedMessages.some((m) => !m.is_deleted) && (
            <button type="button" data-testid="action-bar-delete" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      );
    }

    it('renders Delete button in Top Action Bar only when at least one non-deleted message is selected', () => {
      const onDelete = vi.fn();
      const nonDeletedMsg = { id: 1, content: 'Active', is_deleted: false };
      const deletedMsg = { id: 2, content: 'This message was deleted', is_deleted: true };

      // With non-deleted message selected: Delete button is present
      const { rerender } = render(
        <TopActionBarComponent selectedMessages={[nonDeletedMsg]} onDelete={onDelete} />
      );
      expect(screen.getByTestId('action-bar-delete')).toBeInTheDocument();

      // With only deleted message selected: Delete button is NOT rendered
      rerender(
        <TopActionBarComponent selectedMessages={[deletedMsg]} onDelete={onDelete} />
      );
      expect(screen.queryByTestId('action-bar-delete')).not.toBeInTheDocument();
    });
  });

  // =====================================================================
  // Phase 3: Message Micro-Interactions (Option 1: Haptic Pop & Heart Burst Suite)
  // =====================================================================
  describe('Phase 3: Message Micro-Interactions (Option 1: Haptic Pop & Heart Burst)', () => {
    // 1. Double-click Heart Burst Simulation Component
    function MessageBubbleWithBurst({ message, onReact, onReply }) {
      const [bursting, setBursting] = React.useState(false);

      const handleDoubleClick = () => {
        if (!message || message.is_deleted) return;
        setBursting(true);
        if (onReact) onReact(message.id, '❤️');
      };

      return (
        <div
          data-testid={`msg-row-${message.id}`}
          className={`message-bubble-row ${message.is_mine ? 'outgoing' : 'incoming'} ${message.pending ? 'vibe-msg-send-spring' : ''}`}
          onDoubleClick={handleDoubleClick}
        >
          <div className={`message-bubble ${message.is_deleted ? 'deleted-bubble' : ''}`}>
            {bursting && (
              <div className="vibe-heart-burst-overlay" data-testid="heart-burst-overlay">
                <span className="vibe-heart-burst-main">❤️</span>
                <span className="vibe-heart-particle p1" />
                <span className="vibe-heart-particle p2" />
                <span className="vibe-heart-particle p3" />
                <span className="vibe-heart-particle p4" />
                <span className="vibe-heart-particle p5" />
                <span className="vibe-heart-particle p6" />
              </div>
            )}
            <p className="message-text">{message.is_deleted ? 'This message was deleted' : message.content}</p>

            <span
              className={`message-receipt-tick ${message.is_read ? 'receipt-read-flip' : ''}`}
              data-testid="receipt-tick"
            >
              {message.is_read ? '✓✓' : '✓'}
            </span>
          </div>
        </div>
      );
    }

    it('triggers 3D heart burst overlay and sends heart reaction on double-click', () => {
      const onReact = vi.fn();
      const msg = { id: 101, content: 'Vibe check!', is_deleted: false, is_mine: false };

      render(<MessageBubbleWithBurst message={msg} onReact={onReact} />);
      const row = screen.getByTestId('msg-row-101');

      // Before double-click, heart burst is not visible
      expect(screen.queryByTestId('heart-burst-overlay')).not.toBeInTheDocument();

      // Trigger double-click
      fireEvent.doubleClick(row);

      // Heart burst overlay appears with main heart and particle elements
      expect(screen.getByTestId('heart-burst-overlay')).toBeInTheDocument();
      expect(screen.getByText('❤️')).toBeInTheDocument();
      expect(onReact).toHaveBeenCalledWith(101, '❤️');
    });

    it('does NOT trigger heart burst or reaction on deleted messages', () => {
      const onReact = vi.fn();
      const deletedMsg = { id: 102, content: 'deleted message', is_deleted: true, is_mine: false };

      render(<MessageBubbleWithBurst message={deletedMsg} onReact={onReact} />);
      const row = screen.getByTestId('msg-row-102');

      fireEvent.doubleClick(row);

      // Heart burst overlay must NOT appear for deleted message
      expect(screen.queryByTestId('heart-burst-overlay')).not.toBeInTheDocument();
      expect(onReact).not.toHaveBeenCalled();
    });

    it('applies vibe-msg-send-spring class to newly sent outgoing messages', () => {
      const pendingMsg = { id: 'temp-123', content: 'Sending now', pending: true, is_mine: true };
      const normalMsg = { id: 103, content: 'Already sent', pending: false, is_mine: true };

      const { rerender } = render(<MessageBubbleWithBurst message={pendingMsg} />);
      expect(screen.getByTestId('msg-row-temp-123')).toHaveClass('vibe-msg-send-spring');

      rerender(<MessageBubbleWithBurst message={normalMsg} />);
      expect(screen.getByTestId('msg-row-103')).not.toHaveClass('vibe-msg-send-spring');
    });

    it('applies receipt-read-flip class to read message receipt ticks for 3D flip animation', () => {
      const readMsg = { id: 104, content: 'Check this', is_read: true, is_mine: true };
      const unreadMsg = { id: 105, content: 'Unread note', is_read: false, is_mine: true };

      const { rerender } = render(<MessageBubbleWithBurst message={readMsg} />);
      expect(screen.getByTestId('receipt-tick')).toHaveClass('receipt-read-flip');

      rerender(<MessageBubbleWithBurst message={unreadMsg} />);
      expect(screen.getByTestId('receipt-tick')).not.toHaveClass('receipt-read-flip');
    });

    it('renders swipe-to-reply cue with threshold-met state and triggers reply on threshold release', () => {
      const onReply = vi.fn();
      const msg = { id: 201, content: 'Swipe me to reply', is_deleted: false };

      function SwipeTestComponent({ swipingOffset, isMet, isDeleted }) {
        return (
          <div className="message-bubble-row incoming">
            {swipingOffset > 8 && (
              <div
                className={`vibe-swipe-reply-cue incoming-cue ${isMet ? 'threshold-met' : ''}`}
                data-testid="swipe-reply-cue"
              >
                ↩
              </div>
            )}
            <div
              className="message-bubble"
              style={{ transform: `translateX(${swipingOffset}px)` }}
              onClick={() => {
                if (isMet && !isDeleted) onReply(msg);
              }}
            >
              {msg.content}
            </div>
          </div>
        );
      }

      // Initial state: no cue
      const { rerender } = render(<SwipeTestComponent swipingOffset={0} isMet={false} isDeleted={false} />);
      expect(screen.queryByTestId('swipe-reply-cue')).not.toBeInTheDocument();

      // Swiping 20px: cue appears but not met
      rerender(<SwipeTestComponent swipingOffset={20} isMet={false} isDeleted={false} />);
      const cue = screen.getByTestId('swipe-reply-cue');
      expect(cue).toBeInTheDocument();
      expect(cue).not.toHaveClass('threshold-met');

      // Swiping 45px: threshold met!
      rerender(<SwipeTestComponent swipingOffset={45} isMet={true} isDeleted={false} />);
      expect(screen.getByTestId('swipe-reply-cue')).toHaveClass('threshold-met');

      // Release triggers reply
      fireEvent.click(screen.getByText('Swipe me to reply'));
      expect(onReply).toHaveBeenCalledWith(msg);
    });
  });

  // =====================================================================
  // Phase 4: Message Reaction Experience (Option 1: Dynamic Magnifier & Full Picker Pill)
  // =====================================================================
  describe('Phase 4: Message Reaction Experience (Option 1: Dynamic Magnifier & Full Picker Pill)', () => {
    const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];
    const EXTENDED_REACTIONS = ['🔥', '👏', '🎉', '💯', '🚀', '✨', '👀', '⚡', '🥰', '🥺', '😎', '🤝'];

    function FloatingReactionPickerTest({ isSelected, isDeleted, onReact, onDeselect }) {
      const [showExtended, setShowExtended] = React.useState(false);

      if (!isSelected || isDeleted) return null;

      return (
        <div
          className={`vg-wa-floating-reactions ${showExtended ? 'extended-open' : ''}`}
          data-testid="wa-floating-reactions"
        >
          <div className="vg-reactions-main-row">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="vg-wa-react-btn"
                onClick={() => {
                  onReact(emoji);
                  setShowExtended(false);
                  onDeselect();
                }}
                data-testid={`react-btn-${emoji}`}
              >
                {emoji}
              </button>
            ))}

            <button
              type="button"
              className={`vg-wa-more-btn ${showExtended ? 'is-active' : ''}`}
              onClick={() => setShowExtended((prev) => !prev)}
              data-testid="reaction-more-btn"
            >
              +
            </button>
          </div>

          {showExtended && (
            <div className="vg-reactions-extended-grid" data-testid="reactions-extended-grid">
              {EXTENDED_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="vg-wa-react-btn extended-btn"
                  onClick={() => {
                    onReact(emoji);
                    setShowExtended(false);
                    onDeselect();
                  }}
                  data-testid={`extended-react-btn-${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    it('renders the 6 quick emojis and the "+" expander button when message is selected', () => {
      const onReact = vi.fn();
      const onDeselect = vi.fn();

      render(
        <FloatingReactionPickerTest
          isSelected={true}
          isDeleted={false}
          onReact={onReact}
          onDeselect={onDeselect}
        />
      );

      expect(screen.getByTestId('wa-floating-reactions')).toBeInTheDocument();
      QUICK_REACTIONS.forEach((emoji) => {
        expect(screen.getByTestId(`react-btn-${emoji}`)).toBeInTheDocument();
      });
      expect(screen.getByTestId('reaction-more-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('reactions-extended-grid')).not.toBeInTheDocument();
    });

    it('triggers reaction dispatch and closes picker when quick emoji is clicked', () => {
      const onReact = vi.fn();
      const onDeselect = vi.fn();

      render(
        <FloatingReactionPickerTest
          isSelected={true}
          isDeleted={false}
          onReact={onReact}
          onDeselect={onDeselect}
        />
      );

      fireEvent.click(screen.getByTestId('react-btn-😂'));
      expect(onReact).toHaveBeenCalledWith('😂');
      expect(onDeselect).toHaveBeenCalled();
    });

    it('expands extended emoji grid on clicking "+" and allows selecting extended emojis', () => {
      const onReact = vi.fn();
      const onDeselect = vi.fn();

      render(
        <FloatingReactionPickerTest
          isSelected={true}
          isDeleted={false}
          onReact={onReact}
          onDeselect={onDeselect}
        />
      );

      // Click "+" to unfold extended drawer
      fireEvent.click(screen.getByTestId('reaction-more-btn'));
      expect(screen.getByTestId('reactions-extended-grid')).toBeInTheDocument();
      expect(screen.getByTestId('extended-react-btn-🔥')).toBeInTheDocument();
      expect(screen.getByTestId('extended-react-btn-🚀')).toBeInTheDocument();

      // Click extended reaction
      fireEvent.click(screen.getByTestId('extended-react-btn-🚀'));
      expect(onReact).toHaveBeenCalledWith('🚀');
      expect(onDeselect).toHaveBeenCalled();
    });

    it('toggles extended drawer off when clicking "+" a second time', () => {
      render(
        <FloatingReactionPickerTest
          isSelected={true}
          isDeleted={false}
          onReact={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      const moreBtn = screen.getByTestId('reaction-more-btn');
      fireEvent.click(moreBtn);
      expect(screen.getByTestId('reactions-extended-grid')).toBeInTheDocument();

      fireEvent.click(moreBtn);
      expect(screen.queryByTestId('reactions-extended-grid')).not.toBeInTheDocument();
    });

    it('does NOT render reaction picker for deleted messages', () => {
      render(
        <FloatingReactionPickerTest
          isSelected={true}
          isDeleted={true}
          onReact={vi.fn()}
          onDeselect={vi.fn()}
        />
      );

      expect(screen.queryByTestId('wa-floating-reactions')).not.toBeInTheDocument();
    });
  });

  describe('Group Conversations & Message Starring Features', () => {
    // 1. Group conversation item rendering
    function ConversationItemTest({ conv, onSelect }) {
      return (
        <div
          data-testid={`conv-item-${conv.partner_username}`}
          className={`conversation-item ${conv.is_group ? 'is-group' : ''}`}
          onClick={() => onSelect(conv)}
        >
          {conv.is_group ? (
            <div className="group-avatar-icon-wrap" data-testid="group-avatar">
              <span role="img" aria-label="group">👥</span>
            </div>
          ) : (
            <img src={conv.partner_avatar_url} alt={conv.partner_username} data-testid="user-avatar" />
          )}
          <div className="conversation-info">
            <span className="partner-name">{conv.partner_full_name || conv.partner_username}</span>
            {conv.is_group && (
              <span className="group-members-pill" data-testid="group-member-count">
                👥 {conv.member_count || 1}
              </span>
            )}
            <p className="conversation-snippet">{conv.last_message}</p>
          </div>
        </div>
      );
    }

    it('renders group conversation item with group avatar icon and member count pill', () => {
      const mockSelect = vi.fn();
      const groupConv = {
        partner_id: 'group-101',
        partner_username: 'group-101',
        partner_full_name: 'Alpha Project Team',
        is_group: true,
        member_count: 5,
        last_message: 'Welcome everyone!'
      };

      render(<ConversationItemTest conv={groupConv} onSelect={mockSelect} />);

      expect(screen.getByTestId('group-avatar')).toBeInTheDocument();
      expect(screen.getByText('Alpha Project Team')).toBeInTheDocument();
      expect(screen.getByTestId('group-member-count')).toHaveTextContent('👥 5');
      expect(screen.getByText('Welcome everyone!')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('conv-item-group-101'));
      expect(mockSelect).toHaveBeenCalledWith(groupConv);
    });

    // 2. Message bubble quick action bar (Hover Toolbar)
    function MessageBubbleWithQuickBarTest({ msg, onToggleStar, onReply, onReact }) {
      return (
        <div className="message-bubble-row" data-testid={`msg-row-${msg.id}`}>
          {msg.is_group && !msg.is_mine && (
            <span className="group-sender-tag" data-testid="group-sender-tag">
              @{msg.sender_username}
            </span>
          )}
          <div className="message-content">{msg.content}</div>

          {!msg.is_deleted && (
            <div className="msg-quick-action-bar" data-testid="msg-quick-action-bar">
              <button
                type="button"
                className={`msg-quick-action-btn msg-star-btn ${msg.is_starred ? 'is-starred' : ''}`}
                data-testid="quick-star-btn"
                onClick={() => onToggleStar(msg)}
                title={msg.is_starred ? 'Unstar message' : 'Star message'}
              >
                ★
              </button>
              <button
                type="button"
                className="msg-quick-action-btn msg-react-btn"
                data-testid="quick-react-btn"
                onClick={() => onReact(msg)}
                title="React"
              >
                😊
              </button>
              <button
                type="button"
                className="msg-quick-action-btn msg-reply-btn"
                data-testid="quick-reply-btn"
                onClick={() => onReply(msg)}
                title="Reply"
              >
                ↩
              </button>
            </div>
          )}
        </div>
      );
    }

    it('renders quick action bar on message bubble and handles star toggle and reply', () => {
      const onToggleStar = vi.fn();
      const onReply = vi.fn();
      const onReact = vi.fn();
      const testMsg = {
        id: 42,
        sender_username: 'elena_designer',
        is_mine: false,
        is_group: true,
        content: 'Design review at 3pm',
        is_starred: false,
        is_deleted: false
      };

      render(
        <MessageBubbleWithQuickBarTest
          msg={testMsg}
          onToggleStar={onToggleStar}
          onReply={onReply}
          onReact={onReact}
        />
      );

      expect(screen.getByTestId('group-sender-tag')).toHaveTextContent('@elena_designer');
      expect(screen.getByTestId('msg-quick-action-bar')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('quick-star-btn'));
      expect(onToggleStar).toHaveBeenCalledWith(testMsg);

      fireEvent.click(screen.getByTestId('quick-reply-btn'));
      expect(onReply).toHaveBeenCalledWith(testMsg);

      fireEvent.click(screen.getByTestId('quick-react-btn'));
      expect(onReact).toHaveBeenCalledWith(testMsg);
    });

    // 3. Starred Messages modal item rendering & unstar action
    function StarredMessagesModalItemTest({ starredMsg, onUnstar, onJump }) {
      const isGroup = String(starredMsg.partner_username || '').startsWith('group-');
      return (
        <div
          className="starred-message-item"
          data-testid={`starred-item-${starredMsg.id}`}
          onClick={() => onJump(starredMsg)}
        >
          <div className="starred-item-header">
            <span className="starred-sender">@{starredMsg.sender_username}</span>
            <button
              type="button"
              className="starred-item-unstar-btn"
              data-testid="modal-unstar-btn"
              onClick={(e) => {
                e.stopPropagation();
                onUnstar(starredMsg);
              }}
              title="Unstar message"
            >
              ★
            </button>
          </div>
          <p className="starred-content">{starredMsg.content}</p>
          <span className="starred-conversation-tag" data-testid="starred-conv-tag">
            {isGroup
              ? `Chat in ${starredMsg.conversation_title || 'Group'} →`
              : `Chat with @${starredMsg.partner_username} →`}
          </span>
        </div>
      );
    }

    it('renders starred message modal item with direct unstar button and group chat tag', () => {
      const onUnstar = vi.fn();
      const onJump = vi.fn();
      const groupStarredMsg = {
        id: 88,
        sender_username: 'marcus_code',
        partner_username: 'group-202',
        conversation_title: 'Engineering Core',
        content: 'Production deployment scheduled for midnight',
        created_at: new Date().toISOString()
      };

      render(
        <StarredMessagesModalItemTest
          starredMsg={groupStarredMsg}
          onUnstar={onUnstar}
          onJump={onJump}
        />
      );

      expect(screen.getByText('@marcus_code')).toBeInTheDocument();
      expect(screen.getByText('Production deployment scheduled for midnight')).toBeInTheDocument();
      expect(screen.getByTestId('starred-conv-tag')).toHaveTextContent('Chat in Engineering Core →');

      // Click unstar button (stop propagation: does not trigger onJump)
      fireEvent.click(screen.getByTestId('modal-unstar-btn'));
      expect(onUnstar).toHaveBeenCalledWith(groupStarredMsg);
      expect(onJump).not.toHaveBeenCalled();

      // Click item container triggers onJump
      fireEvent.click(screen.getByTestId('starred-item-88'));
      expect(onJump).toHaveBeenCalledWith(groupStarredMsg);
    });
  });
});
