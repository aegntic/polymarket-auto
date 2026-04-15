"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Float } from "@react-three/drei";
import * as THREE from "three";

function WireframeIcosahedron() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x = state.clock.elapsedTime * 0.12;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.18;
    meshRef.current.rotation.z = state.clock.elapsedTime * 0.06;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
      <Icosahedron ref={meshRef} args={[2.2, 1]}>
        <meshBasicMaterial
          color="#d4af37"
          wireframe
          transparent
          opacity={0.35}
        />
      </Icosahedron>
      <Icosahedron args={[1.6, 0]}>
        <meshBasicMaterial
          color="#f0d89a"
          wireframe
          transparent
          opacity={0.15}
        />
      </Icosahedron>
    </Float>
  );
}

function Particles() {
  const count = 200;
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rng = (() => {
      let s = 12345;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    })();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rng() - 0.5) * 15;
      pos[i * 3 + 1] = (rng() - 0.5) * 15;
      pos[i * 3 + 2] = (rng() - 0.5) * 15;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    pointsRef.current.rotation.x = state.clock.elapsedTime * 0.01;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#d4af37"
        size={0.03}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

export function HeroScene() {
  return (
    <div className="h-[320px] w-full overflow-hidden rounded-xl">
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[5, 5, 5]} intensity={0.5} color="#d4af37" />
        <WireframeIcosahedron />
        <Particles />
      </Canvas>
    </div>
  );
}
