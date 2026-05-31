// Inline the worker code as a string to avoid bundler issues
const workerCode = `
const AsyncFunction = Object.getPrototypeOf(async () => {})
  .constructor;

const originalFetch = self.fetch.bind(self);

// Wrap fetch to force credentials: "omit" and strip sensitive headers
async function safeFetch(
  input,
  init,
) {
  const safeInit = {
    ...(init || {}),
    credentials: "omit",
  };

  if (input instanceof Request) {
    const safeRequest = new Request(input, safeInit);
    return originalFetch(safeRequest);
  }

  return originalFetch(input, safeInit);
}

// Override global fetch BEFORE any user code runs
self.fetch = safeFetch;

// Disable other network APIs that could carry cookies automatically
self.XMLHttpRequest = () => {
  console.warn("XMLHttpRequest is disabled in preview mode.");
};

self.WebSocket = () => {
  console.warn("WebSocket is disabled in preview mode.");
};

self.EventSource = () => {
  console.warn("EventSource is disabled in preview mode.");
};

self.Worker = () => {
  console.warn("Creating nested workers is disabled in preview mode.");
};

self.SharedWorker = () => {
  console.warn("Shared workers are disabled in preview mode.");
};

const formatWorkerLogArg = (arg) => {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg !== "object") return String(arg);
  try { return JSON.stringify(arg); } catch { return String(arg); }
};

self.onmessage = async (event) => {
  const { id, code, args = {} } = event.data;
  const workerLogs = [];
  const workerVariableUpdates = [];
  const consoleProxy = {
    log: (...logArgs) => {
      console.log(...logArgs);
      workerLogs.push({
        status: "info",
        description: logArgs.map(formatWorkerLogArg).join(" "),
        context: "Script",
      });
    },
  };
  const setVariable = (name, value) => {
    workerVariableUpdates.push({ name, value });
  };

  try {
    const argNames = Object.keys(args);
    const argValues = Object.values(args);

    const userFunc = new AsyncFunction(...argNames, "console", "setVariable", code);

    const result = await userFunc(...argValues, consoleProxy, setVariable);

    const message = { id, ok: true, result, logs: workerLogs, variableUpdates: workerVariableUpdates };
    self.postMessage(message);
  } catch (err) {
    const message = {
      id,
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err),
      logs: workerLogs,
      variableUpdates: workerVariableUpdates,
    };
    self.postMessage(message);
  }
};
`;

let workerPromise: Promise<Worker> | null = null;

function getScriptRunnerWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = new Promise((resolve, reject) => {
      try {
        if (typeof window === "undefined") {
          throw new Error("Script runner worker cannot be used on the server.");
        }

        const blob = new Blob([workerCode], { type: "application/javascript" });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        worker.addEventListener("error", (e) => {
          console.error("[ScriptRunnerWorker] error", e);
        });

        resolve(worker);
      } catch (err) {
        reject(err);
      }
    });
  }
  return workerPromise;
}

type WorkerRequest = {
  id: number;
  code: string;
  args: Record<string, unknown>;
};

type ScriptLog = { status: "info"; description: string; context: "Script" };

type VariableUpdate = { name: string; value: unknown };

type WorkerResponse =
  | { id: number; ok: true; result: unknown; logs: ScriptLog[]; variableUpdates: VariableUpdate[] }
  | { id: number; ok: false; error: string; logs: ScriptLog[]; variableUpdates: VariableUpdate[] };

let nextId = 0;

export const runUserCodeInWorker = async (
  code: string,
  args: Record<string, unknown>,
): Promise<{ value: unknown; logs: ScriptLog[]; variableUpdates: VariableUpdate[] }> => {
  const worker = await getScriptRunnerWorker();

  return new Promise((resolve, reject) => {
    const id = nextId++;

    const listener = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (!msg || msg.id !== id) return;

      worker.removeEventListener("message", listener);

      if (msg.ok) resolve({ value: msg.result, logs: msg.logs, variableUpdates: msg.variableUpdates });
      else reject(new Error(msg.error));
    };

    worker.addEventListener("message", listener);

    const payload: WorkerRequest = { id, code, args };
    worker.postMessage(payload);
  });
};
