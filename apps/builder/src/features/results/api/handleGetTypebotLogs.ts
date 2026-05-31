import { ORPCError } from "@orpc/server";
import prisma from "@typebot.io/prisma";
import { isReadTypebotForbidden } from "@typebot.io/typebot/helpers/isReadTypebotForbidden";
import type { User } from "@typebot.io/user/schemas";
import { z } from "zod";

export const getTypebotLogsInputSchema = z.object({
  typebotId: z.string(),
  since: z.string().datetime().optional(),
});

export const handleGetTypebotLogs = async ({
  input: { typebotId, since },
  context: { user },
}: {
  input: z.infer<typeof getTypebotLogsInputSchema>;
  context: { user: Pick<User, "id" | "email"> };
}) => {
  const typebot = await prisma.typebot.findUnique({
    where: { id: typebotId },
    select: {
      id: true,
      workspace: {
        select: {
          isSuspended: true,
          isPastDue: true,
          members: { select: { userId: true } },
        },
      },
      collaborators: {
        select: { userId: true, type: true },
      },
    },
  });

  if (!typebot || (await isReadTypebotForbidden(typebot, user)))
    throw new ORPCError("NOT_FOUND", { message: "Typebot not found" });

  const logs = await prisma.log.findMany({
    where: {
      result: { typebotId },
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return { logs };
};
