import { Dialog } from "@typebot.io/ui/components/Dialog";
import { CodeEditor } from "@/components/inputs/CodeEditor";

type Props = {
  content: string | undefined;
  name: string | undefined;
  isOpen: boolean;
  onClose: () => void;
  onChange: (content: string) => void;
};

export const ScriptEditorDialog = ({
  content,
  name,
  isOpen,
  onClose,
  onChange,
}: Props) => (
  <Dialog.Root isOpen={isOpen} onClose={onClose}>
    <Dialog.Popup className="max-w-5xl h-[85vh]">
      <Dialog.Title className="text-base font-medium pr-10">
        {name || "Script"}
      </Dialog.Title>
      <Dialog.CloseButton />
      <CodeEditor
        value={content}
        lang="js"
        withLineNumbers
        className="flex-1"
        minHeight="100px"
        maxHeight="2000px"
        onChange={onChange}
      />
    </Dialog.Popup>
  </Dialog.Root>
);
