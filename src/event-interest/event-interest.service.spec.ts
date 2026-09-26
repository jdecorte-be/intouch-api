import { NotFoundException } from '@nestjs/common';

import { EventInterestService } from './event-interest.service';

jest.mock('../events/event-catalog.const', () => ({
  staticEvents: [{ id: 'static-1', title: 'Static Event', going: 10 }],
}));

describe('EventInterestService', () => {
  const eventFindUnique = jest.fn();
  const eventUpdate = jest.fn();
  const eventUpdateMany = jest.fn();
  const interestFindUnique = jest.fn();
  const interestCount = jest.fn();
  const interestCreate = jest.fn();
  const interestDelete = jest.fn();
  const transaction = jest.fn();
  const findEventItem = jest.fn();
  const notify = jest.fn();

  const service = new EventInterestService(
    {
      event: {
        findUnique: eventFindUnique,
        update: eventUpdate,
        updateMany: eventUpdateMany,
      },
      eventInterest: {
        findUnique: interestFindUnique,
        count: interestCount,
        create: interestCreate,
        delete: interestDelete,
      },
      $transaction: transaction,
    } as never,
    { findEventItem } as never,
    { create: notify } as never,
  );

  beforeEach(() => {
    [
      eventFindUnique,
      eventUpdate,
      eventUpdateMany,
      interestFindUnique,
      interestCount,
      interestCreate,
      interestDelete,
      transaction,
      findEventItem,
      notify,
    ].forEach((mock) => mock.mockReset());
    interestCount.mockResolvedValue(0);
    transaction.mockResolvedValue([]);
  });

  describe('getEventInterestView', () => {
    it('uses the hosted event count and the viewer interest', async () => {
      eventFindUnique.mockResolvedValue({ going: 7 });
      interestFindUnique.mockResolvedValue({ id: 'i1' });

      await expect(
        service.getEventInterestView('hosted-1', 'u1'),
      ).resolves.toEqual({ going: 7, isInterested: true });
    });

    it('is not interested and skips the lookup for anonymous viewers', async () => {
      eventFindUnique.mockResolvedValue({ going: 2 });

      await expect(service.getEventInterestView('hosted-1')).resolves.toEqual({
        going: 2,
        isInterested: false,
      });
      expect(interestFindUnique).not.toHaveBeenCalled();
    });

    it('adds stored interests to a static event baseline', async () => {
      eventFindUnique.mockResolvedValue(null);
      interestCount.mockResolvedValue(3);

      const view = await service.getEventInterestView('static-1');
      expect(view.going).toBe(13);
    });

    it('returns zero for an unknown event', async () => {
      eventFindUnique.mockResolvedValue(null);
      await expect(service.getEventInterestView('nope')).resolves.toEqual({
        going: 0,
        isInterested: false,
      });
    });
  });

  describe('toggleEventInterest', () => {
    it('throws NotFound for a missing event', async () => {
      findEventItem.mockResolvedValue(null);
      await expect(
        service.toggleEventInterest('nope', 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does nothing when the host toggles their own event', async () => {
      findEventItem.mockResolvedValue({ title: 'Mine' });
      interestFindUnique.mockResolvedValue(null);
      eventFindUnique.mockResolvedValue({ id: 'e1', hostId: 'u1', going: 4 });

      await service.toggleEventInterest('e1', 'u1');

      expect(transaction).not.toHaveBeenCalled();
      expect(interestCreate).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });

    it('adds interest to a hosted event and notifies the host', async () => {
      findEventItem.mockResolvedValue({ title: 'Party' });
      interestFindUnique.mockResolvedValue(null);
      eventFindUnique.mockResolvedValue({ id: 'e1', hostId: 'host', going: 0 });

      await service.toggleEventInterest('e1', 'u1');

      expect(interestCreate).toHaveBeenCalledWith({
        data: { eventId: 'e1', userId: 'u1' },
      });
      expect(eventUpdate).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { going: { increment: 1 } },
      });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'host',
          actorId: 'u1',
          kind: 'like',
          eventId: 'e1',
          title: 'Liked Party',
        }),
      );
    });

    it('removes interest from a hosted event and decrements safely', async () => {
      findEventItem.mockResolvedValue({ title: 'Party' });
      interestFindUnique.mockResolvedValue({ id: 'i1' });
      eventFindUnique.mockResolvedValue({ id: 'e1', hostId: 'host', going: 1 });

      await service.toggleEventInterest('e1', 'u1');

      expect(interestDelete).toHaveBeenCalledWith({ where: { id: 'i1' } });
      expect(eventUpdateMany).toHaveBeenCalledWith({
        where: { id: 'e1', going: { gt: 0 } },
        data: { going: { decrement: 1 } },
      });
      expect(notify).not.toHaveBeenCalled();
    });

    it('toggles a static event without a transaction or notification', async () => {
      const id = 'static-1';
      findEventItem.mockResolvedValue({ title: 'Static' });
      interestFindUnique.mockResolvedValue(null);
      eventFindUnique.mockResolvedValue(null);

      await service.toggleEventInterest(id, 'u1');

      expect(interestCreate).toHaveBeenCalledWith({
        data: { eventId: id, userId: 'u1' },
      });
      expect(transaction).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    });
  });
});
