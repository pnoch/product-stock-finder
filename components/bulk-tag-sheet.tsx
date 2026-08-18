import { Modal, Text, View } from "react-native";
import { TagDefinition } from "@/lib/types";

interface Props {
  visible: boolean;
  productIds: string[];
  tagDefinitions: Record<string, TagDefinition>;
  onClose: () => void;
  onChanged: () => void;
}

export function BulkTagSheet({ visible }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View />
    </Modal>
  );
}