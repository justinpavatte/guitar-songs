const APP_CACHE = "song-reference-app-v11";
const PDF_CACHE = "song-reference-pdfs-v1";
const LIST_CACHE = "song-reference-list-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=20260824-3",
  "./site.webmanifest?v=20260824-1",
  "./favicon/apple-touch-icon.png?v=20260824-1",
  "./favicon/favicon-32x32.png?v=20260824-1",
  "./favicon/favicon-16x16.png?v=20260824-1",
  "./favicon/android-chrome-192x192.png?v=20260824-1",
  "./favicon/android-chrome-512x512.png?v=20260824-1"
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
            (key.startsWith("song-reference-app-") && key !== APP_CACHE) ||
            key === "song-reference-api-v1"
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

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    event.respondWith(handlePdfRequest(request));
    return;
  }

  if (url.pathname.endsWith("/songs.php")) {
    if (url.searchParams.has("refresh")) {
      event.respondWith(refreshSongList(request));
    } else {
      event.respondWith(staleWhileRevalidate(request, LIST_CACHE, true));
    }
    return;
  }

  event.respondWith(staleWhileRevalidate(request, APP_CACHE));
});

async function staleWhileRevalidate(request, cacheName, ignoreSearch = false) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch });

  const networkUpdate = fetch(request)
    .then(async response => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const response = await networkUpdate;
  if (response) {
    return response;
  }

  throw new Error("Resource unavailable offline.");
}

async function refreshSongList(request) {
  const cache = await caches.open(LIST_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      const canonicalRequest = new Request(new URL("./songs.php", self.location.href));
      await cache.put(canonicalRequest, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match("./songs.php", { ignoreSearch: true });

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
      response = withPdfHeaders(response);
      await cache.put(request.url, response.clone());
    }
  } else {
    response = withPdfHeaders(response);
  }

  const rangeHeader = request.headers.get("range");

  if (!rangeHeader || !response || response.status !== 200) {
    return response;
  }

  return createRangeResponse(response, rangeHeader);
}

function withPdfHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", "inline");
  headers.set("Accept-Ranges", "bytes");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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

  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", "inline");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(chunk.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  return new Response(chunk, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}
