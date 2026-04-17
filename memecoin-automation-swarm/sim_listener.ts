import Redis from 'ioredis';

const sub = new Redis();

sub.subscribe('detect:classifications', (err) => {
  if (err) console.error(err);
  console.log('Subscribed to detect:classifications');
});

sub.on('message', (channel, message) => {
  console.log(`[${channel}] => ${message}`);
});

setTimeout(() => {
  console.log("Listening finished.");
  sub.quit();
  process.exit(0);
}, 3000);
