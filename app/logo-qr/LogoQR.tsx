"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

// ─── Config ──────────────────────────────────────────────────────────────────

// 로고 선택지 — public/logo 안의 SVG
const LOGOS = {
  gu:   { label: "지유", src: "/logo/gu.svg" },
  luho: { label: "루호", src: "/logo/luho.svg" },
} as const;
type LogoKey = keyof typeof LOGOS;

const DEFAULT_QR_SRC = "/qr.png";

// 테마 = 풀·낙엽 색 (바닥 QR은 항상 회색 타일)
const THEMES = {
  autumn: { label: "가을", grass: ["#e8b84a", "#d9a23a", "#f0c95c"], leaves: ["#f2a65a", "#f7c55e", "#e98b4f", "#f4b870"] },
  summer: { label: "여름",   grass: ["#9cc46b", "#87b35a", "#b2d47f"], leaves: ["#f6b8c8", "#f9cdd8", "#ee9fb5", "#fde2e8"] },
  // rose:   { label: "로즈", grass: ["#d9a48c", "#c98f76", "#e8bba6"], leaves: ["#C5856A", "#e8b4a0", "#f3cdbd", "#b9765c"] },
} as const;
type ThemeKey = keyof typeof THEMES;

// 바닥: 밝은 회색 타일 위에 qr.png처럼 둥근 점·둥근 모서리 사각형·가운데 로고 판
const TILE_LIGHT: [number, number] = [0.82, 0.88]; // 타일 명도 범위 (HSL)
const TILE_H = 0.1;
const DOT_LIGHT: [number, number] = [0.46, 0.54];   // 점 명도 범위
const DOT_SIZE = 0.8;     // 점 크기 기본값 (칸 대비) — 실제로는 QR 이미지에서 재서 씀
const DOT_RADIUS = 0.22;
const DOT_H = 0.16;
const MARK_COLOR = "#85817b"; // 모서리 사각형·로고 판 색
const MARK_H = 0.2;
const PATTERN_COLOR = "#e4e1db"; // 로고 판 위 밝은 무늬
const SLAB_COLOR = "#cfccc6";
const SLAB_THICKNESS = 1.2;
const FINDER = 7;         // 위치 표시 사각형 크기 (칸) — 바깥 고리에 풀이 자람
const GROUND_LEAVES = 0.9; // 바닥 낙엽 수 = 바닥 폭 × 이 값
const FALLING_LEAVES = 24;

const DEFAULT_LOGO_COLOR = "#1f2a44";
const QUIET = 4;          // QR 흰 여백 (칸)
const LOGO_SPAN = 0.62;   // 로고 폭 = 바닥 폭의 62%
const LOGO_DEPTH = 2;     // 로고 두께 (QR 한 칸 = 1)
const FOLD_SECONDS = 0.95;
const PIX = 0.5;          // 로고가 부서지는 픽셀 크기 (QR 한 칸 = 1)
const PIX_LAYERS = 2;     // 로고 두께 방향 픽셀 층 수
const PIX_FLY = 0.45;     // 픽셀 하나가 날아가는 구간 길이 (진행도 기준)
const LOGO_FADE = 0.05;   // 로고 메시 ↔ 픽셀이 겹쳐 바뀌는 구간 (진행도 기준)
const FLAT_FRAME = 1.12;  // 평면 상태에서 화면 짧은 변 대비 QR 크기 비율
const BG = "#FDFCFB";

// ─── QR 이미지 → 모듈 격자 ───────────────────────────────────────────────────

interface QRSource {
  img: HTMLImageElement;
  modules: boolean[][];
  crop: { x: number; y: number; w: number; h: number }; // 이미지 안에서 QR이 차지하는 영역
  // 가운데 로고 (칸 단위 영역 + 로고 안 밝은 무늬만 남긴 투명 캔버스)
  logo: { x: number; y: number; w: number; h: number; pattern: HTMLCanvasElement } | null;
  // 이미지 속 점의 실제 크기와 칸 중심에서 치우친 정도 (칸 단위) — qr.png는 오른쪽 아래로 0.13칸
  dot: { size: number; dx: number; dy: number };
}

// 이미지에서 QR 영역을 찾고, 왼쪽 위 위치 표시(1:1:3:1:1)로 칸 크기를 재서 격자로 샘플링
async function loadQR(src: string): Promise<QRSource> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(0, 0, W, H).data;
  const lum = (x: number, y: number) => {
    const i = (Math.min(H - 1, Math.max(0, y | 0)) * W + Math.min(W - 1, Math.max(0, x | 0))) * 4;
    return px[i + 3] < 128 ? 255 : (px[i] + px[i + 1] + px[i + 2]) / 3;
  };
  const dark = (x: number, y: number) => lum(x, y) < 128;

  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dark(x, y)) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error("QR 이미지에서 코드를 찾지 못했어요.");
  const w = x1 - x0 + 1, h = y1 - y0 + 1;

  const units: number[] = [];
  for (let y = y0; y < y0 + h * 0.25; y++) {
    const runs: number[] = [];
    let cur = true, n = 0;
    for (let x = x0; x < x1 && runs.length < 5; x++) {
      if (dark(x, y) === cur) n++;
      else { runs.push(n); cur = !cur; n = 1; }
    }
    if (runs.length < 5 || runs[0] === 0) continue;
    const u = runs.reduce((a, b) => a + b, 0) / 7;
    const ok = [1, 1, 3, 1, 1].every((k, i) => Math.abs(runs[i] - k * u) < u * 0.6);
    if (ok) units.push(u);
  }
  if (!units.length) throw new Error("QR 위치 표시(모서리 사각형)를 찾지 못했어요.");
  units.sort((a, b) => a - b);
  const unit = units[units.length >> 1];
  const version = Math.min(40, Math.max(1, Math.round((w / unit - 17) / 4)));
  const N = 17 + version * 4;

  const pw = w / N, ph = h / N, o = Math.max(1, pw * 0.15);
  const modules = Array.from({ length: N }, (_, j) => Array.from({ length: N }, (_, i) => {
    const cx = x0 + (i + 0.5) * pw, cy = y0 + (j + 0.5) * ph;
    let s = 0;
    for (const dx of [-o, 0, o]) for (const dy of [-o, 0, o]) s += lum(cx + dx, cy + dy);
    return s / 9 < 128;
  }));
  return { img, modules, crop: { x: x0, y: y0, w, h }, logo: findCenterLogo(), dot: measureDots() };

  // 양옆(위아래)이 비어 있는 점만 골라, 칸 안에서 어두운 구간이 어디서 시작·끝나는지 평균
  function measureDots(): QRSource["dot"] {
    const xs: number[] = [], ys: number[] = [], sizes: number[] = [];
    const skip = (i: number, j: number) => (i < 8 && j < 8) || (i >= N - 8 && j < 8) || (i < 8 && j >= N - 8);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!modules[j][i] || skip(i, j)) continue;
      const cx = x0 + (i + 0.5) * pw, cy = y0 + (j + 0.5) * ph;
      let l = cx, r = cx, tp = cy, b = cy;
      while (dark(l - 1, cy) && l > cx - pw) l--;
      while (dark(r + 1, cy) && r < cx + pw) r++;
      while (dark(cx, tp - 1) && tp > cy - ph) tp--;
      while (dark(cx, b + 1) && b < cy + ph) b++;
      if (r - l < pw * 0.95) { xs.push((l + r + 1) / 2 - (x0 + i * pw)); sizes.push((r + 1 - l) / pw); }
      if (b - tp < ph * 0.95) { ys.push((tp + b + 1) / 2 - (y0 + j * ph)); sizes.push((b + 1 - tp) / ph); }
    }
    if (xs.length < 10 || ys.length < 10) return { size: DOT_SIZE, dx: 0, dy: 0 };
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    return { size: avg(sizes), dx: avg(xs) / pw - 0.5, dy: avg(ys) / ph - 0.5 };
  }

  // 가운데 근처에서 가장 큰 '꽉 찬' 어두운 덩어리 = 로고 판
  function findCenterLogo(): QRSource["logo"] {
    const seen = new Uint8Array(W * H);
    const cx = x0 + w / 2, cy = y0 + h / 2, r = w * 0.15;
    let best = { area: 0, bx0: 0, by0: 0, bx1: 0, by1: 0 };
    for (let sy = cy - r; sy < cy + r; sy += 2) for (let sx = cx - r; sx < cx + r; sx += 2) {
      const start = (sy | 0) * W + (sx | 0);
      if (seen[start] || !dark(sx, sy)) continue;
      const stack = [start];
      seen[start] = 1;
      let area = 0, bx0 = W, by0 = H, bx1 = 0, by1 = 0;
      while (stack.length) {
        const k = stack.pop()!, x = k % W, y = (k - x) / W;
        area++;
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
        for (const nk of [k - 1, k + 1, k - W, k + W]) {
          const nx = nk % W;
          if (nk < 0 || nk >= W * H || Math.abs(nx - x) > 1 || seen[nk] || !dark(nx, (nk - nx) / W)) continue;
          seen[nk] = 1;
          stack.push(nk);
        }
      }
      if (area > best.area) best = { area, bx0, by0, bx1, by1 };
    }
    const bw = best.bx1 - best.bx0 + 1, bh = best.by1 - best.by0 + 1;
    if (bw < pw * 4 || bh < ph * 4 || best.area < bw * bh * 0.5) return null;

    const pattern = document.createElement("canvas");
    pattern.width = bw; pattern.height = bh;
    const pctx = pattern.getContext("2d")!;
    const out = pctx.createImageData(bw, bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      const v = lum(best.bx0 + x, best.by0 + y), i = (y * bw + x) * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = 255;
      out.data[i + 3] = Math.max(0, Math.min(255, (v - 64) * 2)); // 밝은 무늬만 불투명
    }
    pctx.putImageData(out, 0, 0);
    return { x: (best.bx0 - x0) / pw, y: (best.by0 - y0) / ph, w: bw / pw, h: bh / ph, pattern };
  }
}

// 스캔용 평면 QR: 원본 이미지를 바닥과 같은 여백으로 배치
function drawQR(canvas: HTMLCanvasElement, { img, modules, crop }: QRSource) {
  const cell = 16, N = modules.length, G = N + QUIET * 2;
  canvas.width = canvas.height = G * cell;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, QUIET * cell, QUIET * cell, N * cell, N * cell);
}

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
// 전체 진행도 t 중 [start, start+span] 구간만의 진행도 (start+span ≤ 1 이어야 끝까지 감)
const local = (t: number, start: number, span: number) => ease(clamp01((t - start) / span));

// 접히는 순서 (t: 0 = 로고, 1 = QR)
//   0.00~0.05  로고 메시가 같은 자리의 픽셀로 서서히 바뀜
//   0.00~0.17  픽셀이 출발 전까지 조금씩 벌어짐 (멈춰 있는 픽셀 없이)
//   0.02~0.62  픽셀이 아래쪽부터 차례로 날아가 가운데 QR 로고 자리로 모여듦
//   0.42~0.80  모인 픽셀이 가운데 QR 로고 판으로 솟아오름 (무늬는 0.60~0.85)
//   0.00~0.35  풀·낙엽이 사라짐
//   0.12~1.00  카메라가 위에서 내려다보는 시점으로
//   0.30~0.96  바닥 타일은 흰색, 점은 검게 (가운데부터 물결)
//   0.88~1.00  원본 QR 이미지가 겹쳐짐

function inPolygon(x: number, y: number, poly: THREE.Vector2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

interface SceneStyle { theme: ThemeKey; logoColor: string; flat: boolean }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

// 둥근 사각형 윤곽 (Shape·구멍용 Path 공용)
function roundRect<T extends THREE.Path>(p: T, x: number, y: number, w: number, h: number, r: number): T {
  r = Math.min(r, w / 2, h / 2);
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r); p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h); p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

// 바닥(XZ)에 눕힌 둥근 사각형: 월드 X∈[x, x+w], Z∈[z, z+d] → Shape 좌표는 y = -z
function groundRect(x: number, z: number, w: number, d: number, r: number) {
  return roundRect(new THREE.Shape(), x, -(z + d), w, d, r);
}

// 도형을 바닥에서 위로 height만큼 살짝 둥근 모서리로 돌출
const bevelOf = (height: number) => Math.min(0.03, height / 4); // 둥근 모서리만큼 윤곽보다 바깥으로 커짐

function flatExtrude(shapes: THREE.Shape[], height: number) {
  const b = bevelOf(height);
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: height - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, b, 0);
  return geo;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

// 풀 한 포기: 가늘고 뾰족한 잎 여러 장을 바깥으로 기울여 한 지오메트리로
function makeTuftGeometry() {
  const pos: number[] = [], col: number[] = [];
  for (let b = 0; b < 14; b++) {
    const a = rand(0, Math.PI * 2), r = rand(0, 0.22);
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
    const face = rand(0, Math.PI * 2), w = rand(0.06, 0.1);
    const px = -Math.sin(face) * w, pz = Math.cos(face) * w;
    const h = rand(0.45, 0.95), lean = rand(0.15, 0.4) * h;
    pos.push(cx + px, 0, cz + pz, cx - px, 0, cz - pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    col.push(0.62, 0.62, 0.62, 0.62, 0.62, 0.62, 1, 1, 1); // 밑동은 어둡게, 끝은 밝게
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// 낙엽/꽃잎: 끝이 뾰족한 잎 모양, 바닥에 눕힘
function makeLeafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.quadraticCurveTo(0.28, -0.05, 0, 0.3);
  s.quadraticCurveTo(-0.28, -0.05, 0, -0.3);
  const geo = new THREE.ShapeGeometry(s, 8);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function createScene(canvas: HTMLCanvasElement, style: { current: SceneStyle }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // 그림자 끄기 — 다시 켜려면 "// " 처리된 shadow 관련 줄들의 주석을 풀면 됨
  // renderer.shadowMap.enabled = true;
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  const hemi = new THREE.HemisphereLight("#ffffff", "#b0a890", 1.3);
  const sun = new THREE.DirectionalLight("#ffffff", 2.2);
  // sun.castShadow = true;
  // sun.shadow.mapSize.set(2048, 2048);
  // sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);
  const root = new THREE.Group();
  scene.add(root);

  type Tile = { x: number; z: number; color: THREE.Color; delay: number };
  type Tuft = { x: number; z: number; rot: number; s: number; phase: number; c: number; delay: number };
  type Leaf = { x: number; y: number; z: number; rot: number; s: number; c: number; speed: number; phase: number };
  type Pixel = { local: THREE.Vector3; jitter: THREE.Vector3; start: number; tx: number; tz: number; rx: number; rz: number };

  const tileGeo = new THREE.BoxGeometry(1, TILE_H, 1).translate(0, TILE_H / 2, 0);
  let dotGeo = new THREE.BufferGeometry(); // buildGround에서 QR 이미지 점 크기에 맞춰 만듦
  const dotMat = new THREE.MeshLambertMaterial();
  const markMat = new THREE.MeshLambertMaterial({ color: MARK_COLOR });
  const patternMat = new THREE.MeshLambertMaterial({ color: PATTERN_COLOR, transparent: true });
  const tuftGeo = makeTuftGeometry();
  const leafGeo = makeLeafGeometry();
  const tileMat = new THREE.MeshLambertMaterial();
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const leafMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: SLAB_COLOR }));
  // slab.receiveShadow = true;
  root.add(slab);

  let tiles: THREE.InstancedMesh | null = null;
  let dots: THREE.InstancedMesh | null = null;
  let dotData: Tile[] = [];
  let plate: THREE.Mesh | null = null; // 가운데 QR 로고 판 (자식으로 무늬) — 픽셀이 모이면 솟아오름
  let plateArea: { x: number; z: number; w: number; h: number } | null = null;
  const marks = new THREE.Group(); // 모서리 사각형 + 로고 판 + 무늬
  root.add(marks);
  let grass: THREE.InstancedMesh | null = null;
  let groundLeaves: THREE.InstancedMesh | null = null;
  let fallingLeaves: THREE.InstancedMesh | null = null;
  let tileData: Tile[] = [], tuftData: Tuft[] = [], groundLeafData: Leaf[] = [], fallingData: Leaf[] = [];

  const logo = new THREE.Group();
  logo.rotation.y = Math.PI / 4; // 카메라 쪽을 보게
  root.add(logo);
  const logoMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05, transparent: true });
  let parts: THREE.Mesh[] = [];
  const pixelGeo = new THREE.BoxGeometry(1, 1, 1);
  const pixelMat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 });
  let pixels: THREE.InstancedMesh | null = null;
  let pixelData: Pixel[] = [];
  const tmpV = new THREE.Vector3();
  let G = 0;
  let t = style.current.flat ? 1 : 0;
  let yaw = 0, dragging = false;

  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color(), cB = new THREE.Color();
  const DIR_TREE = new THREE.Vector3(1, 0.85, 1).normalize();
  const DIR_FLAT = new THREE.Vector3(0, 1, 0.0001).normalize();
  const UP_TREE = new THREE.Vector3(0, 1, 0), UP_FLAT = new THREE.Vector3(0, 0, -1);
  const dir = new THREE.Vector3(), up = new THREE.Vector3();

  const replace = (mesh: THREE.InstancedMesh | null, next: THREE.InstancedMesh) => {
    if (mesh) { root.remove(mesh); mesh.dispose(); }
    root.add(next);
    return next;
  };
  const ripple = (x: number, z: number) => (Math.hypot(x, z) / (G * 0.71)) * 0.35;

  function buildGround({ modules, logo: centerLogo, dot }: QRSource) {
    const n = modules.length;
    G = n + QUIET * 2;
    slab.scale.set(G, SLAB_THICKNESS, G);
    slab.position.y = -SLAB_THICKNESS / 2;
    const wx = (col: number) => col + QUIET - G / 2; // 모듈 좌표 → 월드 좌표 (칸 왼쪽/위쪽 모서리)

    // 밝은 회색 타일: 칸마다 명도를 살짝 달리해 돌바닥처럼
    tileData = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const px = x - G / 2 + 0.5, pz = y - G / 2 + 0.5;
      tileData.push({ x: px, z: pz, color: new THREE.Color().setHSL(0.1, rand(0.04, 0.08), rand(...TILE_LIGHT)), delay: ripple(px, pz) });
    }
    tiles = replace(tiles, new THREE.InstancedMesh(tileGeo, tileMat, tileData.length));
    // tiles.receiveShadow = true;

    // 모서리 사각형 3개: 둥근 고리 + 가운데 둥근 사각형
    const corners = [[0, 0], [n - FINDER, 0], [0, n - FINDER]];
    const inFinder = (i: number, j: number) => corners.some(([ox, oy]) => i >= ox && i < ox + FINDER && j >= oy && j < oy + FINDER);
    const markShapes: THREE.Shape[] = [];
    for (const [ox, oy] of corners) {
      const X = wx(ox), Z = wx(oy);
      const ring = groundRect(X, Z, 7, 7, 1);                                   // 바깥 고리 외곽 
      ring.holes.push(roundRect(new THREE.Path(), X + 1, -(Z + 1.0 + 5.0), 5.0, 5.0, 0.2));       // 고리 안쪽 구멍
      markShapes.push(ring, groundRect(X + 2, Z + 2, 3, 3, 0.4));                         // 가운데 사각형: 
    }

    // 가운데 로고 판 + 밝은 무늬
    for (const c of [...marks.children]) {
      marks.remove(c);
      c.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
    patternMat.map?.dispose();
    const inLogo = (i: number, j: number) => !!centerLogo &&
      i + 0.5 > centerLogo.x - 0.2 && i + 0.5 < centerLogo.x + centerLogo.w + 0.2 &&
      j + 0.5 > centerLogo.y - 0.2 && j + 0.5 < centerLogo.y + centerLogo.h + 0.2;
    plate = null;
    plateArea = null;
    if (centerLogo) {
      const { w, h } = centerLogo;
      const X = wx(centerLogo.x) + w / 2, Z = wx(centerLogo.y) + h / 2;
      plate = new THREE.Mesh(flatExtrude([groundRect(-w / 2, -h / 2, w, h, Math.min(w, h) * 0.18)], MARK_H), markMat);
      plate.position.set(X, TILE_H, Z);
      const tex = new THREE.CanvasTexture(centerLogo.pattern);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      patternMat.map = tex;
      patternMat.needsUpdate = true;
      const pattern = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), patternMat);
      pattern.position.y = MARK_H + 0.005;
      plate.add(pattern);
      marks.add(plate);
      plateArea = { x: X, z: Z, w, h };
    }
    const markMesh = new THREE.Mesh(flatExtrude(markShapes, MARK_H), markMat);
    markMesh.position.y = TILE_H;
    // markMesh.castShadow = markMesh.receiveShadow = true;
    marks.add(markMesh);

    // 둥근 점: 나머지 어두운 칸마다 하나씩 (qr.png처럼 서로 떨어진 점)
    dotData = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (!modules[j][i] || inFinder(i, j) || inLogo(i, j)) continue;
      const px = wx(i) + 0.5 + dot.dx, pz = wx(j) + 0.5 + dot.dy;
      dotData.push({ x: px, z: pz, color: new THREE.Color().setHSL(0.1, rand(0.03, 0.07), rand(...DOT_LIGHT)), delay: ripple(px, pz) });
    }
    // 둥근 모서리(bevel)로 커지는 만큼 윤곽을 줄여서, 위에서 본 크기가 이미지 속 점과 같게
    dotGeo.dispose();
    const size = dot.size - bevelOf(DOT_H) * 2, half = size / 2;
    dotGeo = flatExtrude([roundRect(new THREE.Shape(), -half, -half, size, size, DOT_RADIUS * (dot.size / DOT_SIZE))], DOT_H);
    dots = replace(dots, new THREE.InstancedMesh(dotGeo, dotMat, dotData.length));
    // dots.castShadow = dots.receiveShadow = true;

    // 풀: 모서리 사각형 바깥 고리 위에
    tuftData = [];
    for (const [ox, oy] of corners) for (let j = 0; j < FINDER; j++) for (let i = 0; i < FINDER; i++) {
      if (i > 0 && j > 0 && i < FINDER - 1 && j < FINDER - 1) continue;
      for (let k = 0; k < 2; k++) {
        const px = wx(ox + i) + rand(0.2, 0.8), pz = wx(oy + j) + rand(0.2, 0.8);
        tuftData.push({ x: px, z: pz, rot: rand(0, Math.PI * 2), s: rand(1.2, 1.9), phase: rand(0, 6.28), c: Math.random(), delay: ripple(px, pz) * 0.6 });
      }
    }
    grass = replace(grass, new THREE.InstancedMesh(tuftGeo, grassMat, tuftData.length));
    // grass.castShadow = true;

    // 바닥에 흩어진 낙엽
    const spread = G / 2 - 1;
    groundLeafData = Array.from({ length: Math.round(G * GROUND_LEAVES) }, () => ({
      x: rand(-spread, spread), y: 0.2, z: rand(-spread, spread), rot: rand(0, Math.PI * 2),
      s: rand(1.6, 2.4), c: Math.random(), speed: 0, phase: 0,
    }));
    groundLeaves = replace(groundLeaves, new THREE.InstancedMesh(leafGeo, leafMat, groundLeafData.length));
    // groundLeaves.receiveShadow = true;

    // 떨어지는 낙엽
    fallingData = Array.from({ length: FALLING_LEAVES }, () => ({
      x: rand(-spread, spread), y: rand(0, G), z: rand(-spread, spread), rot: rand(0, Math.PI * 2),
      s: rand(1.6, 2.3), c: Math.random(), speed: rand(1.2, 2.4), phase: rand(0, 6.28),
    }));
    fallingLeaves = replace(fallingLeaves, new THREE.InstancedMesh(leafGeo, leafMat, fallingData.length));
    // fallingLeaves.castShadow = true;

    sun.position.set(G * 0.6, G * 1.2, G * 0.9);
    // const sc = sun.shadow.camera;
    // sc.left = sc.bottom = -G; sc.right = sc.top = G; sc.far = G * 4;
    // sc.updateProjectionMatrix();
  }

  // SVG 윤곽선을 그대로 돌출 + 접힐 때 쓸 픽셀(로고 내부를 PIX 간격으로 샘플링) 준비
  function buildLogo(svg: string) {
    for (const m of parts) { logo.remove(m); m.geometry.dispose(); }
    parts = [];
    const data = new SVGLoader().parse(svg);
    const shapes = data.paths.map((p) => SVGLoader.createShapes(p));
    const all = new THREE.Box2();
    for (const group of shapes) for (const s of group) for (const pt of s.getPoints()) all.expandByPoint(pt);
    if (all.isEmpty()) throw new Error("SVG에서 도형을 찾지 못했어요.");
    const size = all.getSize(new THREE.Vector2());
    const scale = (G * LOGO_SPAN) / size.x;
    const depth = LOGO_DEPTH / scale, bevel = 0.18 / scale;
    const base = 0.8; // 바닥 위 높이

    for (const group of shapes) {
      if (!group.length) continue;
      const geo = new THREE.ExtrudeGeometry(group, {
        depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24,
      });
      // SVG 좌표(y 아래로) → 월드 좌표(y 위로), 로고 전체 기준으로 가운데·바닥 정렬
      geo.translate(-(all.min.x + size.x / 2), -all.max.y, -depth / 2);
      geo.scale(scale, -scale, scale);
      geo.computeBoundingBox();
      const center = geo.boundingBox!.getCenter(new THREE.Vector3());
      geo.translate(-center.x, -center.y, -center.z);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, logoMat);
      // mesh.castShadow = true;
      // mesh.receiveShadow = true;
      mesh.position.set(center.x, center.y + base, center.z);
      logo.add(mesh);
      parts.push(mesh);
    }

    // 로고 내부 픽셀: SVG 좌표에서 격자로 찍고, 도형 안(구멍 밖)인 칸만
    const polys = shapes.flat().map((sh) => sh.extractPoints(12));
    const inside = (x: number, y: number) => polys.some(({ shape, holes }) => inPolygon(x, y, shape) && !holes.some((h) => inPolygon(x, y, h)));
    const step = PIX / scale, cx = all.min.x + size.x / 2;
    const locals: THREE.Vector3[] = [];
    for (let sy = all.min.y + step / 2; sy < all.max.y; sy += step)
      for (let sx = all.min.x + step / 2; sx < all.max.x; sx += step) {
        if (!inside(sx, sy)) continue;
        for (let k = 0; k < PIX_LAYERS; k++)
          locals.push(new THREE.Vector3((sx - cx) * scale, (all.max.y - sy) * scale + base, ((k + 0.5) / PIX_LAYERS - 0.5) * LOGO_DEPTH));
      }

    // 픽셀마다 가운데 QR 로고 판 위 아무 지점으로 (로고 판을 못 찾았으면 바닥 가운데로)
    const area = plateArea ?? { x: 0, z: 0, w: 6, h: 6 };
    const top = Math.max(...locals.map((v) => v.y), 1);
    pixelData = locals.map((v) => ({
      local: v, jitter: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.3),
      start: 0.02 + (v.y / top) * 0.12 + Math.random() * 0.03, // 아래쪽 픽셀부터 출발
      tx: area.x + rand(-0.4, 0.4) * area.w, tz: area.z + rand(-0.4, 0.4) * area.h,
      rx: rand(-2, 2), rz: rand(-2, 2),
    }));
    pixels = replace(pixels, new THREE.InstancedMesh(pixelGeo, pixelMat, Math.max(1, pixelData.length)));
    pixels.visible = false;
  }

  function update(dt: number) {
    const { theme, logoColor, flat } = style.current;
    const target = flat ? 1 : 0;
    t += Math.sign(target - t) * Math.min(Math.abs(target - t), dt / FOLD_SECONDS);
    const th = THEMES[theme], e = ease(t), time = performance.now() / 1000;
    if (flat && !dragging) yaw += (0 - yaw) * Math.min(1, dt * 6);
    root.rotation.y = yaw;

    if (tiles) {
      for (let i = 0; i < tileData.length; i++) {
        const g = tileData[i], p = local(t, 0.3 + g.delay * 0.6, 0.45), sc = THREE.MathUtils.lerp(0.985, 1.001, p);
        dummy.position.set(g.x, 0, g.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(sc, 1, sc);
        dummy.updateMatrix();
        tiles.setMatrixAt(i, dummy.matrix);
        tiles.setColorAt(i, tmpC.copy(g.color).lerp(cB.set("#fff"), p));
      }
      tiles.instanceMatrix.needsUpdate = true;
      tiles.instanceColor!.needsUpdate = true;
    }

    if (dots) {
      for (let i = 0; i < dotData.length; i++) {
        const g = dotData[i], p = local(t, 0.3 + g.delay * 0.6, 0.45);
        dummy.position.set(g.x, TILE_H, g.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, THREE.MathUtils.lerp(1, 0.3, p), 1);
        dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
        dots.setColorAt(i, tmpC.copy(g.color).lerp(cB.set("#000"), p));
      }
      dots.instanceMatrix.needsUpdate = true;
      dots.instanceColor!.needsUpdate = true;
    }

    const pm = local(t, 0.4, 0.5);
    markMat.color.set(MARK_COLOR).lerp(cB.set("#000"), pm);
    patternMat.color.set(PATTERN_COLOR).lerp(cB.set("#fff"), pm);

    // 가운데 QR 로고 판: 픽셀이 모이는 동안 바닥에서 통 솟아오름 (살짝 넘쳤다가 자리 잡음)
    if (plate) {
      const g = clamp01((t - 0.42) / 0.38);
      const back = g === 0 ? 0 : 1 + 2.2 * Math.pow(g - 1, 3) + 1.2 * Math.pow(g - 1, 2); // easeOutBack
      plate.visible = g > 0;
      plate.scale.set(THREE.MathUtils.lerp(0.5, 1, back), Math.max(back, 0.0001), THREE.MathUtils.lerp(0.5, 1, back));
      patternMat.opacity = local(t, 0.6, 0.25);
    }

    if (grass) {
      for (let i = 0; i < tuftData.length; i++) {
        const g = tuftData[i], p = local(t, g.delay * 0.3, 0.35);
        dummy.position.set(g.x, TILE_H + MARK_H, g.z);
        dummy.rotation.set(Math.sin(time * 1.6 + g.phase) * 0.06, g.rot, Math.cos(time * 1.3 + g.phase) * 0.06);
        dummy.scale.setScalar(Math.max(g.s * (1 - p), 0.0001));
        dummy.updateMatrix();
        grass.setMatrixAt(i, dummy.matrix);
        grass.setColorAt(i, tmpC.set(th.grass[Math.floor(g.c * th.grass.length)]));
      }
      grass.instanceMatrix.needsUpdate = true;
      grass.instanceColor!.needsUpdate = true;
    }

    const leafColor = (c: number) => tmpC.set(th.leaves[Math.floor(c * th.leaves.length)]);
    if (groundLeaves) {
      for (let i = 0; i < groundLeafData.length; i++) {
        const l = groundLeafData[i], p = local(t, ripple(l.x, l.z) * 0.3, 0.35);
        dummy.position.set(l.x, l.y, l.z);
        dummy.rotation.set(0, l.rot, 0);
        dummy.scale.setScalar(Math.max(l.s * (1 - p), 0.0001));
        dummy.updateMatrix();
        groundLeaves.setMatrixAt(i, dummy.matrix);
        groundLeaves.setColorAt(i, leafColor(l.c));
      }
      groundLeaves.instanceMatrix.needsUpdate = true;
      groundLeaves.instanceColor!.needsUpdate = true;
    }

    if (fallingLeaves) {
      const spread = G / 2 - 1, fade = 1 - local(t, 0, 0.3);
      for (let i = 0; i < fallingData.length; i++) {
        const l = fallingData[i];
        l.y -= l.speed * dt;
        if (l.y < 0.2) { l.y = G * rand(0.8, 1.1); l.x = rand(-spread, spread); l.z = rand(-spread, spread); }
        dummy.position.set(l.x + Math.sin(time * 1.2 + l.phase) * 0.8, l.y, l.z + Math.cos(time + l.phase) * 0.5);
        dummy.rotation.set(Math.sin(time * 2 + l.phase) * 0.9, l.rot + time * 0.6, Math.cos(time * 1.7 + l.phase) * 0.7);
        dummy.scale.setScalar(Math.max(l.s * fade, 0.0001));
        dummy.updateMatrix();
        fallingLeaves.setMatrixAt(i, dummy.matrix);
        fallingLeaves.setColorAt(i, leafColor(l.c));
      }
      fallingLeaves.instanceMatrix.needsUpdate = true;
      fallingLeaves.instanceColor!.needsUpdate = true;
    }

    logoMat.color.set(logoColor);
    logo.position.y = Math.sin(time * 1.5) * 0.15 * (1 - e);
    logo.updateMatrix();

    // 로고 메시와 같은 자리의 픽셀을 LOGO_FADE 동안 겹쳐서 서서히 바꿈 (되돌아올 땐 반대로)
    const broken = t > 0.001 && pixelData.length > 0;
    logo.visible = !broken || t < LOGO_FADE;
    logoMat.opacity = broken ? 1 - clamp01(t / LOGO_FADE) : 1;
    if (pixels) pixels.visible = broken;
    if (pixels && broken) {
      const base = cB.set(logoColor).clone();
      for (let i = 0; i < pixelData.length; i++) {
        const px = pixelData[i], p = clamp01((t - px.start) / PIX_FLY), pe = ease(p);
        // 출발 전까지 계속 조금씩 벌어지다가 출발 순간 그대로 이어서 날아감 → 멈춘 구간이 없음
        const crack = ease(clamp01(t / px.start));
        if (p >= 1) {
          dummy.scale.setScalar(0.0001); // 내려앉으면 로고 판이 이어받음
        } else {
          tmpV.copy(px.local).addScaledVector(px.jitter, crack).applyMatrix4(logo.matrix);
          const ty = TILE_H + MARK_H * 0.5;
          // 수평은 부드럽게, 수직은 중력처럼 점점 빠르게 + 살짝 포물선
          dummy.position.set(
            THREE.MathUtils.lerp(tmpV.x, px.tx, pe),
            THREE.MathUtils.lerp(tmpV.y, ty, p * p) + Math.sin(p * Math.PI) * 1.2,
            THREE.MathUtils.lerp(tmpV.z, px.tz, pe),
          );
          dummy.rotation.set(px.rx * Math.sin(p * Math.PI), (Math.PI / 4) * (1 - pe), px.rz * Math.sin(p * Math.PI));
          const edge = PIX * THREE.MathUtils.lerp(1, 0.9, crack); // 처음엔 틈 없이 로고처럼
          dummy.scale.set(
            THREE.MathUtils.lerp(edge, PIX * 0.5, pe),
            THREE.MathUtils.lerp(edge, 0.05, pe),
            THREE.MathUtils.lerp((LOGO_DEPTH / PIX_LAYERS) * THREE.MathUtils.lerp(1, 0.9, crack), PIX * 0.5, pe),
          );
        }
        dummy.updateMatrix();
        pixels.setMatrixAt(i, dummy.matrix);
        pixels.setColorAt(i, tmpC.copy(base).lerp(markMat.color, pe));
      }
      pixels.instanceMatrix.needsUpdate = true;
      if (pixels.instanceColor) pixels.instanceColor.needsUpdate = true;
    }

    // 평면 상태에선 방향광을 줄여서 흑백이 또렷하게
    sun.intensity = 2.2 * (1 - e);
    hemi.intensity = THREE.MathUtils.lerp(1.3, 3.2, e);

    // 카메라는 로고가 부서지는 걸 3D로 보여준 뒤 따라 내려옴
    const ec = local(t, 0.12, 0.88);
    camera.position.copy(dir.copy(DIR_TREE).lerp(DIR_FLAT, ec).normalize().multiplyScalar(200));
    camera.up.copy(up.copy(UP_TREE).lerp(UP_FLAT, ec).normalize());
    camera.lookAt(0, THREE.MathUtils.lerp(G * 0.18, 0, ec), 0);
    const frame = G * THREE.MathUtils.lerp(1.45, FLAT_FRAME, ec);
    const w = canvas.clientWidth, h = canvas.clientHeight, a = w / h;
    const hh = a >= 1 ? frame / 2 : frame / 2 / a, hw = hh * a;
    camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
    camera.updateProjectionMatrix();
    return t;
  }

  return {
    buildGround,
    buildLogo,
    update,
    resize: () => renderer.setSize(canvas.clientWidth, canvas.clientHeight, false),
    render: () => G > 0 && renderer.render(scene, camera),
    setDragging: (v: boolean) => { dragging = v; },
    rotate: (dx: number) => { if (!style.current.flat) yaw += dx * 0.01; },
    dispose: () => {
      for (const m of [tiles, dots, pixels, grass, groundLeaves, fallingLeaves]) m?.dispose();
      for (const c of marks.children) (c as THREE.Mesh).geometry.dispose();
      patternMat.map?.dispose();
      for (const g of [tileGeo, dotGeo, tuftGeo, leafGeo, slab.geometry]) g.dispose();
      for (const m of [tileMat, dotMat, markMat, patternMat, grassMat, leafMat, logoMat, slab.material as THREE.Material]) m.dispose();
      for (const m of parts) m.geometry.dispose();
      pixelGeo.dispose();
      pixelMat.dispose();
      renderer.dispose();
    },
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LogoQR() {
  const stageRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const styleRef = useRef<SceneStyle>({ theme: "autumn", logoColor: DEFAULT_LOGO_COLOR, flat: false });

  const [qrSrc, setQrSrc] = useState(DEFAULT_QR_SRC);
  const [logoKey, setLogoKey] = useState<LogoKey>("gu");
  const [svg, setSvg] = useState("");
  const [theme, setTheme] = useState<ThemeKey>("autumn");
  const [logoColor, setLogoColor] = useState(DEFAULT_LOGO_COLOR);
  const [flat, setFlat] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [qrPx, setQrPx] = useState(0);
  const [restored, setRestored] = useState(false); // 주소창 값을 읽기 전엔 주소창을 덮어쓰지 않음

  useEffect(() => {
    styleRef.current = { theme, logoColor, flat };
  }, [theme, logoColor, flat]);

  // 공유 링크(?theme=&c=)에서 초기값 복원
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const th = q.get("theme"), c = q.get("c");
    if (th && th in THEMES) setTheme(th as ThemeKey);
    if (c && /^[0-9a-f]{6}$/i.test(c)) setLogoColor("#" + c);
    const lg = q.get("logo");
    if (lg && lg in LOGOS) setLogoKey(lg as LogoKey);
    if (q.get("view") === "qr") setFlat(true);
    setRestored(true);
  }, []);

  // three.js 씬 + 렌더 루프
  useEffect(() => {
    const canvas = stageRef.current!;
    const s = createScene(canvas, styleRef);
    sceneRef.current = s;
    const onResize = () => {
      s.resize();
      setQrPx(Math.min(canvas.clientWidth, canvas.clientHeight) / FLAT_FRAME);
    };
    onResize();
    window.addEventListener("resize", onResize);
    let last = performance.now(), raf = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = s.update(dt);
      s.render();
      // 다 접히기 직전부터 원본 QR을 부드럽게 겹침 (스캔용)
      if (qrRef.current) qrRef.current.style.opacity = String(THREE.MathUtils.smoothstep(t, 0.88, 1));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      s.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 선택한 로고 SVG 불러오기
  useEffect(() => {
    let cancelled = false;
    fetch(LOGOS[logoKey].src)
      .then((r) => { if (!r.ok) throw new Error(`로고 파일을 불러오지 못했어요 (${LOGOS[logoKey].src})`); return r.text(); })
      .then((text) => { if (!cancelled) setSvg(text); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [logoKey]);

  // QR 이미지·SVG가 바뀌면 바닥과 로고 다시 만들기 (로고 크기가 바닥 크기를 따라감)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!svg) return;
      try {
        const qr = await loadQR(qrSrc);
        if (cancelled || !sceneRef.current) return;
        sceneRef.current.buildGround(qr);
        sceneRef.current.buildLogo(svg);
        if (qrRef.current) drawQR(qrRef.current, qr);
        setError("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [qrSrc, svg]);

  // 현재 설정을 주소창에 반영 (공유용)
  useEffect(() => {
    if (!restored) return;
    const q = new URLSearchParams({ logo: logoKey, theme, c: logoColor.slice(1) });
    window.history.replaceState(null, "", "?" + q);
  }, [restored, logoKey, theme, logoColor]);

  const drag = useRef({ x: 0, moved: 0, down: false });

  const onQrFile = (f: File | undefined) => {
    if (!f) return;
    setFlat(false);
    setQrSrc((prev) => {
      if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  // SVG 직접 올리기 — 버튼과 함께 주석 처리 (로고는 아래 select로 선택)
  // const onSvgFile = async (f: File | undefined) => {
  //   if (!f) return;
  //   setFlat(false);
  //   setSvg(await f.text());
  // };

  const download = () => {
    if (!qrRef.current) return;
    const a = document.createElement("a");
    a.download = "qr.png";
    a.href = qrRef.current.toDataURL("image/png");
    a.click();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("복사됨!");
    } catch {
      setCopied("복사 실패");
    }
    setTimeout(() => setCopied(""), 1500);
  };

  const btn = "px-3 py-2.5 bg-white border-[1.5px] border-[#F0EDE8] rounded-xl text-sm font-semibold transition-colors hover:border-[#C5856A] active:scale-[0.98]";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#FDFCFB] text-[#1d1d1f]">
      <canvas
        ref={stageRef}
        className="absolute inset-0 w-full h-full block cursor-pointer touch-none"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, moved: 0, down: true };
          sceneRef.current?.setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current.down) return;
          const dx = e.clientX - drag.current.x;
          drag.current.x = e.clientX;
          drag.current.moved += Math.abs(dx);
          sceneRef.current?.rotate(dx);
        }}
        onPointerUp={() => {
          drag.current.down = false;
          sceneRef.current?.setDragging(false);
          if (drag.current.moved < 6) setFlat((f) => !f);
        }}
      />

      {/* 원본 QR 이미지 — 불투명도는 렌더 루프가 접힘 진행도에 맞춰 직접 조절 */}
      <canvas
        ref={qrRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0"
        style={{ width: qrPx, height: qrPx }}
      />

      <p className="absolute top-5 inset-x-0 text-center text-sm text-[#8E8E93] pointer-events-none">
        {flat ? "다시 탭하면 로고로 돌아가요" : "로고를 탭하면 QR 코드로 접혀요 · 드래그로 회전"}
      </p>

      <div
        className={`absolute inset-x-4 bottom-4 mx-auto max-w-[640px] bg-white/85 backdrop-blur-md rounded-2xl p-3 flex flex-wrap gap-2 shadow-[0_6px_24px_rgba(0,0,0,0.08)] transition-all duration-300 ${
          flat ? "opacity-0 translate-y-5 pointer-events-none" : ""
        }`}
      >
        <input
          type="color"
          value={logoColor}
          onChange={(e) => setLogoColor(e.target.value)}
          title="로고 색"
          className="w-11 h-[42px] p-1 bg-white border-[1.5px] border-[#F0EDE8] rounded-xl cursor-pointer"
        />
        <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} className={btn}>
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
            <option key={k} value={k}>{THEMES[k].label}</option>
          ))}
        </select>
        <label className={`${btn} cursor-pointer`}>
          QR 변경
          <input type="file" accept="image/*" hidden onChange={(e) => onQrFile(e.target.files?.[0])} />
        </label>
        <select
          value={logoKey}
          onChange={(e) => { setFlat(false); setLogoKey(e.target.value as LogoKey); }}
          title="로고"
          className={btn}
        >
          {(Object.keys(LOGOS) as LogoKey[]).map((k) => (
            <option key={k} value={k}>{LOGOS[k].label}</option>
          ))}
        </select>
        {/* <label className={`${btn} cursor-pointer`}>
          SVG 변경
          <input type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => onSvgFile(e.target.files?.[0])} />
        </label> */}
        <button onClick={download} className={btn}>QR 저장</button>
        <button onClick={copyLink} className={btn}>{copied || "링크 복사"}</button>
        {error && <p className="w-full text-[13px] text-[#c0392b]">{error}</p>}
      </div>
    </div>
  );
}
