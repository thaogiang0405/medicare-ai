import { MockAuthRepository } from './mock-auth-repository';

describe('MockAuthRepository', () => {
  it('returns the caregiver demo identity when that role is selected', async () => {
    const repository = new MockAuthRepository();

    const user = await repository.continueAs('caregiver');

    expect(user).toMatchObject({
      displayName: 'Anh Nam',
      role: 'caregiver',
      isAuthenticated: true,
    });
  });
});
