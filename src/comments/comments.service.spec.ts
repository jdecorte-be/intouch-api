import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  const author = { name: 'Jane Doe', email: 'jane@x.com', image: null };
  const findMany = jest.fn();
  const service = new CommentsService({
    eventComment: { findMany },
  } as never);

  beforeEach(() => {
    findMany.mockReset();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('queries comments for the event oldest first', async () => {
    findMany.mockResolvedValue([]);
    await service.getEventCommentsView('e1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'e1' },
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('maps comments, flags own ones and counts them', async () => {
    findMany.mockResolvedValue([
      {
        id: 'c1',
        authorId: 'u1',
        text: 'hi',
        createdAt: new Date('2026-03-05T12:00:00Z'),
        author,
      },
      {
        id: 'c2',
        authorId: 'u2',
        text: 'yo',
        createdAt: new Date('2024-03-05T12:00:00Z'),
        author: { name: null, email: 'bob@x.com', image: 'img' },
      },
    ]);

    const view = await service.getEventCommentsView('e1', 'u1');

    expect(view.commentCount).toBe(2);
    expect(view.comments[0]).toMatchObject({
      id: 'c1',
      authorName: 'Jane Doe',
      authorInitials: 'JD',
      isOwn: true,
      createdAt: 'Mar 5',
    });
    expect(view.comments[1]).toMatchObject({
      authorName: 'bob@x.com',
      authorImage: 'img',
      isOwn: false,
      createdAt: 'Mar 5, 2024',
    });
  });

  it('never marks comments as own for anonymous viewers', async () => {
    findMany.mockResolvedValue([
      { id: 'c', authorId: 'u1', text: 't', createdAt: new Date(), author },
    ]);
    const view = await service.getEventCommentsView('e1');
    expect(view.comments[0].isOwn).toBe(false);
  });
});
