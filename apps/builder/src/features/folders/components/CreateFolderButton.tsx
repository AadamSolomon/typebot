import { useTranslate } from "@tolgee/react";
import { Button } from "@typebot.io/ui/components/Button";
import { FolderAddIcon } from "@typebot.io/ui/icons/FolderAddIcon";

type Props = { isLoading: boolean; onClick: () => void };

export const CreateFolderButton = ({ isLoading, onClick }: Props) => {
  const { t } = useTranslate();

  return (
    <Button
      onClick={onClick}
      disabled={isLoading}
      variant="outline-secondary"
      className="bg-gray-1"
    >
      <FolderAddIcon className="text-blue-10" />
      <p>{t("folders.createFolderButton.label")}</p>
    </Button>
  );
};
