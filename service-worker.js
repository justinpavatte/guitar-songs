const APP_CACHE = "song-reference-app-v2";
const PDF_CACHE = "song-reference-pdfs-v1";
const API_CACHE = "song-reference-api-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=4"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith("song-reference-app-") &&
            key !== APP_CACHE
          )
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.origin === self.location.origin && url.pathname.toLowerCase().endsWith(".pdf")) {
    event.respondWith(handlePdfRequest(request));
    return;
  }

  if (url.hostname === "api.github.com") {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, APP_CACHE));
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function handlePdfRequest(request) {
  const cache = await caches.open(PDF_CACHE);
  let response = await cache.match(request.url);

  if (!response) {
    response = await fetch(new Request(request.url, { cache: "no-store" }));

    if (response.ok && response.status === 200) {
      await cache.put(request.url, response.clone());
    }
  }

  const rangeHeader = request.headers.get("range");

  if (!rangeHeader || !response || response.status !== 200) {
    return response;
  }

  return createRangeResponse(response, rangeHeader);
}

async function createRangeResponse(response, rangeHeader) {
  const buffer = await response.arrayBuffer();
  const size = buffer.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader);

  if (!match) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`
      }
    });
  }

  let start;
  let end;

  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`
      }
    });
  }

  end = Math.min(end, size - 1);
  const chunk = buffer.slice(start, end + 1);
  const headers = new Headers(response.headers);

  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(chunk.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}
