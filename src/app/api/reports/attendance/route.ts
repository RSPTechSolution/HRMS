import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { attendanceCsvResponse } from "@/server/attendance/report";

export async function GET(request: NextRequest): Promise<Response> {
  return attendanceCsvResponse(await getCurrentUser(), request.nextUrl.searchParams.get("month"));
}
