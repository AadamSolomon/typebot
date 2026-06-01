import { ORPCError } from "@orpc/server";
import type { SessionState } from "@typebot.io/chat-session/schemas";
import type { BotMessageEvent } from "@typebot.io/events/schemas";
import { byId } from "@typebot.io/lib/utils";
import { addDummyFirstBlockToGroupIfMissing } from "../addDummyFirstBlockToGroupIfMissing";

export const executeBotMessageEvent = (
  event: BotMessageEvent & { outgoingEdgeId: string },
  { state, bubbleBlockId }: { state: SessionState; bubbleBlockId: string },
) => {
  let newSessionState: SessionState = {
    ...state,
    returnMark: { status: "pending", blockId: bubbleBlockId },
  };

  const nextEdge = newSessionState.typebotsQueue[0].typebot.edges.find(
    byId(event.outgoingEdgeId),
  );
  if (!nextEdge)
    throw new ORPCError("BAD_REQUEST", {
      message: "Bot message event doesn't have a connected edge",
    });
  const nextGroup = newSessionState.typebotsQueue[0].typebot.groups.find(
    byId(nextEdge.to.groupId),
  );
  if (!nextGroup)
    throw new ORPCError("BAD_REQUEST", {
      message: "Bot message event doesn't have a connected group",
    });
  const nextBlockIndex = nextGroup.blocks.findIndex(byId(nextEdge.to.blockId));
  const newBlockId = `virtual-${event.id}-block`;
  newSessionState = addDummyFirstBlockToGroupIfMissing(
    newBlockId,
    newSessionState,
    {
      groupId: nextGroup.id,
      index: nextBlockIndex !== -1 ? nextBlockIndex : 0,
    },
  );
  return { ...newSessionState, currentBlockId: newBlockId };
};
