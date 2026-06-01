import { useMutation, useQuery } from "@tanstack/react-query";
import { defaultScriptOptions } from "@typebot.io/blocks-logic/script/constants";
import type { ScriptBlock } from "@typebot.io/blocks-logic/script/schema";
import { Button } from "@typebot.io/ui/components/Button";
import { Field } from "@typebot.io/ui/components/Field";
import { MoreInfoTooltip } from "@typebot.io/ui/components/MoreInfoTooltip";
import { Select } from "@typebot.io/ui/components/Select";
import { Switch } from "@typebot.io/ui/components/Switch";
import { ArrowExpand01Icon } from "@typebot.io/ui/icons/ArrowExpand01Icon";
import { useState } from "react";
import { CodeEditor } from "@/components/inputs/CodeEditor";
import { useTypebot } from "@/features/editor/providers/TypebotProvider";
import { orpc } from "@/lib/queryClient";
import { ScriptEditorDialog } from "./ScriptEditorDialog";
import { UnsafeScriptAlert } from "./UnsafeScriptAlert";

type Props = {
  options: ScriptBlock["options"];
  onOptionsChange: (options: ScriptBlock["options"]) => void;
};

export const ScriptSettings = ({ options, onOptionsChange }: Props) => {
  const { typebot } = useTypebot();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: srcScripts } = useQuery({
    ...orpc.scripts.listSrcScripts.queryOptions({
      input: { typebotId: typebot?.id ?? "" },
    }),
    enabled: !!typebot?.id,
  });

  const { mutate: loadSrcScript } = useMutation(
    orpc.scripts.getSrcScript.mutationOptions({
      onSuccess: ({ content, name }) => {
        onOptionsChange({ ...options, content, name });
      },
    }),
  );

  const handleScriptSelect = (name: string | null) => {
    if (!name) return;
    const script = srcScripts?.find((s) => s.name === name);
    if (script && typebot)
      loadSrcScript({ typebotId: typebot.id, relPath: script.relPath });
  };

  const handleCodeChange = (content: string) =>
    onOptionsChange({ ...options, content });

  const updateClientExecution = (isExecutedOnClient: boolean) =>
    onOptionsChange({ ...options, isExecutedOnClient });

  const updateIsUnsafe = () => onOptionsChange({ ...options, isUnsafe: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <Field.Root className="flex-1">
          <Field.Label>Name:</Field.Label>
          <Select.Root
            value={options?.name ?? ""}
            onValueChange={handleScriptSelect}
          >
            <Select.Trigger className="w-full">
              <Select.Value placeholder="Select a script…" />
            </Select.Trigger>
            <Select.Content>
              {srcScripts && srcScripts.length > 0 ? (
                srcScripts.map((script) => (
                  <Select.Item key={script.relPath} value={script.name}>
                    {script.name}
                  </Select.Item>
                ))
              ) : (
                <Select.Item value="" disabled>
                  No scripts in src/ yet
                </Select.Item>
              )}
            </Select.Content>
          </Select.Root>
        </Field.Root>
        <Button
          size="icon"
          variant="secondary"
          aria-label="Open full editor"
          onClick={() => setIsEditorOpen(true)}
        >
          <ArrowExpand01Icon />
        </Button>
      </div>
      <Field.Root className="flex-row items-center">
        <Switch
          checked={
            options?.isExecutedOnClient ??
            defaultScriptOptions.isExecutedOnClient
          }
          onCheckedChange={updateClientExecution}
        />
        <Field.Label>
          Execute on client{" "}
          <MoreInfoTooltip>
            Check this if you need access to client variables like `window` or
            `document`."
          </MoreInfoTooltip>
        </Field.Label>
      </Field.Root>
      {options?.isUnsafe === true && options?.isExecutedOnClient !== false && (
        <UnsafeScriptAlert onTrustClick={updateIsUnsafe} />
      )}
      <CodeEditor
        value={options?.content}
        lang="js"
        onChange={handleCodeChange}
        withLineNumbers
        minHeight="200px"
        maxHeight="400px"
      />
      <ScriptEditorDialog
        content={options?.content}
        name={options?.name}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onChange={handleCodeChange}
      />
    </div>
  );
};
