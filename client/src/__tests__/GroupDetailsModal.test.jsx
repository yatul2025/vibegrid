import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GroupDetailsModal from '../components/GroupDetailsModal';
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
    user: { id: 1, username: 'john_doe', full_name: 'John Doe' }
  })
}));

describe('GroupDetailsModal Component', () => {
  const mockGroup = {
    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    title: 'Alpha Developers',
    created_by: 1,
    members: [
      { id: 1, username: 'john_doe', full_name: 'John Doe', role: 'admin' },
      { id: 2, username: 'jane_smith', full_name: 'Jane Smith', role: 'member' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiClient.get.mockResolvedValue({
      success: true,
      data: { members: mockGroup.members }
    });
  });

  it('renders correctly when open', async () => {
    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
      />
    );

    expect(screen.getByText('Group Details')).toBeInTheDocument();
    expect(screen.getByText('Alpha Developers')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Members')).toBeInTheDocument();
      expect(screen.getByText('Group Permissions')).toBeInTheDocument();
    });
  });

  it('displays Admin badge for group admin', async () => {
    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        initialScreen="members"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('allows admin to edit and save group title', async () => {
    apiClient.put.mockResolvedValueOnce({
      success: true,
      data: { conversation: { ...mockGroup, title: 'Beta Developers' } }
    });

    const onGroupUpdated = vi.fn();

    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        onGroupUpdated={onGroupUpdated}
      />
    );

    const editBtn = screen.getByTitle('Edit group name');
    fireEvent.click(editBtn);

    const input = screen.getByDisplayValue('Alpha Developers');
    fireEvent.change(input, { target: { value: 'Beta Developers' } });

    // Save button (Check icon)
    const saveBtn = input.parentElement.querySelector('button');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        `/conversations/${mockGroup.id}`,
        { title: 'Beta Developers' }
      );
      expect(onGroupUpdated).toHaveBeenCalled();
    });
  });

  it('triggers leave group workflow', async () => {
    apiClient.post.mockResolvedValueOnce({
      success: true,
      message: 'Successfully left the group.'
    });

    const onGroupLeft = vi.fn();
    const onClose = vi.fn();

    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={onClose}
        group={mockGroup}
        onGroupLeft={onGroupLeft}
      />
    );

    const leaveBtn = screen.getByText('Leave Group');
    fireEvent.click(leaveBtn);

    const confirmBtn = screen.getByText('Confirm Leave');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(`/conversations/${mockGroup.id}/leave`);
      expect(onGroupLeft).toHaveBeenCalledWith(mockGroup.id);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('triggers delete group workflow for admin', async () => {
    apiClient.delete.mockResolvedValueOnce({
      success: true,
      message: 'Group deleted successfully.'
    });

    const onGroupDeleted = vi.fn();
    const onClose = vi.fn();

    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={onClose}
        group={mockGroup}
        onGroupDeleted={onGroupDeleted}
      />
    );

    const deleteBtn = screen.getByText('Delete Group');
    fireEvent.click(deleteBtn);

    const confirmDeleteBtn = screen.getByText('Delete Forever');
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith(`/conversations/${mockGroup.id}`);
      expect(onGroupDeleted).toHaveBeenCalledWith(mockGroup.id);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('auto-displays leave confirmation dialog when initialAction="leave"', async () => {
    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        initialAction="leave"
      />
    );

    // Leave confirmation dialog is immediately visible without clicking "Leave Group" first
    expect(screen.getByText('Leave this group?')).toBeInTheDocument();
    expect(screen.getByText('Confirm Leave')).toBeInTheDocument();
  });

  it('handles conversationId fallback when group id is absent', async () => {
    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        group={{ title: 'Fallback Group' }}
        conversationId="conv-uuid-1234"
      />
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-uuid-1234/members');
    });
  });

  it('renders members view when initialScreen="members"', async () => {
    render(
      <GroupDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        group={mockGroup}
        initialScreen="members"
      />
    );

    expect(screen.getByPlaceholderText('Search members...')).toBeInTheDocument();
  });
});
