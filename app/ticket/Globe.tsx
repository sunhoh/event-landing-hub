"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// ─── Config ──────────────────────────────────────────────────────────────────

const R = 1;
const GLOBE_COLOR = "#16203a";
const DOT_COLOR = "#4a5d8a";
const GRID_COLOR = "#2a3a62";
const ARC_DIM = "#3d4f7c";
const ARC_LIT = "#f2b896";
const PLANE_COLOR = "#ffffff";
const SEOUL_COLOR = "#f2b896";
const GLOW_COLOR = "rgba(197,133,106,";
const DOTS = 2600;
const ARC_SEG = 160;
const DRAW_SECONDS = 2.2;   // 처음 열 때 경로가 그려지는 시간
const LANDED_CAM_Z = 2.3;   // 착륙 모드 카메라 거리 (서울 확대)

interface Point { code: string; lat: number; lng: number }

interface Props {
  from: Point;
  to: Point;
  progress: number; // 0~1
  landed: boolean;
}

// ─── Math ────────────────────────────────────────────────────────────────────

function toVec(lat: number, lng: number, r = R): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function toLatLng(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = (Math.asin(n.y) * 180) / Math.PI;
  const lng = (Math.atan2(n.z, -n.x) * 180) / Math.PI - 180;
  return { lat, lng };
}

// 지구본 회전값: 해당 위경도가 화면 정면(+Z)에 오도록
function facing(lat: number, lng: number) {
  return { x: (lat * Math.PI) / 180, y: (-(lng + 90) * Math.PI) / 180 };
}

// 대권 경로 + 거리 비례 고도
function buildArc(a: THREE.Vector3, b: THREE.Vector3) {
  const angle = a.angleTo(b);
  const lift = 0.06 + (angle / Math.PI) * 0.45;
  const an = a.clone().normalize();
  const bn = b.clone().normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ARC_SEG; i++) {
    const t = i / ARC_SEG;
    const s = Math.sin(angle);
    const dir = s < 1e-6
      ? an.clone()
      : an.clone().multiplyScalar(Math.sin((1 - t) * angle) / s).add(bn.clone().multiplyScalar(Math.sin(t * angle) / s));
    pts.push(dir.normalize().multiplyScalar(R + Math.sin(Math.PI * t) * lift));
  }
  return { curve: new THREE.CatmullRomCurve3(pts), angle };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function glowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  grad.addColorStop(0, `${GLOW_COLOR}0.35)`);
  grad.addColorStop(0.55, `${GLOW_COLOR}0.12)`);
  grad.addColorStop(1, `${GLOW_COLOR}0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Globe({ from, to, progress, landed }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fromLabel = useRef<HTMLDivElement>(null);
  const toLabel = useRef<HTMLDivElement>(null);
  const live = useRef({ progress, landed });
  live.current = { progress, landed };

  useEffect(() => {
    const wrap = wrapRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    wrap.prepend(renderer.domElement);
    renderer.domElement.style.display = "block";
    const mask = "radial-gradient(closest-side, #000 86%, transparent 100%)";
    renderer.domElement.style.maskImage = mask;
    renderer.domElement.style.webkitMaskImage = mask;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

    // 대기 광
    const glowTex = glowTexture();
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, depthWrite: false, transparent: true });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(3.1, 3.1, 1);
    scene.add(glow);

    const globe = new THREE.Group();
    scene.add(globe);

    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), new THREE.MeshBasicMaterial({ color: GLOBE_COLOR })));

    // 점 패턴 (피보나치 구)
    const dotPos = new Float32Array(DOTS * 3);
    for (let i = 0; i < DOTS; i++) {
      const y = 1 - (i / (DOTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = Math.PI * (3 - Math.sqrt(5)) * i;
      dotPos.set([Math.cos(th) * r * 1.003, y * 1.003, Math.sin(th) * r * 1.003], i * 3);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPos, 3));
    globe.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: DOT_COLOR, size: 0.011, sizeAttenuation: true })));

    // 경위선
    const grid: number[] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lng = -180; lng < 180; lng += 4) {
        const a = toVec(lat, lng, 1.002), b = toVec(lat, lng + 4, 1.002);
        grid.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lng = -180; lng < 180; lng += 30) {
      for (let lat = -88; lat < 88; lat += 4) {
        const a = toVec(lat, lng, 1.002), b = toVec(lat + 4, lng, 1.002);
        grid.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
    globe.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.55 })));

    // 비행 경로
    const a = toVec(from.lat, from.lng);
    const b = toVec(to.lat, to.lng);
    const { curve, angle } = buildArc(a, b);
    const RADIAL = 8;
    const dimGeo = new THREE.TubeGeometry(curve, ARC_SEG, 0.0035, RADIAL, false);
    globe.add(new THREE.Mesh(dimGeo, new THREE.MeshBasicMaterial({ color: ARC_DIM, transparent: true, opacity: 0.8 })));
    const litGeo = new THREE.TubeGeometry(curve, ARC_SEG, 0.008, RADIAL, false);
    litGeo.setDrawRange(0, 0);
    globe.add(new THREE.Mesh(litGeo, new THREE.MeshBasicMaterial({ color: ARC_LIT })));

    // 마커
    const marker = (v: THREE.Vector3, color: string, size: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(v);
      globe.add(m);
      return m;
    };
    marker(a, "#ffffff", 0.016);
    marker(b, SEOUL_COLOR, 0.02);
    const ringGeo = new THREE.RingGeometry(0.03, 0.038, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: SEOUL_COLOR, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(b.clone().multiplyScalar(1.004));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().normalize());
    globe.add(ring);

    // 비행기 (원뿔 — 끝이 진행 방향)
    const planeGeo = new THREE.ConeGeometry(0.018, 0.06, 12);
    planeGeo.rotateX(Math.PI / 2);
    const plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: PLANE_COLOR }));
    globe.add(plane);
    const planeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
    planeGlow.scale.set(0.22, 0.22, 1);
    globe.add(planeGlow);

    // 화면 방향 목표값
    const mid = toLatLng(curve.getPoint(0.5));
    const flightFace = facing(mid.lat * 0.8, mid.lng);
    const seoulFace = facing(to.lat, to.lng);
    const flightCamZ = 3.25 + (angle / Math.PI) * 1.6;
    const rot = { x: flightFace.x, y: flightFace.y + 1.4 }; // 살짝 돌아간 상태에서 시작
    let camZ = flightCamZ + 1;

    // 크기
    const resize = () => {
      const w = wrap.clientWidth;
      renderer.setSize(w, w);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // 라벨 위치 (3D → 화면 좌표, 뒤쪽이면 숨김)
    const tmp = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const placeLabel = (el: HTMLDivElement | null, v: THREE.Vector3) => {
      if (!el) return;
      tmp.copy(v).applyMatrix4(globe.matrixWorld);
      normal.copy(tmp).normalize();
      const toCam = camera.position.clone().sub(tmp).normalize();
      const visible = normal.dot(toCam) > 0.15;
      tmp.project(camera);
      const w = wrap.clientWidth;
      el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px, ${(-tmp.y * 0.5 + 0.5) * w}px) translate(-50%, -150%)`;
      el.style.opacity = visible ? "1" : "0";
    };

    const start = performance.now();
    let shown = 0;
    let raf = 0;
    let last = start;
    const tick = (now: number) => {
      const { progress: target, landed: isLanded } = live.current;
      const t = (now - start) / 1000;
      // 프레임레이트와 무관하게 같은 속도로 따라가도록
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const follow = 1 - Math.exp(-dt * 2.6);

      // 경로 그리기: 처음엔 0 → 목표까지 애니메이션, 이후엔 부드럽게 따라감
      const intro = Math.min(1, t / DRAW_SECONDS);
      const goal = isLanded ? 1 : target;
      shown = intro < 1 ? goal * easeOut(intro) : shown + (goal - shown) * (1 - Math.exp(-dt * 5));
      const segs = Math.round(shown * ARC_SEG);
      litGeo.setDrawRange(0, segs * RADIAL * 6);

      const p = Math.min(0.999, Math.max(0.001, shown));
      const pos = curve.getPoint(p);
      plane.position.copy(pos);
      plane.lookAt(globe.localToWorld(curve.getPoint(Math.min(1, p + 0.01)).clone()));
      planeGlow.position.copy(pos);
      plane.visible = planeGlow.visible = !isLanded || shown < 0.995;

      // 서울 링 펄스
      const pulse = (t % 1.8) / 1.8;
      ring.scale.setScalar(1 + pulse * 1.6);
      ringMat.opacity = 0.9 * (1 - pulse);

      // 회전·줌
      const face = isLanded ? seoulFace : flightFace;
      const sway = isLanded ? 0 : Math.sin(t * 0.25) * 0.08;
      let ty = face.y + sway;
      while (ty - rot.y > Math.PI) ty -= Math.PI * 2;
      while (rot.y - ty > Math.PI) ty += Math.PI * 2;
      rot.x += (face.x - rot.x) * follow;
      rot.y += (ty - rot.y) * follow;
      globe.rotation.set(rot.x, rot.y, 0);
      camZ += ((isLanded ? LANDED_CAM_Z : flightCamZ) - camZ) * follow;
      camera.position.set(0, 0, camZ);
      glowMat.opacity = Math.min(1, Math.max(0, camZ - 2.4)); // 확대하면 대기광이 화면 밖으로 넘쳐서 흐리게
      camera.lookAt(0, 0, 0);

      globe.updateMatrixWorld();
      placeLabel(fromLabel.current, a);
      placeLabel(toLabel.current, b);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      glowTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [from.lat, from.lng, to.lat, to.lng]);

  return (
    <div ref={wrapRef} className="relative w-full max-w-[420px] mx-auto aspect-square select-none">
      <div ref={fromLabel} className="absolute left-0 top-0 pointer-events-none transition-opacity duration-300">
        <span className="bg-white/90 text-[#1f2a44] text-[11px] font-bold font-mono px-2 py-0.5 rounded-md shadow">{from.code}</span>
      </div>
      <div ref={toLabel} className="absolute left-0 top-0 pointer-events-none transition-opacity duration-300">
        <span className="bg-[#f2b896] text-[#1f2a44] text-[11px] font-bold font-mono px-2 py-0.5 rounded-md shadow">{landed ? "SEOUL · GU" : to.code}</span>
      </div>
    </div>
  );
}
