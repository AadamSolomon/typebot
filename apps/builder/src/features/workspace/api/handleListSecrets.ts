import { ORPCError } from "@orpc/server";
import prisma from "@typebot.io/prisma";
import type { User } from "@typebot.io/user/schemas";
import { z } from "zod";
import { getUserModeInWorkspace } from "@/features/workspace/helpers/getUserRoleInWorkspace";

export const listSecretsInputSchema = z.object({
  workspaceId: z.string(),
});

export const handleListSecrets = async ({
  input: { workspaceId },
  context: { user },
}: {
  input: z.infer<typeof listSecretsInputSchema>;
  context: { user: Pick<User, "id"> };
}) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { members: true },
  });
  const userRole = getUserModeInWorkspace(user.id, workspace?.members);
  if (userRole === "guest" || !workspace)
    throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });

  const secrets = await prisma.credentials.findMany({
    where: { workspaceId, type: "secret" },
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return { secrets };
};
