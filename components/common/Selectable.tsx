import { Select } from "@react-three/postprocessing";
import type { ThreeEvent } from "@react-three/fiber";
import type { ReactNode } from "react";
import type { EquipmentTypeId } from "@/types/equipment";
import { useStore } from "@/store/useStore";
import type { V3 } from "./Primitives";

/** Pointer travel (px) above which a press counts as a camera drag, not a click. */
const CLICK_TOLERANCE = 5;

interface SelectableProps {
  id: string;
  type: EquipmentTypeId;
  label: string;
  position?: V3;
  rotation?: V3;
  children: ReactNode;
}

/**
 * Makes its children clickable as one piece of equipment. Clicking selects it
 * (opening the info panel), hovering shows its name, and either state draws
 * the post-processing outline around the whole group.
 */
export function Selectable({ id, type, label, position, rotation, children }: SelectableProps): ReactNode {
  const isSelected = useStore((s) => s.selected?.id === id);
  const isHovered = useStore((s) => s.hovered?.id === id);
  const select = useStore((s) => s.select);
  const hover = useStore((s) => s.hover);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > CLICK_TOLERANCE) return;
    e.stopPropagation();
    select({ id, type, label });
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover({ id, type, label });
  };
  const onOut = () => {
    if (useStore.getState().hovered?.id === id) hover(null);
  };

  return (
    <Select
      enabled={isSelected || isHovered}
      position={position}
      rotation={rotation}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
    >
      {children}
    </Select>
  );
}
