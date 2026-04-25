import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("u");
  if (!url || !/^https:\/\/videos\.nba\.com\//.test(url)) {
    return new NextResponse("bad url", { status: 400 });
  }

  const range = req.headers.get("range");
  const upstream = await fetch(url, {
    headers: range ? { Range: range } : {},
    cache: "no-store",
  });

  const headers = new Headers();
  for (const h of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("cache-control", "public, max-age=3600");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}
