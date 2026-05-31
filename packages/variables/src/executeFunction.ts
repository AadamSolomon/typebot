import { env } from "@typebot.io/env";
import { parseUnknownError } from "@typebot.io/lib/parseUnknownError";
import { getSafeDispatcher } from "@typebot.io/lib/ssrf/createSafeDispatcher";
import {
  validateHttpReqHeaders,
  validateHttpReqUrl,
} from "@typebot.io/lib/ssrf/validateHttpReqUrl";
import { isDefined } from "@typebot.io/lib/utils";
import type { SessionStore } from "@typebot.io/runtime-session-store";
import { Reference } from "isolated-vm";
import { parseTransferrableValue } from "./codeRunners";
import { extractVariablesFromText } from "./extractVariablesFromText";
import { parseGuessedValueType } from "./parseGuessedValueType";
import { parseVariables } from "./parseVariables";
import type { Variable } from "./schemas";

const defaultTimeout = 10 * 1000;

type Props = {
  variables: Variable[];
  body: string;
  sessionStore: SessionStore;
  args?: Record<string, unknown>;
};

export const executeFunction = async ({
  variables,
  body,
  sessionStore,
  args: initialArgs,
}: Props) => {
  const parsedBody = parseVariables(body, {
    fieldToParse: "id",
    variables,
    sessionStore,
  });

  const args = (
    extractVariablesFromText(variables)(body).map((variable) => ({
      id: variable.id,
      value: parseGuessedValueType(variable.value),
    })) as { id: string; value: unknown }[]
  ).concat(
    initialArgs
      ? Object.entries(initialArgs).map(([id, value]) => ({ id, value }))
      : [],
  );

  const variableUpdates = new Map<string, unknown>();
  const scriptLogs: { status: "info"; description: string; context: "Script" }[] =
    [];

  const setVariable = (key: string, value: any) => {
    variableUpdates.set(key, value);
  };

  // Checks pending updates first so _vars["x"] reflects a prior setVariable("x", …)
  const getVariable = (key: string): unknown => {
    if (variableUpdates.has(key)) return variableUpdates.get(key);
    const variable = variables.find((v) => v.name === key);
    return variable ? parseGuessedValueType(variable.value) : undefined;
  };

  const consoleLog = (...args: unknown[]) => {
    scriptLogs.push({
      status: "info",
      description: args.map(formatLogArg).join(" "),
      context: "Script",
    });
  };

  const context = sessionStore.getOrCreateIsolate().createContextSync();
  const jail = context.global;
  jail.setSync("global", jail.derefInto());
  // Use applySync for all pure in-memory bridges (no async I/O) so they return
  // plain values instead of Promises. This avoids floating unhandled Promises in
  // the VM which can trigger "Promise could not be cloned" errors in isolated-vm.
  context.evalClosure(
    "globalThis.setVariable = (...args) => { $0.applySync(undefined, args, { arguments: { copy: true } }); }",
    [new Reference(setVariable)],
  );
  context.evalClosure(
    "globalThis.getVariable = (...args) => $0.applySync(undefined, args, { arguments: { copy: true }, result: { copy: true } })",
    [new Reference(getVariable)],
  );
  context.evalClosure(
    "globalThis.console = { log: (...args) => { $0.applySync(undefined, args, { arguments: { copy: true } }); } }",
    [new Reference(consoleLog)],
  );
  // _vars proxy: same API as the client-side sandbox, reads reflect setVariable updates
  context.evalClosure(
    `globalThis._vars = new Proxy({}, {
      get(_, prop) { return typeof prop === 'string' ? getVariable(prop) : undefined; },
      set(_, prop, value) { if (typeof prop === 'string') setVariable(prop, value); return true; }
    });`,
    [],
  );
  context.evalClosure(
    "globalThis.fetch = (...args) => $0.apply(undefined, args, { arguments: { copy: true }, promise: true, result: { copy: true, promise: true } })",
    [
      new Reference(async (...fetchArgs: Parameters<typeof fetch>) => {
        const [input, init] = fetchArgs;
        const request = new Request(input, init);
        const headers = {} as Record<string, string>;
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        await validateHttpReqUrl(request.url);
        validateHttpReqHeaders(headers);
        const dispatcher = getSafeDispatcher();
        const maxRedirects = 10;
        let response = await fetch(input, {
          ...init,
          redirect: "manual",
          dispatcher,
        } as RequestInit);
        let redirectCount = 0;
        while (
          response.status >= 300 &&
          response.status < 400 &&
          response.headers.has("location")
        ) {
          if (redirectCount >= maxRedirects)
            throw new Error(
              "Too many redirects while following safe fetch chain.",
            );
          const location = new URL(
            response.headers.get("location")!,
            request.url,
          ).toString();
          await validateHttpReqUrl(location);
          response = await fetch(location, {
            ...init,
            redirect: "manual",
            dispatcher,
          } as RequestInit);
          redirectCount++;
        }
        return response.text();
      }),
    ],
  );

  args.forEach(({ id, value }) => {
    jail.setSync(id, parseTransferrableValue(value));
  });
  const run = (code: string) =>
    context.evalClosure(
      `return (async function() {
		const AsyncFunction = async function () {}.constructor;
		return new AsyncFunction($0)();
	}())`,
      [code],
      { result: { copy: true, promise: true }, timeout: defaultTimeout },
    );

  try {
    const output: unknown = await run(parsedBody);
    context.release();
    return {
      output,
      newVariables: Array.from(variableUpdates.entries())
        .map(([name, value]) => {
          const existingVariable = variables.find((v) => v.name === name);
          if (!existingVariable) return;
          return {
            id: existingVariable.id,
            name: existingVariable.name,
            value,
          };
        })
        .filter(isDefined),
      logs: scriptLogs,
    };
  } catch (e) {
    context.release();
    if (env.NODE_ENV === "development") {
      console.log("Error while executing the function");
      console.error(e);
    }

    const error = await parseUnknownError({
      err: e,
      context: "While executing function",
    });

    return {
      error,
      output: error,
      logs: scriptLogs,
    };
  }
};

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
