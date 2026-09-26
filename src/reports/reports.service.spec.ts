import { ReportsService } from './reports.service';

jest.mock('../events/event-catalog.const', () => ({
  staticEvents: [{ id: 'static-1', title: 'Static Event', going: 10 }],
}));

describe('ReportsService', () => {
  const reportFindUnique = jest.fn();
  const reportFindMany = jest.fn();
  const eventFindMany = jest.fn();
  const service = new ReportsService({
    eventReport: { findUnique: reportFindUnique, findMany: reportFindMany },
    event: { findMany: eventFindMany },
  } as never);

  beforeEach(() => {
    reportFindUnique.mockReset();
    reportFindMany.mockReset();
    eventFindMany.mockReset();
  });

  describe('getOwnEventReport', () => {
    it('returns null without a viewer and skips the query', async () => {
      await expect(service.getOwnEventReport('e1')).resolves.toBeNull();
      expect(reportFindUnique).not.toHaveBeenCalled();
    });

    it('returns null when the viewer has not reported', async () => {
      reportFindUnique.mockResolvedValue(null);
      await expect(service.getOwnEventReport('e1', 'u1')).resolves.toBeNull();
      expect(reportFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId_reporterId: { eventId: 'e1', reporterId: 'u1' } },
        }),
      );
    });

    it('falls back to "other" for an unknown reason', async () => {
      reportFindUnique.mockResolvedValue({
        reason: 'legacy-reason',
        details: 'x',
        status: 'open',
      });
      await expect(service.getOwnEventReport('e1', 'u1')).resolves.toEqual({
        reason: 'other',
        details: 'x',
        status: 'open',
      });
    });
  });

  describe('getAdminEventReportsView', () => {
    const staticId = 'static-1';
    const base = {
      details: null,
      createdAt: new Date('2026-03-05T12:00:00Z'),
    };

    it('resolves titles, reporter names and status counts', async () => {
      reportFindMany.mockResolvedValue([
        {
          ...base,
          id: 'r1',
          eventId: staticId,
          reason: 'spam',
          status: 'open',
          reporter: { name: 'Jane', email: 'jane@x.com' },
        },
        {
          ...base,
          id: 'r2',
          eventId: 'hosted-1',
          reason: 'not-a-reason',
          status: 'resolved',
          reporter: { name: null, email: 'bob@x.com' },
        },
        {
          ...base,
          id: 'r3',
          eventId: 'gone',
          reason: 'spam',
          status: 'dismissed',
          reporter: { name: null, email: null },
        },
      ]);
      eventFindMany.mockResolvedValue([{ id: 'hosted-1', title: 'Hosted' }]);

      const view = await service.getAdminEventReportsView();

      expect(eventFindMany).toHaveBeenCalledWith({
        where: { id: { in: ['hosted-1', 'gone'] } },
        select: { id: true, title: true },
      });
      expect(view.reports.map((r) => r.eventTitle)).toEqual([
        'Static Event',
        'Hosted',
        'Deleted event',
      ]);
      expect(view.reports.map((r) => r.reporterName)).toEqual([
        'Jane',
        'bob@x.com',
        'Member',
      ]);
      expect(view.reports[1].reason).toBe('other');
      expect(view.reports[0].createdAt).toBe('Mar 5, 2026');
      expect([view.openCount, view.resolvedCount, view.dismissedCount]).toEqual(
        [1, 1, 1],
      );
    });

    it('skips the hosted-event lookup when only static events are reported', async () => {
      reportFindMany.mockResolvedValue([
        {
          ...base,
          id: 'r1',
          eventId: staticId,
          reason: 'spam',
          status: 'open',
          reporter: { name: 'Jane', email: null },
        },
      ]);

      await service.getAdminEventReportsView();
      expect(eventFindMany).not.toHaveBeenCalled();
    });
  });
});
