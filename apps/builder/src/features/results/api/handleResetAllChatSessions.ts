import { ORPCError } from "@orpc/server";
import { isDefined } from "@typebot.io/lib/utils";
import prisma from "@typebot.io/prisma";
import type { User } from "@typebot.io/user/schemas";
import { z } from "zod";
import { isWriteTypebotForbidden } from "@/features/typebot/helpers/isWriteTypebotForbidden";

export const resetAllChatSessionsInputSchema = z.object({
  typebotId: z.string(),
});

export const handleResetAllChatSessions = async ({
  input: { typebotId },
  context: { user },
}: {
  input: z.infer<typeof resetAllChatSessionsInputSchema>;
  context: { user: Pick<User, "id"> };
}) => {
  const typebot = await prisma.typebot.findUnique({
    where: { id: typebotId },
    select: {
      workspace: {
        select: {
          id: true,
          isSuspended: true,
          isPastDue: true,
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      },
      collaborators: {
        select: {
          userId: true,
          type: true,
        },
      },
    },
  });
  if (!typebot || (await isWriteTypebotForbidden(typebot, user)))
    throw new ORPCError("NOT_FOUND", { message: "Typebot not found" });

  const results = await prisma.result.findMany({
    where: {
      typebotId,
      lastChatSessionId: { not: null },
      isArchived: { not: true },
    },
    select: { lastChatSessionId: true },
  });

  const sessionIds = results
    .map((r) => r.lastChatSessionId)
    .filter(isDefined);

  if (sessionIds.length === 0) return { deletedCount: 0 };

  const { count } = await prisma.chatSession.deleteMany({
    where: { id: { in: sessionIds } },
  });

  return { deletedCount: count };
};
