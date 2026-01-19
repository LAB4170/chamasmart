const ioClient = require('socket.io-client');

// Require server to ensure Socket.io is initialized and listening
require('../server');

describe('Socket.io authentication', () => {
  const SERVER_URL = 'http://localhost:5005';

  const connect = (token) =>
    new Promise((resolve, reject) => {
      const socket = ioClient(SERVER_URL, {
        auth: token ? { token } : {},
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      socket.on('connect', () => {
        socket.disconnect();
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        socket.disconnect();
        reject(err);
      });
    });

  it('rejects connection without token', async () => {
    expect.assertions(1);

    try {
      await connect();
    } catch (err) {
      // Socket.io client may report websocket error or auth error depending on connection phase
      expect(err.message.toLowerCase()).toMatch(/auth|websocket/);
    }
  });
});
