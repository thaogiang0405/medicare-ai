/* eslint-disable import/first */

jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));
jest.mock('@/services/firebase', () => ({ getFirebaseAuth: () => ({ currentUser: { uid: 'elderly-123' } }) }));
jest.mock('../data/family-link-repository', () => ({
  listOwnCaregiverLinks: jest.fn(),
  approveCaregiverLink: jest.fn(),
  revokeCaregiverLink: jest.fn(),
  validateFamilyUid: (s: string) => {
    if (!/^[a-z\d-]{6,}$/i.test(s.trim())) throw new Error('Mã không hợp lệ');
    return s.trim();
  },
}));
jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View, Pressable, TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    SecondaryButton: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress, disabled }, React.createElement(Text, null, label)),
    TextField: ({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) =>
      React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText }),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useSessionStore } from '@/store';
import { approveCaregiverLink, listOwnCaregiverLinks, revokeCaregiverLink } from '../data/family-link-repository';
import { FamilyLinkOwnerPanel } from './FamilyLinkOwnerPanel';

const session = { user: { id: 'elderly-123', role: 'elderly' as const } };

describe('owner-driven Family Care approval/revocation UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    session.user.id = 'elderly-123';
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([]);
    jest.mocked(approveCaregiverLink).mockResolvedValue(undefined);
    jest.mocked(revokeCaregiverLink).mockResolvedValue(undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); });


  it('does not show the previous elderly owner links while a different owner is loading', async () => {
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([
      { caregiverUid: 'caregiver-123', status: 'active', revision: 1 },
    ]);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    expect(await view.findByText('Mã người chăm sóc: caregiver-123')).toBeTruthy();

    session.user.id = 'elderly-456';
    jest.mocked(listOwnCaregiverLinks).mockImplementation(
      () => new Promise<Awaited<ReturnType<typeof listOwnCaregiverLinks>>>(() => undefined),
    );
    await view.rerender(<FamilyLinkOwnerPanel ownerUid="elderly-456" />);

    expect(view.queryByText('Mã người chăm sóc: caregiver-123')).toBeNull();
    expect(view.getByText('Danh sách liên kết chưa được tải.')).toBeTruthy();
  });

  it('ignores a slow old grant-list response after a newer revocation refresh', async () => {
    let resolveInitial: ((value: Awaited<ReturnType<typeof listOwnCaregiverLinks>>) => void) | undefined;
    let resolveLatest: ((value: Awaited<ReturnType<typeof listOwnCaregiverLinks>>) => void) | undefined;
    jest.mocked(listOwnCaregiverLinks)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveInitial = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveLatest = resolve; }));
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    await fireEvent.press(view.getByLabelText('Tải lại danh sách liên kết'));
    await act(async () => {
      resolveLatest?.([{ caregiverUid: 'caregiver-123', status: 'revoked', revision: 2 }]);
    });
    expect(view.getByText('Đã thu hồi quyền')).toBeTruthy();
    expect(view.queryByLabelText('Thu hồi quyền của caregiver-123')).toBeNull();

    await act(async () => {
      resolveInitial?.([{ caregiverUid: 'caregiver-123', status: 'active', revision: 1 }]);
    });
    expect(view.getByText('Đã thu hồi quyền')).toBeTruthy();
    expect(view.queryByLabelText('Thu hồi quyền của caregiver-123')).toBeNull();
  });

  it('never writes a link until the owner confirms the separate consent dialog', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    expect(view.getByText('Phạm vi quyền xem')).toBeTruthy();
    expect(view.getByText(/ĐANG HOẠT ĐỘNG/)).toBeTruthy();
    expect(view.getByText(/lịch sử uống thuốc/)).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Mã tài khoản người chăm sóc'), 'caregiver-123');
    await fireEvent.press(view.getByLabelText('Xem và xác nhận cấp quyền'));
    expect(alert).toHaveBeenCalledWith('Đồng ý cấp quyền xem?', expect.any(String), expect.any(Array));
    expect(approveCaregiverLink).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((button) => button.text === 'Tôi đồng ý cấp quyền')?.onPress?.();
      await Promise.resolve();
    });
    expect(approveCaregiverLink).toHaveBeenCalledWith('elderly-123', 'caregiver-123');
  });

  it('asks a separate confirmation before permanently revoking a caregiver link', async () => {
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([{ caregiverUid: 'caregiver-123', status: 'active', revision: 1 }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
    const button = await view.findByLabelText('Thu hồi quyền của caregiver-123');
    await fireEvent.press(button);
    expect(revokeCaregiverLink).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.find((b) => b.text === 'Thu hồi quyền')?.onPress?.();
      await Promise.resolve();
    });
    expect(revokeCaregiverLink).toHaveBeenCalledWith('elderly-123', 'caregiver-123');
  });
});
