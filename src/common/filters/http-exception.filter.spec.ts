import {
  BadRequestException,
  HttpException,
  NotFoundException,
  type ArgumentsHost,
} from '@nestjs/common';

import { HttpExceptionFilter } from './http-exception.filter';

function makeHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({ status }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps HttpException with a string message to { error }', async () => {
    const { host, status, json } = makeHost();
    await filter.catch(new NotFoundException('Event not found'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ error: 'Event not found' });
  });

  it('joins validation message arrays and exposes details', async () => {
    const { host, status, json } = makeHost();
    await filter.catch(new BadRequestException(['a is bad', 'b is bad']), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: 'a is bad, b is bad',
      details: ['a is bad', 'b is bad'],
    });
  });

  it('falls back to the exception message when the body has none', async () => {
    const { host, json } = makeHost();
    await filter.catch(new HttpException({ foo: 1 }, 418), host);
    expect(json).toHaveBeenCalledWith({ error: 'Http Exception' });
  });

  it('hides unknown errors behind a generic 500', async () => {
    const { host, status, json } = makeHost();
    jest
      .spyOn(
        (filter as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);
    await filter.catch(new Error('db password leaked'), host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });
});
