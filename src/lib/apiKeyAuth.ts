import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const settings = await prisma.userSettings.findFirst({
        where: { extensionApiKey: token },
        select: { userId: true },
      });
      if (settings) return settings.userId;
    }
  }
  const session = await auth();
  return (session?.user?.id as string | undefined) ?? null;
}
