import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, Physics, RigidBody, type RapierCollider, type RapierRigidBody } from '@react-three/rapier';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Model } from './types';

/* Medidas de la ficha, en unidades del mundo. Todas iguales: la ficha la define
   el logo, no el tamaño. */
const SIZE = 0.86;
const DEPTH = 0.28;
const SLAB = 2.6; // losa poco profunda: el montón se apila también hacia atrás, y se lee como 2.5D

/** Destino de una ficha elegida, en fracciones de pantalla (0..1 desde arriba a la
 *  izquierda). App decide si arma una fila o un gráfico; la escena solo lleva cada
 *  ficha a su lugar, y las etiquetas HTML usan las mismas coordenadas. */
export interface Target { fx: number; fy: number; scale?: number }
export const TOKEN_SIZE = SIZE;

/** Ficha: cuadrado redondeado extruido con bisel, como un azulejo. */
function makeTokenGeometry() {
  const r = 0.21, s = SIZE / 2 - 0.07;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r); shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s); shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH - 0.14, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 4, curveSegments: 10,
  });
  g.center();
  // Las tapas (grupo 0) necesitan UVs de 0 a 1 para que el logo ocupe la cara.
  const pos = g.attributes.position, uv = g.attributes.uv;
  const cap = g.groups[0];
  const pad = 0.1; // el logo respira dentro de la cara; el borde estira su color de fondo
  for (let i = cap.start; i < cap.start + cap.count; i++) {
    const vi = g.index ? g.index.getX(i) : i;
    uv.setXY(vi, (pos.getX(vi) / SIZE + 0.5) * (1 + 2 * pad) - pad, (pos.getY(vi) / SIZE + 0.5) * (1 + 2 * pad) - pad);
  }
  uv.needsUpdate = true;
  return g;
}

const textureCache = new Map<string, THREE.Texture>();
/** Los logos con transparencia se pintarían negros en 3D: se componen sobre blanco
 *  en un canvas, que además los deja todos del mismo tamaño. */
function logoTexture(url: string | null) {
  if (!url) return null;
  let t = textureCache.get(url);
  if (!t) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, 256, 256); tex.needsUpdate = true; };
    img.src = url;
    t = tex;
    textureCache.set(url, t);
  }
  return t;
}

/* Una sola geometría y un solo material de canto para todas las fichas. */
const geometry = makeTokenGeometry();
const edgeMaterial = new THREE.MeshStandardMaterial({ color: '#ecebe4', roughness: 0.55, metalness: 0 });

interface TokenProps {
  model: Model;
  target: Target | null; // null = en el montón
  spawn: [number, number, number];
  w: number;
  h: number;
  onPick: (m: Model) => void;
  onHover: (id: string | null) => void;
  lift: boolean; // el mouse está sobre su etiqueta HTML: se inclina igual que con el mouse encima
}

const Token = memo(function Token({ model, target: dest, spawn, w, h, onPick, onHover, lift }: TokenProps) {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const [pointer, setHover] = useState(false);
  const hover = pointer || lift;
  // Fija: si cambiara en cada render, la librería reasignaría la posición del cuerpo
  // y la ficha volvería a su punto de caída, arriba de la pantalla.
  const initialRotation = useMemo(() => [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number], []);
  const face = useMemo(
    () => new THREE.MeshStandardMaterial({ map: logoTexture(model.logo), color: model.logo ? '#ffffff' : '#d8d9d3', roughness: 0.42 }),
    [model.logo],
  );
  const materials = useMemo(() => [face, edgeMaterial], [face]);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const target = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  // "held": la ficha la movemos nosotros (cinemática y sensor). Se toma apenas
  // Jev la elige, y se suelta recién cuando llegó a la fila: soltarla a mitad de
  // camino, metida adentro del montón, hace que la física la expulse disparada.
  const [held, setHeld] = useState(false);
  const last = useRef<Target | null>(null);
  const release = useRef(0); // cuadros en reposo después de soltarla
  const scaleNow = useRef(1);
  const mesh = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 6, []);
  useEffect(() => {
    if (dest) { last.current = dest; setHeld(true); }
  }, [dest]);

  // Tipo de cuerpo y sensor se cambian directo en el motor, no por props de React:
  // cambiar una prop hace que la librería reasigne la posición del cuerpo.
  useEffect(() => {
    const b = body.current, c = collider.current;
    if (!b || !c) return;
    b.setBodyType(held ? 2 /* KinematicPositionBased */ : 0 /* Dynamic */, true);
    c.setSensor(held);
  }, [held]);

  useFrame((state, dt) => {
    const b = body.current;
    if (!b) return;
    if (!held) {
      if (scaleNow.current !== 1) { scaleNow.current = 1; mesh.current?.scale.setScalar(1); }
      if (release.current > 0) {
        release.current--;
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.setAngvel(release.current === 0
          ? { x: (Math.random() - 0.5) * 2, y: 0, z: (Math.random() - 0.5) * 2 }
          : { x: 0, y: 0, z: 0 }, true);
      }
      return;
    }
    // Atracción: sube más rápido de lo que se desplaza en x, así la trayectoria
    // es una curva y se lee como algo atraído, no teletransportado.
    const t = dest ?? last.current!;
    const p = b.translation();
    const tx = (t.fx - 0.5) * w;
    const ty = (0.5 - t.fy) * h + Math.sin(state.clock.elapsedTime * 1.4 + seed) * 0.05;
    const tz = SLAB / 2 - 0.3;
    // la escala también viaja: en el gráfico las fichas son más chicas
    const want = (dest?.scale ?? 1) * (hover && dest ? 1.1 : 1);
    scaleNow.current += (want - scaleNow.current) * (1 - Math.exp(-dt * 8));
    mesh.current?.scale.setScalar(scaleNow.current);
    const ky = 1 - Math.exp(-dt * 7.5), kx = 1 - Math.exp(-dt * 4.2);
    b.setNextKinematicTranslation({ x: p.x + (tx - p.x) * kx, y: p.y + (ty - p.y) * ky, z: p.z + (tz - p.z) * kx });
    const r = b.rotation();
    q.set(r.x, r.y, r.z, r.w);
    target.setFromEuler(euler.set(hover ? -0.12 : 0, hover ? 0.18 : 0, 0));
    q.slerp(target, 1 - Math.exp(-dt * 6));
    b.setNextKinematicRotation(q);
    // Desplazada y ya en la fila: ahora sí se suelta, lejos del montón.
    if (!dest && Math.abs(p.y - ty) < 0.2 && Math.abs(p.x - tx) < 0.3) {
      release.current = 3;
      setHeld(false);
    }
  });

  const pickable = dest !== null;
  return (
    <RigidBody
      ref={body}
      type="dynamic"
      position={spawn}
      rotation={initialRotation}
      colliders={false}
      restitution={0.15}
      friction={0.7}
      linearDamping={0.25}
      angularDamping={0.4}
    >
      <CuboidCollider ref={collider} args={[SIZE / 2, SIZE / 2, DEPTH / 2]} />
      <mesh
        ref={mesh}
        geometry={geometry}
        material={materials}
        castShadow={!held}
        onPointerOver={(e) => { if (pickable) { e.stopPropagation(); setHover(true); onHover(model.id); document.body.style.cursor = 'pointer'; } }}
        onPointerOut={() => { if (pointer) onHover(null); setHover(false); document.body.style.cursor = ''; }}
        onClick={(e) => { if (pickable) { e.stopPropagation(); onPick(model); } }}
      />
    </RigidBody>
  );
});

function World({ models, targets, onPick, onHover, hovered, onViewport }: SceneProps) {
  const { viewport } = useThree();
  const w = viewport.width, h = viewport.height;
  useEffect(() => onViewport?.(w, h), [w, h, onViewport]);


  // Las fichas caen desde arriba al cargar, escalonadas: el montón se forma solo.
  const spawns = useMemo(
    () => models.map((_, i) => [
      (Math.random() - 0.5) * (w - 2),
      h / 2 + 1 + (i % 45) * 0.3 + Math.random() * 2, // capas bajas y mezcladas: el montón se arma en ~2 s
      (Math.random() - 0.5) * (SLAB - SIZE),
    ] as [number, number, number]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models],
  );

  return (
    <>
      {/* El piso y las paredes del montón: una losa angosta pegada al papel. */}
      <CuboidCollider position={[0, -h / 2 - 3, 0]} args={[w, 3, 4]} />
      <CuboidCollider position={[-w / 2 - 0.5, 0, 0]} args={[0.5, h * 3, 4]} />
      <CuboidCollider position={[w / 2 + 0.5, 0, 0]} args={[0.5, h * 3, 4]} />
      <CuboidCollider position={[0, 0, -SLAB / 2 - 0.5]} args={[w, h * 3, 0.5]} />
      <CuboidCollider position={[0, 0, SLAB / 2 + 0.5]} args={[w, h * 3, 0.5]} />
      {models.map((m, i) => (
        <Token key={m.id} model={m} target={targets[m.id] ?? null}
          spawn={spawns[i]} w={w} h={h} onPick={onPick} onHover={onHover} lift={hovered === m.id} />
      ))}
    </>
  );
}

interface SceneProps {
  models: Model[];
  targets: Record<string, Target>; // solo las fichas elegidas
  onPick: (m: Model) => void;
  onHover: (id: string | null) => void; // qué ficha tiene el mouse encima, para la ayuda de App
  hovered: string | null;
  onViewport?: (w: number, h: number) => void;
}

export default function Pile(props: SceneProps) {
  return (
    <Canvas
      className="pile"
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 40], fov: 20 }}
      gl={{ antialias: true, alpha: true }}
    >
      {/* Luz de escritorio: una principal arriba a la izquierda y relleno suave. */}
      <hemisphereLight args={['#ffffff', '#d9d8cf', 1.1]} />
      <directionalLight
        position={[-5, 7, 30]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={12} shadow-camera-bottom={-12}
        shadow-radius={10}
      />
      {/* El papel es CSS; este plano solo recibe las sombras y las deja caer sobre él. */}
      <mesh position={[0, 0, -SLAB / 2 - 0.3]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <shadowMaterial opacity={0.11} />
      </mesh>
      {/* Paso fijo: con paso variable y cuadros lentos, las fichas atraviesan el piso. */}
      <Physics gravity={[0, -32, 0]}>
        <World {...props} />
      </Physics>
    </Canvas>
  );
}
