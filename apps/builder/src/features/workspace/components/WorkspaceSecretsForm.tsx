import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@typebot.io/ui/components/Button";
import { Field } from "@typebot.io/ui/components/Field";
import { Input } from "@typebot.io/ui/components/Input";
import { Popover } from "@typebot.io/ui/components/Popover";
import { Skeleton } from "@typebot.io/ui/components/Skeleton";
import { useOpenControls } from "@typebot.io/ui/hooks/useOpenControls";
import { Edit03Icon } from "@typebot.io/ui/icons/Edit03Icon";
import { TrashIcon } from "@typebot.io/ui/icons/TrashIcon";
import { useRef, useState } from "react";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { orpc } from "@/lib/queryClient";
import { toast } from "@/lib/toast";

export const WorkspaceSecretsForm = () => {
  const { workspace } = useWorkspace();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string>();

  const { data, isLoading, refetch } = useQuery(
    orpc.workspace.listSecrets.queryOptions({
      input: { workspaceId: workspace?.id ?? "" },
      enabled: !!workspace?.id,
    }),
  );

  const { mutate: upsertSecret, isPending: isUpserting } = useMutation(
    orpc.workspace.upsertSecret.mutationOptions({
      onSuccess: () => {
        setName("");
        setValue("");
        setEditingId(undefined);
        refetch();
      },
      onError: (err) => toast({ title: "Error", description: err.message }),
    }),
  );

  const { mutate: deleteSecret } = useMutation(
    orpc.workspace.deleteSecret.mutationOptions({
      onSuccess: () => refetch(),
      onError: (err) => toast({ title: "Error", description: err.message }),
    }),
  );

  const handleSubmit = () => {
    if (!workspace?.id || !name || !value) return;
    upsertSecret({ workspaceId: workspace.id, name, value });
  };

  const handleEditClick = (secretName: string) => {
    setName(secretName);
    setValue("");
    setEditingId(secretName);
  };

  const handleCancelEdit = () => {
    setName("");
    setValue("");
    setEditingId(undefined);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h2>Secrets</h2>
      </div>

      <p className="text-sm text-gray-11">
        Secrets are encrypted and injected into your bots as{" "}
        <code className="bg-gray-3 px-1 rounded text-xs">
          {"{{env.SECRET_NAME}}"}
        </code>
        . They are shared across all bots in this workspace.
      </p>

      <div className="flex flex-col gap-3 border rounded-md p-4">
        <h3 className="text-sm font-medium">
          {editingId ? `Update "${editingId}"` : "Add new secret"}
        </h3>
        <div className="flex gap-2">
          <Field.Root className="flex-1">
            <Field.Label>Name</Field.Label>
            <Input
              placeholder="API_KEY"
              value={name}
              disabled={!!editingId}
              onChange={(e) => setName(e.target.value)}
            />
          </Field.Root>
          <Field.Root className="flex-1">
            <Field.Label>Value</Field.Label>
            <Input
              type="password"
              placeholder={editingId ? "Enter new value…" : "sk-…"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field.Root>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!name || !value || isUpserting}
            onClick={handleSubmit}
          >
            {editingId ? "Update" : "Add secret"}
          </Button>
          {editingId && (
            <Button size="sm" variant="secondary" onClick={handleCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : data?.secrets.length === 0 ? (
        <p className="text-sm text-gray-10">No secrets yet.</p>
      ) : (
        <div className="flex flex-col border rounded-md divide-y">
          {data?.secrets.map((secret) => (
            <SecretRow
              key={secret.id}
              id={secret.id}
              name={secret.name}
              workspaceId={workspace?.id ?? ""}
              onEditClick={() => handleEditClick(secret.name)}
              onDeleteConfirm={() =>
                deleteSecret({
                  workspaceId: workspace?.id ?? "",
                  secretId: secret.id,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SecretRow = ({
  id,
  name,
  workspaceId,
  onEditClick,
  onDeleteConfirm,
}: {
  id: string;
  name: string;
  workspaceId: string;
  onEditClick: () => void;
  onDeleteConfirm: () => void;
}) => {
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const deletePopover = useOpenControls();

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <code className="text-sm">
        {"{{"}env.{name}
        {"}}"}
      </code>
      <div className="flex gap-2">
        <Button
          aria-label="Edit"
          size="icon"
          variant="secondary"
          className="size-7"
          onClick={onEditClick}
        >
          <Edit03Icon />
        </Button>
        <Popover.Root {...deletePopover}>
          <Popover.TriggerButton
            aria-label="Delete"
            size="icon"
            variant="secondary"
            className="size-7"
          >
            <TrashIcon />
          </Popover.TriggerButton>
          <Popover.Popup initialFocus={initialFocusRef}>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Delete secret?</p>
              <p className="text-sm">
                Bots using{" "}
                <code className="bg-gray-3 px-1 rounded text-xs">
                  {"{{"}env.{name}
                  {"}}"}
                </code>{" "}
                will stop receiving its value.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                ref={initialFocusRef}
                size="sm"
                variant="secondary"
                onClick={deletePopover.onClose}
              >
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={onDeleteConfirm}>
                Delete
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Root>
      </div>
    </div>
  );
};
