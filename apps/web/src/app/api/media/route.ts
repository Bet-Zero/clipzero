import { NextRequest } from "next/server";

const ALLOWED_HOST = "videos.nba.com";

function buildPassthroughHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  const allowed = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ];

  for (const name of allowed) {
    const value = upstream.get(name);
    if (value) headers.set(name, value);
  }

  return headers;
}

async function handle(request: NextRequest) {
  const encodedUrl = request.nextUrl.searchParams.get("url");
  if (!encodedUrl) {
    return new Response("Missing url query parameter", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(encodedUrl);
  } catch {
    return new Response("Invalid url query parameter", { status: 400 });
  }

  if (target.hostname !== ALLOWED_HOST) {
    return new Response("Unsupported media host", { status: 403 });
  }

  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  if (range) upstreamHeaders.set("range", range);

  const upstream = await fetch(target.toString(), {
    method: request.method,
    headers: upstreamHeaders,
    redirect: "follow",
  });

  const responseHeaders = buildPassthroughHeaders(upstream.headers);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function HEAD(request: NextRequest) {
  return handle(request);
}
