import { handleAdminSessionRequest } from "@/lib/admin-auth-handler";
import { createAdminAuthDependencies } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleAdminSessionRequest(request, await createAdminAuthDependencies());
}

export async function POST(request: Request) {
  return handleAdminSessionRequest(request, await createAdminAuthDependencies());
}

export async function DELETE(request: Request) {
  return handleAdminSessionRequest(request, await createAdminAuthDependencies());
}
