import { createConnection } from 'node:net';
import type { Mailer } from '../application/ports/outbox-ports.js';
import type { EmailMessage } from '../domain/outbox-job.js';

export class SmtpMailer implements Mailer {
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly from: string,
    private readonly timeoutMs = 5000,
  ) {}
  send(message: EmailMessage): Promise<void> {
    if (
      /[\r\n<>]/.test(message.recipient) ||
      /[\r\n<>]/.test(this.from) ||
      !/^<[^<>\s]+>$/.test(message.message_id)
    )
      return Promise.reject(new Error('Invalid SMTP envelope or Message-ID.'));
    const text =
      Buffer.from(message.text, 'utf8')
        .toString('base64')
        .match(/.{1,76}/g)
        ?.join('\r\n') ?? '';
    const payload =
      [
        'From: ' + this.from,
        'To: ' + message.recipient,
        'Message-ID: ' + message.message_id,
        'Subject: =?UTF-8?B?' +
          Buffer.from(message.subject, 'utf8').toString('base64') +
          '?=',
        'Date: ' + new Date().toUTCString(),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        text,
        '',
      ].join('\r\n') + '.\r\n';
    return new Promise<void>((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      socket.setEncoding('utf8');
      const commands = [
        'EHLO sales-ranking.local\r\n',
        'MAIL FROM:<' + this.from + '>\r\n',
        'RCPT TO:<' + message.recipient + '>\r\n',
        'DATA\r\n',
        payload,
      ];
      const expected = [220, 250, 250, 250, 354, 250];
      let stage = 0;
      let buffer = '';
      let settled = false;
      const timeout = setTimeout(
        () => finish(new Error('SMTP response timeout.')),
        this.timeoutMs,
      );
      function finish(error?: Error): void {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) {
          socket.destroy();
          reject(error);
        } else {
          socket.end('QUIT\r\n');
          resolve();
        }
      }
      socket.on('error', (error) => finish(error));
      socket.on('close', () => {
        if (!settled)
          finish(new Error('SMTP connection closed before acceptance.'));
      });
      socket.on('data', (chunk: string) => {
        buffer += chunk;
        let boundary = buffer.indexOf('\r\n');
        while (boundary >= 0 && !settled) {
          const line = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const match = /^(\d{3})([ -])/.exec(line);
          if (match === null) {
            finish(new Error('Invalid SMTP response.'));
            return;
          }
          // EHLO may have several "250-" lines; only its final "250 " advances the protocol.
          if (match[2] === ' ') {
            if (Number(match[1]) !== expected[stage]) {
              finish(new Error('SMTP rejected command with code ' + match[1]));
              return;
            }
            if (stage === 5) {
              finish();
              return;
            }
            socket.write(commands[stage]!);
            stage += 1;
          }
          boundary = buffer.indexOf('\r\n');
        }
      });
    });
  }
}
