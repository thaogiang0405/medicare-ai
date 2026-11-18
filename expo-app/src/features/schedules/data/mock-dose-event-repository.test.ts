import { MockDoseEventRepository } from './mock-dose-event-repository';

describe('MockDoseEventRepository', () => {
  it('keeps demo dose responses isolated between authenticated users', async () => {
    const repository = new MockDoseEventRepository();
    const eventsForA = await repository.getTodayEvents('elderly-a');

    await repository.recordResponse('elderly-a', eventsForA[0].id, 'reportedTaken');

    const updatedEventsForA = await repository.getTodayEvents('elderly-a');
    const eventsForB = await repository.getTodayEvents('elderly-b');

    expect(updatedEventsForA[0]).toMatchObject({ status: 'reportedTaken', respondedBy: 'elderly-a' });
    expect(eventsForB[0]).toMatchObject({ id: eventsForA[0].id, status: 'pending' });
    expect(eventsForB[0].respondedBy).toBeUndefined();
  });

  it('retains the two known demo medication IDs without creating new schedules', async () => {
    const repository = new MockDoseEventRepository();

    await expect(repository.getTodayEvents('elderly-a')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ medicationId: 'med-metformin-500' }),
        expect.objectContaining({ medicationId: 'med-amlodipine-5' }),
      ]),
    );
  });
});
