import { NextResponse } from "next/server";

export function success<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function failure(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status },
  );
}
