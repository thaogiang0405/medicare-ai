import { MockAuthRepository } from './mock-auth-repository';

describe('MockAuthRepository', () => {
  it('does not manufacture a role when signing in', async () => {
    const repository = new MockAuthRepository();

    const user = await repository.signIn({ email: 'demo@example.com', password: 'not-used' });

    expect(user).toMatchObject({
      role: null,
      isAuthenticated: true,
    });
  });
});
