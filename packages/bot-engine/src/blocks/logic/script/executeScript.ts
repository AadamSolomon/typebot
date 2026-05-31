import { defaultScriptOptions } from "@typebot.io/blocks-logic/script/constants";
import type { ScriptBlock } from "@typebot.io/blocks-logic/script/schema";
import type { SessionState } from "@typebot.io/chat-session/schemas";
import type { SessionStore } from "@typebot.io/runtime-session-store";
import { executeFunction } from "@typebot.io/variables/executeFunction";
import { parseGuessedValueType } from "@typebot.io/variables/parseGuessedValueType";
import { parseVariables } from "@typebot.io/variables/parseVariables";
import type { Variable } from "@typebot.io/variables/schemas";
import type { ExecuteLogicResponse } from "../../../types";
import { updateVariablesInSession } from "../../../updateVariablesInSession";

export const executeScript = async (
  block: ScriptBlock,
  {
    state,
    sessionStore,
  }: {
    state: SessionState;
    sessionStore: SessionStore;
  },
): Promise<ExecuteLogicResponse> => {
  const { variables } = state.typebotsQueue[0].typebot;
  if (!block.options?.content) return { outgoingEdgeId: block.outgoingEdgeId };

  const isExecutedOnClient =
    block.options.isExecutedOnClient ?? defaultScriptOptions.isExecutedOnClient;

  if (!isExecutedOnClient) {
    const { newVariables, error, logs: functionLogs } = await executeFunction({
      variables,
      body: block.options.content,
      sessionStore,
    });

    const updateVarResults = newVariables
      ? updateVariablesInSession({
          newVariables,
          state,
          currentBlockId: block.id,
        })
      : undefined;

    let newSessionState = state;

    if (updateVarResults) {
      newSessionState = updateVarResults.updatedState;
    }

    return {
      outgoingEdgeId: block.outgoingEdgeId,
      logs: [...(functionLogs ?? []), ...(error ? [error] : [])],
      newSessionState,
      newSetVariableHistory: updateVarResults?.newSetVariableHistory,
    };
  }

  const scriptToExecute = parseScriptToExecuteClientSideAction(
    variables,
    block.options.content,
    sessionStore,
  );

  const usesSetVariable = block.options.content.includes("setVariable(");

  return {
    outgoingEdgeId: block.outgoingEdgeId,
    clientSideActions: [
      {
        type: "scriptToExecute",
        scriptToExecute: {
          ...scriptToExecute,
          isUnsafe: block.options.isUnsafe,
        },
        ...(usesSetVariable ? { expectsDedicatedReply: true } : {}),
      },
    ],
  };
};

export const parseScriptToExecuteClientSideAction = (
  variables: Variable[],
  contentToEvaluate: string,
  sessionStore: SessionStore,
) => {
  const content = parseVariables(contentToEvaluate, {
    variables,
    sessionStore,
    fieldToParse: "id",
  });
  const args = variables.map((variable) => ({
    id: variable.id,
    name: variable.name,
    value: parseGuessedValueType(variable.value),
  }));
  return {
    content,
    args,
  };
};
