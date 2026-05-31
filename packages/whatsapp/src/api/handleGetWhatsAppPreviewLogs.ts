import { ORPCError } from "@orpc/server";
import { getSession } from "@typebot.io/chat-session/queries/getSession";
import { decrypt } from "@typebot.io/credentials/decrypt";
import { getCredentials } from "@typebot.io/credentials/getCredentials";
import { whatsAppCredentialsDataSchema } from "@typebot.io/credentials/schemas";
import { env } from "@typebot.io/env";
import prisma from "@typebot.io/prisma";
import { isReadTypebotForbidden } from "@typebot.io/typebot/helpers/isReadTypebotForbidden";
import type { User } from "@typebot.io/user/schemas";
import { z } from "zod";
import { WHATSAPP_PREVIEW_SESSION_ID_PREFIX } from "../constants";
import { normalizeWhatsAppPreviewPhoneNumber } from "../normalizeWhatsAppPreviewPhoneNumber";

export const getWhatsAppPreviewLogsInputSchema = z.object({
  typebotId: z.string(),
  phoneNumber: z.string().transform(normalizeWhatsAppPreviewPhoneNumber),
});

export const handleGetWhatsAppPreviewLogs = async ({
  input: { typebotId, phoneNumber },
  context: { user },
}: {
  input: z.infer<typeof getWhatsAppPreviewLogsInputSchema>;
  context: { user: Pick<User, "id" | "email"> };
}) => {
  const existingTypebot = await prisma.typebot.findFirst({
    where: { id: typebotId },
    select: {
      id: true,
      workspaceId: true,
      whatsAppCredentialsId: true,
      workspace: {
        select: {
          isSuspended: true,
          isPastDue: true,
          members: { select: { userId: true } },
        },
      },
      collaborators: { select: { userId: true } },
    },
  });

  if (
    !existingTypebot?.id ||
    (await isReadTypebotForbidden(existingTypebot, user))
  )
    throw new ORPCError("NOT_FOUND", { message: "Typebot not found" });

  const sessionId = await computePreviewSessionId({
    phoneNumber,
    typebotId: existingTypebot.id,
    workspaceId: existingTypebot.workspaceId,
    whatsAppCredentialsId: existingTypebot.whatsAppCredentialsId,
  });

  const session = await getSession(sessionId);
  const pendingLogs = session?.state?.previewMetadata?.pendingLogs;

  if (pendingLogs && pendingLogs.length > 0 && session?.state) {
    await prisma.chatSession.updateMany({
      where: { id: sessionId },
      data: {
        state: {
          ...session.state,
          previewMetadata: {
            ...session.state.previewMetadata,
            pendingLogs: [],
          },
        },
      },
    });
  }

  return { logs: pendingLogs ?? [] };
};

const computePreviewSessionId = async ({
  phoneNumber,
  workspaceId,
  whatsAppCredentialsId,
}: {
  phoneNumber: string;
  typebotId: string;
  workspaceId: string;
  whatsAppCredentialsId: string | null;
}): Promise<string> => {
  const hasPreviewEnvVars =
    !!env.WHATSAPP_PREVIEW_FROM_PHONE_NUMBER_ID &&
    !!env.META_SYSTEM_USER_TOKEN &&
    !!env.WHATSAPP_PREVIEW_TEMPLATE_NAME;

  if (hasPreviewEnvVars)
    return `${WHATSAPP_PREVIEW_SESSION_ID_PREFIX}${phoneNumber}`;

  if (whatsAppCredentialsId) {
    const dbCredentials = await getCredentials(
      whatsAppCredentialsId,
      workspaceId,
    );
    if (dbCredentials) {
      const parsed = whatsAppCredentialsDataSchema.safeParse(
        await decrypt(dbCredentials.data, dbCredentials.iv),
      );
      if (parsed.success && parsed.data.provider !== "360dialog")
        return `${WHATSAPP_PREVIEW_SESSION_ID_PREFIX}${parsed.data.phoneNumberId}-${phoneNumber}`;
    }
  }

  return `${WHATSAPP_PREVIEW_SESSION_ID_PREFIX}${phoneNumber}`;
};
