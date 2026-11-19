import { isLocalRemindersFeatureEnabled } from './local-reminder-feature';

describe('local reminder feature flag', () => {
  it('is disabled unless explicitly set to true', () => {
    expect(isLocalRemindersFeatureEnabled(undefined)).toBe(false);
    expect(isLocalRemindersFeatureEnabled('false')).toBe(false);
    expect(isLocalRemindersFeatureEnabled(' TRUE ')).toBe(true);
  });
});
