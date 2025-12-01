import { NextResponse } from 'next/server';

let latestEvent: any = null;

export async function POST(req: Request) {
  const body = await req.json();
  latestEvent = body;
  console.log("🔮 Helius Webhook Event:", body);
  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ ok: true });
}

// Export for the other route to access
export function getLatestHeliusEvent() {
  return latestEvent;
}
