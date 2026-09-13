/**
 * client/src/utils/textFormatters.jsx
 * ===================================
 * Text Formatting Helper for Hashtags (#) and Mentions (@)
 * 
 * Parses raw text and converts #hashtags and @mentions into
 * interactive, clickable React elements.
 */

import React from 'react';

/**
 * Format caption or comment text with clickable hashtags & mentions
 * @param {string} text - Raw caption or comment string
 * @param {Function} onHashtagClick - Callback when #hashtag is clicked (receives tag name without #)
 * @param {Function} onUsernameClick - Callback when @username is clicked (receives username without @)
 * @returns {React.ReactNode}
 */
export function formatCaptionWithHashtags(text, onHashtagClick, onUsernameClick) {
  if (!text) return null;

  // Regex splitting by hashtags or mentions while keeping delimiters
  const regex = /([#@][a-zA-Z0-9_]+)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.startsWith('#') && part.length > 1) {
      const tag = part.slice(1).toLowerCase();
      return (
        <span
          key={index}
          className="hashtag-link"
          onClick={(e) => {
            e.stopPropagation();
            if (onHashtagClick) onHashtagClick(tag);
          }}
          title={`View posts tagged with #${tag}`}
          role="button"
          tabIndex={0}
        >
          {part}
        </span>
      );
    } else if (part.startsWith('@') && part.length > 1) {
      const username = part.slice(1).toLowerCase();
      return (
        <span
          key={index}
          className="mention-link"
          onClick={(e) => {
            e.stopPropagation();
            if (onUsernameClick) onUsernameClick(username);
          }}
          title={`View @${username}'s profile`}
          role="button"
          tabIndex={0}
        >
          {part}
        </span>
      );
    }

    return part;
  });
}
