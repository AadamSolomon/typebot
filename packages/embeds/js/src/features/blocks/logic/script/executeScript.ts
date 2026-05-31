import type { ScriptToExecute } from "@typebot.io/chat-api/clientSideAction";
import { parseUnknownClientError } from "@typebot.io/lib/parseUnknownClientError";
import type { LogInSession } from "@typebot.io/logs/schemas";
import type { ClientSideActionContext } from "../../../../types";
import { runUserCodeInWorker } from "./scriptRunner";

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

const formatLogArg = (arg: unknown): string => {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg !== "object") return String(arg);
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

const makeConsoleProxy = (collectedLogs: LogInSession[]) => ({
  log: (...args: unknown[]) => {
    console.log(...args);
    collectedLogs.push({
      status: "info",
      description: args.map(formatLogArg).join(" "),
      context: "Script",
    });
  },
});

export const executeScript = async (
  { content, args, isUnsafe }: ScriptToExecute,
  { isPreview }: Pick<ClientSideActionContext, "isPreview">,
) => {
  const collectedLogs: LogInSession[] = [];
  const variableUpdates: { name: string; value: unknown }[] = [];

  // varMap backs _vars (a Proxy). Using a Proxy ensures every _vars["name"]
  // read is always live — it delegates to varMap.get() at the moment of access,
  // so reads that happen after setVariable() see the updated value immediately.
  const varMap = new Map<string, unknown>();
  const nameToId = new Map<string, string>();
  for (const arg of args) {
    varMap.set(arg.id, arg.value);
    if (arg.name) {
      varMap.set(arg.name, arg.value);
      nameToId.set(arg.name, arg.id);
    }
  }

  const _vars = new Proxy({} as Record<string, unknown>, {
    get(_t, prop) {
      return typeof prop === "string" ? varMap.get(prop) : undefined;
    },
    set(_t, prop, value) {
      if (typeof prop === "string") varMap.set(prop, value);
      return true;
    },
  });

  const setVariable = (name: string, value: unknown) => {
    variableUpdates.push({ name, value });
    varMap.set(name, value);
    const id = nameToId.get(name);
    if (id !== undefined) varMap.set(id, value);
  };

  const getVariable = (name: string) => varMap.get(name);

  try {
    const code = unwrapScriptTag(content);
    if (isPreview && isUnsafe) {
      const argsRecord = Object.fromEntries(args.map((a) => [a.id, a.value]));
      const { value: result, logs: workerLogs, variableUpdates: workerVarUpdates } =
        await runUserCodeInWorker(code, argsRecord);
      collectedLogs.push(...workerLogs);
      variableUpdates.push(...workerVarUpdates);
      if (result && typeof result === "string") {
        return {
          scriptCallbackMessage: result,
          ...(variableUpdates.length > 0 ? { variableUpdates } : {}),
          ...(collectedLogs.length > 0 ? { logs: collectedLogs } : {}),
        };
      }
    } else {
      // Replace bare variable IDs (from {{varName}} → ID server-side transform)
      // with _vars["id"] so they go through the live Proxy.
      const transformedCode = args.reduce((acc, arg) => {
        const escaped = arg.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return acc.replace(new RegExp(`\\b${escaped}\\b`, "g"), `_vars[${JSON.stringify(arg.id)}]`);
      }, code);
      const func = AsyncFunction("_vars", "console", "setVariable", "getVariable", transformedCode);
      const result = await func(
        _vars,
        makeConsoleProxy(collectedLogs),
        setVariable,
        getVariable,
      );
      if (result && typeof result === "string") {
        return {
          scriptCallbackMessage: result,
          ...(variableUpdates.length > 0 ? { variableUpdates } : {}),
          ...(collectedLogs.length > 0 ? { logs: collectedLogs } : {}),
        };
      }
    }
    if (variableUpdates.length > 0 || collectedLogs.length > 0)
      return {
        ...(variableUpdates.length > 0 ? { variableUpdates } : {}),
        ...(collectedLogs.length > 0 ? { logs: collectedLogs } : {}),
      };
  } catch (err) {
    console.log(err);
    return {
      logs: [
        ...collectedLogs,
        await parseUnknownClientError({
          err,
          context: "While executing script",
        }),
      ],
    };
  }
};

export const executeCode = async ({
  args,
  content,
}: {
  content: string;
  args: Record<string, unknown>;
}) => {
  try {
    const func = AsyncFunction(...Object.keys(args), content);
    const result = await func(...Object.keys(args).map((key) => args[key]));
    if (result && typeof result === "string")
      return {
        scriptCallbackMessage: result,
      };
  } catch (err) {
    console.warn("Script threw an error:", err);
  }
};

const unwrapScriptTag = (content: string) => {
  if (typeof document === "undefined") return content;

  const trimmedContent = content.trim();
  if (!trimmedContent.toLowerCase().startsWith("<script")) return content;

  const template = document.createElement("template");
  template.innerHTML = trimmedContent;

  const firstElementChild = template.content.firstElementChild;
  if (firstElementChild?.tagName !== "SCRIPT") return content;

  return firstElementChild.textContent ?? content;
};
