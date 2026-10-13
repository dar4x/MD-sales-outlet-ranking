import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { it } from 'node:test';
import { SmtpMailer } from '../src/notifications/infrastructure/smtp-mailer.js';
const message = {
  recipient: 'test@example.com',
  subject: 'Test',
  text: 'Text',
  message_id: '<test@sales-ranking.local>',
};
await it('rejects SMTP failures without falsely marking delivery accepted', async () => {
  const server = createServer((socket) => {
    socket.write('220 test\r\n');
    socket.on('data', () => socket.end('550 rejected\r\n'));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  try {
    await assert.rejects(
      new SmtpMailer('127.0.0.1', address.port, 'alerts@example.com').send(
        message,
      ),
      /SMTP rejected/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
await it('times out an unresponsive SMTP peer and rejects header injection', async () => {
  const server = createServer(() => {});
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  try {
    const mailer = new SmtpMailer(
      '127.0.0.1',
      address.port,
      'alerts@example.com',
      30,
    );
    await assert.rejects(mailer.send(message), /timeout/);
    await assert.rejects(
      mailer.send({ ...message, recipient: 'bad\r\nBcc: theft@example.com' }),
      /Invalid SMTP/,
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
