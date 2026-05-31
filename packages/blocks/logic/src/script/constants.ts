import type { ScriptBlock } from "./schema";

export const defaultScriptOptions = {
  name: "Script",
  isExecutedOnClient: false,
  content: `// Read a variable
const value = {{My Variable}};

// Update a variable
setVariable("My Variable", value);
`,
} as const satisfies ScriptBlock["options"];
