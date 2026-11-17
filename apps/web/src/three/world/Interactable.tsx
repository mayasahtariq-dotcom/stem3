"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";

export interface InteractableProps {
  id: string;
  position?: [number, number, number];
  rotationY?: number;
  /** Resting size; hover/selection scale up from here. */
  scale?: number;
  selected?: boolean;
  onSelect?: (id: string) => void;
  reducedMotion?: boolean;
  children: ReactNode;
}

/**
 * Makes a farm object hoverable and tappable (mouse, touch and pen through R3F
 * pointer events). Feedback is a springy scale-up, so it works on any material.
 */
export function Interactable({ id, position, rotationY = 0, scale = 1, selected, onSelect, reducedMotion, children }: InteractableProps) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const target = scale * (selected ? 1.08 : hovered ? 1.04 : 1);
    const k = reducedMotion ? 1 : Math.min(1, dt * 12);
    g.scale.setScalar(g.scale.x + (target - g.scale.x) * k);
  });

  return (
    <group
      ref={ref}
      name={`interactable-${id}`}
      userData={{ interactableId: id }}
      position={position}
      rotation-y={rotationY}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect?.(id);
      }}
    >
      {children}
    </group>
  );
}
