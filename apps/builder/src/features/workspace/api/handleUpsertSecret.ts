import { ORPCError } from "@orpc/server";
import { encrypt } from "@typebot.io/credentials/encrypt";
import prisma from "@typebot.io/prisma";
import type { User } from "@typebot.io/user/schemas";
import { z } from "zod";
import { getUserModeInWorkspace } from "@/features/workspace/helpers/getUserRoleInWorkspace";

export const upsertSecretInputSchema = z.object({
  workspaceId: z.string(),
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
      message:
        "Name must start with a letter or underscore and contain only letters, numbers, or underscores",
    }),
  value: z.string().min(1),
});

export const handleUpsertSecret = async ({
  input: { workspaceId, name, value },
  context: { user },
}: {
  input: z.infer<typeof upsertSecretInputSchema>;
  context: { user: Pick<User, "id"> };
}) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { members: true },
  });
  const userRole = getUserModeInWorkspace(user.id, workspace?.members);
  if (userRole !== "write" || !workspace)
    throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });

  const { encryptedData, iv } = await encrypt({ value });

  const existing = await prisma.credentials.findFirst({
    where: { workspaceId, name, type: "secret" },
    select: { id: true },
  });

  const secret = existing
    ? await prisma.credentials.update({
        where: { id: existing.id },
        data: { data: encryptedData, iv },
        select: { id: true, name: true, createdAt: true },
      })
    : await prisma.credentials.create({
        data: { workspaceId, name, type: "secret", data: encryptedData, iv },
        select: { id: true, name: true, createdAt: true },
      });

  return { secret };
};
