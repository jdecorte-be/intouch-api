import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes to salt:key without exposing the password', async () => {
    const hash = await service.hash('hunter2');
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(hash).not.toContain('hunter2');
  });

  it('uses a fresh salt each time', async () => {
    expect(await service.hash('pw')).not.toBe(await service.hash('pw'));
  });

  it('verifies the correct password', async () => {
    const hash = await service.hash('correct horse');
    await expect(service.verify('correct horse', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct horse');
    await expect(service.verify('wrong', hash)).resolves.toBe(false);
  });

  it.each(['', 'nocolon', ':abc', 'abc:'])(
    'rejects malformed hash %j',
    async (bad) => {
      await expect(service.verify('pw', bad)).resolves.toBe(false);
    },
  );
});
