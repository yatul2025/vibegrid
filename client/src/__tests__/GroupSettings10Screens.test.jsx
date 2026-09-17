/**
 * client/src/__tests__/GroupSettings10Screens.test.jsx
 * ====================================================
 * Comprehensive unit test suite for the 10-screen VibeGrid Group Settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GroupSettingsModal from '../components/group-settings/GroupSettingsModal';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'atul_yadav', full_name: 'ATUL YADAV' }
  })
}));

describe('10-Screen VibeGrid Group Settings Suite', () => {
  const mockGroup = {
    id: 'grp-7f9a2b3c4d5e-1111-2222-333344445555',
    title: 'Test Group',
    created_by: 1,
    description: 'This is a sample group for testing VibeGrid group features.',
    members: [
      { id: 1, username: 'atul_yadav', full_name: 'ATUL YADAV', role: 'admin' },
      { id: 2, username: 'riya_singh', full_name: 'Riya Singh', role: 'admin' },
      { id: 3, username: 'sneha_verma', full_name: 'Sneha Verma', role: 'member' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockImplementation((url) => {
      if (url.includes('/members')) {
        return Promise.resolve({
          success: true,
          data: {
            conversation: {
              id: mockGroup.id,
              title: mockGroup.title,
              description: mockGroup.description,
              created_by: 1,
              created_at: new Date().toISOString(),
              invite_code: 'grp_7f9a2b3c4d5e',
              permissions: {
                allow_member_info_edit: false,
                allow_member_messages: true,
                allow_member_adds: true,
                allow_member_invites: true,
                require_admin_approval: false
              },
              ephemeral_timer_seconds: 86400
            },
            members: mockGroup.members
          }
        });
      }
      if (url.includes('/join-requests')) {
        return Promise.resolve({
          success: true,
          data: {
            requests: [
              { id: 201, user_id: 10, username: 'neha_sharma', full_name: 'Neha Sharma', time: '2m' }
            ]
          }
        });
      }
      if (url.includes('/media')) {
        return Promise.resolve({
          success: true,
          data: {
            photos: [{ id: 1, url: 'https://example.com/photo.jpg' }],
            videos: [],
            files: [{ id: 1, name: 'vibegrid-docs.pdf', size: '2.4 MB', time: '2d' }],
            links: []
          }
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });
  });

  it('Screen 1 (Overview): renders identity, quick actions, and settings cards', async () => {
    render(
      <GroupSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    expect(screen.getByText('Group Details')).toBeInTheDocument();
    expect(screen.getByText('Test Group')).toBeInTheDocument();
    expect(screen.getByText('Add Member')).toBeInTheDocument();
    expect(screen.getByText('Invite')).toBeInTheDocument();
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('Group Permissions')).toBeInTheDocument();
    expect(screen.getByText('Media & Files')).toBeInTheDocument();
    expect(screen.getByText('Pinned Messages')).toBeInTheDocument();
    expect(screen.getByText('Disappearing Messages')).toBeInTheDocument();
  });

  it('Screen 2 (Members): navigates to Members screen and shows roster', async () => {
    render(
      <GroupSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    // Click on Members card
    const membersCard = screen.getByText('Members');
    fireEvent.click(membersCard);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument();
      expect(screen.getByText('Group Owner')).toBeInTheDocument();
      expect(screen.getByText('Riya Singh')).toBeInTheDocument();
      expect(screen.getByText('Sneha Verma')).toBeInTheDocument();
    });

    // Test back button returns to overview
    const backBtn = screen.getByTitle('Back');
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText('Group Details')).toBeInTheDocument();
    });
  });

  it('Screen 3 (Permissions): navigates and updates permissions toggle', async () => {
    apiClient.put.mockResolvedValueOnce({
      success: true,
      data: { permissions: { allow_member_info_edit: true } }
    });

    render(
      <GroupSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    fireEvent.click(screen.getByText('Group Permissions'));

    await waitFor(() => {
      expect(screen.getByText('Members can:')).toBeInTheDocument();
      expect(screen.getByText('Admins can:')).toBeInTheDocument();
    });

    // Toggle "Edit group settings" switch
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/permissions'),
        expect.objectContaining({
          permissions: expect.any(Object)
        })
      );
    });
  });

  it('Screen 4 (Invite & Share): displays QR presentation and invite link', async () => {
    render(
      <GroupSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    fireEvent.click(screen.getByText('Invite'));

    await waitFor(() => {
      expect(screen.getByText('Scan to join this group')).toBeInTheDocument();
      expect(screen.getByText('Copy Link')).toBeInTheDocument();
      expect(screen.getByText('Share Link')).toBeInTheDocument();
      expect(screen.getByText('Regenerate Link')).toBeInTheDocument();
    });
  });

  it('Screen 8 (Join Requests): displays requests and approves requester', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      data: { requestId: 201, action: 'approve' }
    });

    render(
      <GroupSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    // Wait for requests to load
    await waitFor(() => {
      expect(screen.getByText('Join Requests')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Join Requests'));

    await waitFor(() => {
      expect(screen.getByText('Neha Sharma')).toBeInTheDocument();
      expect(screen.getByText('Approve')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/join-requests/201/review'),
        { action: 'approve' }
      );
    });
  });

  it('Screen 10 (Disappearing Messages): renders options and changes timer', async () => {
    apiClient.put.mockResolvedValueOnce({
      success: true,
      data: { timerSeconds: 604800 }
    });

    render(
      <GroupSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    fireEvent.click(screen.getByText('Disappearing Messages'));

    await waitFor(() => {
      expect(screen.getByText('7 days')).toBeInTheDocument();
      expect(screen.getByText('30 days')).toBeInTheDocument();
    });

    // Click 7 days option
    fireEvent.click(screen.getByText('7 days'));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/ephemeral'),
        { timerSeconds: 604800 }
      );
    });
  });
});
