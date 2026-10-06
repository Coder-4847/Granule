import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'granule-offline',
      apply: 'build',
      generateBundle(_options, bundle) {
        const files = Object.keys(bundle);
        const revision = createHash('sha256')
          .update(
            files
              .map(
                (name) =>
                  name + ('code' in bundle[name] ? bundle[name].code : String(bundle[name].source)),
              )
              .join(''),
          )
          .digest('hex')
          .slice(0, 16);
        const htmlRevision = createHash('sha256')
          .update(readFileSync('index.html'))
          .digest('hex')
          .slice(0, 8);
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: `
const prefix = 'granule-' + new URL(self.registration.scope).pathname + '-';
const cacheName = prefix + '${revision}-${htmlRevision}';
const files = ${JSON.stringify([...new Set([...files, 'index.html', 'favicon.svg'])])};
self.addEventListener('install', event => event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files.map(file => new URL(file, self.registration.scope).href)))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(prefix) && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then(cache => cache.match(new URL('index.html', self.registration.scope).href))));
  } else {
    event.respondWith(caches.open(cacheName).then(cache => cache.match(event.request)).then(cached => cached || fetch(event.request)));
  }
});`,
        });
      },
    },
  ],
});
