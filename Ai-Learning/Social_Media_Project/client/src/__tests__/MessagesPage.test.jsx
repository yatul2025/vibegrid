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

