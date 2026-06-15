import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  IdleAnimation,
  SkinViewer,
  type PlayerObject,
} from 'skinview3d';
import { useBuildStore } from '../store/buildStore';

// Per-region highlight colours (match the app accent palette). The center
// character is a generic Minecraft-style figure; equipping a piece lights up
// the matching body region. We do NOT render textured armour layers (the mod
// armour body textures aren't extracted) - these are simple highlights.
const REGION_COLOR: Record<string, number> = {
  helmet: 0x55ffff,
  chestplate: 0x5ce15c,
  leggings: 0xb06bff,
  boots: 0xffd23f,
};

type OverlayMap = Record<string, THREE.Mesh[]>;

// Build a generic "Steve-like" skin on a 64x64 canvas at runtime so the app
// stays fully static/offline with no bundled binary skin asset. This is a
// placeholder default skin; swap in a real texture later if desired.
function buildDefaultSkin(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 64, 64);

  const skin = '#bd8a5e';
  const skinDark = '#9c6f49';
  const hair = '#3a2a17';
  const shirt = '#2f8f8f';
  const pants = '#3a3f7a';
  const shoes = '#4a3826';

  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // Head (0,0)-(32,16): skin all over, hair on top + back, a fringe on the face.
  fill(skin, 0, 8, 32, 8);
  fill(hair, 8, 0, 16, 8); // top + bottom faces row
  fill(hair, 0, 8, 8, 8); // right side
  fill(hair, 24, 8, 8, 8); // back
  fill(hair, 8, 8, 8, 2); // fringe over the face
  // Eyes on the face front (8,8,8,8).
  fill('#ffffff', 10, 11, 2, 2);
  fill('#ffffff', 14, 11, 2, 2);
  fill('#3b2bb0', 11, 11, 1, 2);
  fill('#3b2bb0', 14, 11, 1, 2);

  // Body (16,16)-(40,32): shirt.
  fill(shirt, 16, 16, 24, 16);
  fill('#287d7d', 20, 20, 16, 12); // slightly darker torso front

  // Right arm (40,16)-(56,32) and left arm (32,48)-(48,64).
  fill(skin, 40, 16, 16, 16);
  fill(shirt, 44, 16, 8, 4); // sleeve cap
  fill(skinDark, 44, 28, 4, 4);
  fill(skin, 32, 48, 16, 16);
  fill(shirt, 36, 48, 8, 4);
  fill(skinDark, 36, 60, 4, 4);

  // Right leg (0,16)-(16,32) and left leg (16,48)-(32,64).
  fill(pants, 0, 16, 16, 16);
  fill(shoes, 4, 28, 4, 4);
  fill(pants, 16, 48, 16, 16);
  fill(shoes, 20, 60, 4, 4);

  return c;
}

function makeOverlay(
  size: [number, number, number],
  pos: [number, number, number],
  color: number,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.visible = false;
  mesh.renderOrder = 1;
  return mesh;
}

// Build the region overlays and parent them to the matching body parts so they
// track the idle animation. The app and skinview3d share a single `three`
// instance (deduped in vite.config.ts), so our meshes are the same type as the
// player object's body parts and can be parented directly.
function buildOverlays(player: PlayerObject): OverlayMap {
  const s = player.skin;

  const head = makeOverlay([9.2, 9.2, 9.2], [0, 4, 0], REGION_COLOR.helmet);
  s.head.add(head);

  const body = makeOverlay([9, 13, 5], [0, 0, 0], REGION_COLOR.chestplate);
  const rArm = makeOverlay([5, 13, 5], [0, -4, 0], REGION_COLOR.chestplate);
  const lArm = makeOverlay([5, 13, 5], [0, -4, 0], REGION_COLOR.chestplate);
  s.body.add(body);
  s.rightArm.add(rArm);
  s.leftArm.add(lArm);

  const rLegU = makeOverlay([5, 7, 5], [0, -3, 0], REGION_COLOR.leggings);
  const lLegU = makeOverlay([5, 7, 5], [0, -3, 0], REGION_COLOR.leggings);
  s.rightLeg.add(rLegU);
  s.leftLeg.add(lLegU);

  const rLegL = makeOverlay([5.2, 5, 5.2], [0, -9, 0], REGION_COLOR.boots);
  const lLegL = makeOverlay([5.2, 5, 5.2], [0, -9, 0], REGION_COLOR.boots);
  s.rightLeg.add(rLegL);
  s.leftLeg.add(lLegL);

  return {
    helmet: [head],
    chestplate: [body, rArm, lArm],
    leggings: [rLegU, lLegU],
    boots: [rLegL, lLegL],
  };
}

export function CharacterModel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<SkinViewer | null>(null);
  const overlaysRef = useRef<OverlayMap | null>(null);
  const [failed, setFailed] = useState(false);

  const helmet = useBuildStore((s) => s.build.helmet.itemId);
  const chestplate = useBuildStore((s) => s.build.chestplate.itemId);
  const leggings = useBuildStore((s) => s.build.leggings.itemId);
  const boots = useBuildStore((s) => s.build.boots.itemId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let viewer: SkinViewer;
    try {
      viewer = new SkinViewer({
        canvas,
        width: 280,
        height: 380,
        skin: buildDefaultSkin(),
        model: 'default',
        background: 0x1a1b1f,
        zoom: 0.86,
      });
      viewer.animation = new IdleAnimation();
      viewer.controls.enableZoom = false;
      viewer.controls.enablePan = false;
      viewer.camera.rotation.x = -0.18;
      overlaysRef.current = buildOverlays(viewer.playerObject);
      viewerRef.current = viewer;
    } catch {
      // WebGL may be unavailable (headless/older GPU); fall back gracefully.
      setFailed(true);
      return;
    }

    return () => {
      viewer.dispose();
      viewerRef.current = null;
      overlaysRef.current = null;
    };
  }, []);

  useEffect(() => {
    const overlays = overlaysRef.current;
    if (!overlays) return;
    const equipped: Record<string, boolean> = {
      helmet: !!helmet,
      chestplate: !!chestplate,
      leggings: !!leggings,
      boots: !!boots,
    };
    for (const region of Object.keys(overlays)) {
      const on = equipped[region];
      for (const mesh of overlays[region]) mesh.visible = on;
    }
    viewerRef.current?.render();
  }, [helmet, chestplate, leggings, boots]);

  return (
    <div className="character-stage">
      <canvas
        ref={canvasRef}
        className="character-canvas"
        style={{ display: failed ? 'none' : 'block' }}
      />
      {failed ? (
        <div className="character-fallback">3D preview unavailable (no WebGL)</div>
      ) : (
        <div className="character-hint">drag to rotate</div>
      )}
    </div>
  );
}
