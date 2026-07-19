"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import type { Group, Mesh } from "three";

/**
 * The living centerpiece of the landing page: a breathing, distorting orb —
 * your "physiology" — wrapped in orbiting data rings, rendered in real 3D.
 */

function Orb() {
  const mesh = useRef<Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    mesh.current.rotation.y = t * 0.12;
    const pulse = 1 + Math.sin(t * 1.4) * 0.035; // resting-heart-rate breathing
    mesh.current.scale.setScalar(pulse);
  });
  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1.35, 48]} />
      <MeshDistortMaterial
        color="#7c6bff"
        emissive="#3b2fd4"
        emissiveIntensity={0.55}
        roughness={0.18}
        metalness={0.35}
        distort={0.38}
        speed={1.6}
      />
    </mesh>
  );
}

function Rings() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.z = t * 0.06;
    group.current.rotation.x = 1.15 + Math.sin(t * 0.35) * 0.08;
  });
  return (
    <group ref={group} rotation={[1.15, 0.2, 0]}>
      <mesh>
        <torusGeometry args={[2.15, 0.012, 16, 128]} />
        <meshStandardMaterial color="#2dd4ee" emissive="#2dd4ee" emissiveIntensity={1.4} />
      </mesh>
      <mesh rotation={[0.35, 0.4, 0]}>
        <torusGeometry args={[2.6, 0.008, 16, 128]} />
        <meshStandardMaterial color="#fb7bb8" emissive="#fb7bb8" emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

export default function HeroOrb() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 6], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ pointerEvents: "none" }}
    >
      <ambientLight intensity={0.55} />
      <pointLight position={[6, 4, 6]} intensity={90} color="#a29bff" />
      <pointLight position={[-6, -3, 4]} intensity={60} color="#2dd4ee" />
      <pointLight position={[0, -6, -4]} intensity={45} color="#fb7bb8" />
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.9}>
        <Orb />
        <Rings />
      </Float>
      <Sparkles count={90} scale={7.5} size={2.2} speed={0.35} color="#9fd8ff" opacity={0.65} />
    </Canvas>
  );
}
