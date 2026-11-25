/* eslint-disable import/first */

jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));
jest.mock('../data/family-link-repository', () => ({
  createFamilyInvite: jest.fn(),
  listOwnCaregiverLinks: jest.fn(),
  approvePendingCaregiverLink: jest.fn(),
  rejectPendingCaregiverLink: jest.fn(),
  revokeCaregiverLink: jest.fn(),
}));
jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    SecondaryButton: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress, disabled }, React.createElement(Text, null, label)),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import { useSessionStore } from '@/store';
import {
  approvePendingCaregiverLink, createFamilyInvite, listOwnCaregiverLinks,
  rejectPendingCaregiverLink, revokeCaregiverLink,
} from '../data/family-link-repository';
import { FamilyLinkOwnerPanel } from './FamilyLinkOwnerPanel';

const session = { user: { id: 'elderly-123', displayName: 'Người cao tuổi', role: 'elderly' as const } };

describe('one-way owner-issued Family Care invitation UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    session.user.id = 'elderly-123';
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([]);
    jest.mocked(createFamilyInvite).mockResolvedValue({
      code: 'AbCdEfGhIjKlMnOpQrSt', expiresAt: new Date('2026-11-26T05:00:00.000Z'),
    });
    jest.mocked(approvePendingCaregiverLink).mockResolvedValue(undefined);
    jest.mocked(rejectPendingCaregiverLink).mockResolvedValue(undefined);
    jest.mocked(revokeCaregiverLink).mockResolvedValue(undefined);
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('creates and shares one code without asking the owner for a caregiver UID', async () => {
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    await fireEvent.press(view.getByLabelText('Tạo và chia sẻ mã kết nối'));
    expect(createFamilyInvite).toHaveBeenCalledWith('elderly-123');
    expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('AbCdEfGhIjKlMnOpQrSt'),
    }));
    expect(await view.findByText('AbCdEfGhIjKlMnOpQrSt')).toBeTruthy();
    expect(view.queryByLabelText('Mã tài khoản người chăm sóc')).toBeNull();
    expect(view.queryByLabelText('Gửi mã hồ sơ của tôi cho người chăm sóc')).toBeNull();
  });

  it('shows caregiver identity and waits for explicit owner approval', async () => {
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([{
      caregiverUid: 'caregiver-123', caregiverDisplayName: 'Nguyễn Văn B',
      inviteCode: 'AbCdEfGhIjKlMnOpQrSt', status: 'pending', revision: 1,
    }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    expect(await view.findByText('Nguyễn Văn B')).toBeTruthy();
    expect(view.getByText('Đang chờ bạn xác nhận. Chưa có quyền xem thuốc hoặc lịch.')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Đồng ý cấp quyền'));
    expect(approvePendingCaregiverLink).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('Xác nhận người chăm sóc?', expect.any(String), expect.any(Array));
    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.text === 'Tôi đồng ý cấp quyền')?.onPress?.();
      await Promise.resolve();
    });
    expect(approvePendingCaregiverLink).toHaveBeenCalledWith('elderly-123', 'caregiver-123');
  });

  it('can reject a pending request', async () => {
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([{
      caregiverUid: 'caregiver-123', caregiverDisplayName: 'Nguyễn Văn B',
      inviteCode: 'AbCdEfGhIjKlMnOpQrSt', status: 'pending', revision: 1,
    }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    await fireEvent.press(await view.findByLabelText('Từ chối yêu cầu'));
    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.text === 'Từ chối yêu cầu')?.onPress?.();
      await Promise.resolve();
    });
    expect(rejectPendingCaregiverLink).toHaveBeenCalledWith('elderly-123', 'caregiver-123');
    expect(approvePendingCaregiverLink).not.toHaveBeenCalled();
  });

  it('retains revocation for an approved caregiver', async () => {
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([{
      caregiverUid: 'caregiver-123', caregiverDisplayName: 'Nguyễn Văn B', status: 'active', revision: 2,
    }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    await fireEvent.press(await view.findByLabelText('Thu hồi quyền của caregiver-123'));
    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.text === 'Thu hồi quyền')?.onPress?.();
      await Promise.resolve();
    });
    expect(revokeCaregiverLink).toHaveBeenCalledWith('elderly-123', 'caregiver-123');
  });

  it('does not show a previous owner link while a new owner list is loading', async () => {
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([{ caregiverUid: 'caregiver-123', status: 'active', revision: 2 }]);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    expect(await view.findByText('UID: caregiver-123')).toBeTruthy();
    session.user.id = 'elderly-456';
    jest.mocked(listOwnCaregiverLinks).mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof listOwnCaregiverLinks>>>(() => undefined),
    );
    await view.rerender(<FamilyLinkOwnerPanel ownerUid="elderly-456" />);
    expect(view.queryByText('UID: caregiver-123')).toBeNull();
    expect(view.getByText('Danh sách yêu cầu chưa được tải.')).toBeTruthy();
  });
});
