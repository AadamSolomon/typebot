import { ORPCError } from "@orpc/server";
import prisma from "@typebot.io/prisma";
import type { User } from "@typebot.io/user/schemas";
import { z } from "zod";
import { getUserModeInWorkspace } from "@/features/workspace/helpers/getUserRoleInWorkspace";

export const deleteSecretInputSchema = z.object({
  workspaceId: z.string(),
  secretId: z.string(),
});

export const handleDeleteSecret = async ({
  input: { workspaceId, secretId },
  context: { user },
}: {
  input: z.infer<typeof deleteSecretInputSchema>;
  context: { user: Pick<User, "id"> };
}) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { members: true },
  });
  const userRole = getUserModeInWorkspace(user.id, workspace?.members);
  if (userRole !== "write" || !workspace)
    throw new ORPCError("FORBIDDEN", { message: "Insufficient permissions" });

  await prisma.credentials.delete({
    where: { id: secretId, workspaceId, type: "secret" },
  });

  return { success: true };
};
