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
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.mocked(listOwnCaregiverLinks).mockResolvedValue([]);
    jest.mocked(approveCaregiverLink).mockResolvedValue(undefined);
    jest.mocked(revokeCaregiverLink).mockResolvedValue(undefined);
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('never writes a link until the owner confirms the separate consent dialog', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const view = await render(<FamilyLinkOwnerPanel ownerUid="elderly-123" />);
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
