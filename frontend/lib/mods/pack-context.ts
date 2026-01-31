import type { NextRequest } from 'next/server';

export function getActivePackId(request: NextRequest): string | null {
  const cookie = request.cookies.get('wushen_active_pack');
  return cookie?.value ?? null;
}
