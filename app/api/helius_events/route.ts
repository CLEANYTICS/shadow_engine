import { NextResponse } from 'next/server';
import { getLatestHeliusEvent } from '../helius/route';

export function GET() {
  const ev = getLatestHeliusEvent() || null;
  return NextResponse.json(ev);
}
