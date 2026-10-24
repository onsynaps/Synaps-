import * as THREE from "three";

export type CoreState = { scatter: number; zoom: number; fade: number };

/** The Synaps "core": a breathing particle sphere, two particle orbits and neural filaments with travelling sparks. */
export function createCore(canvas: HTMLCanvasElement, state: CoreState, reduce: boolean) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch {
    return { dispose() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 6;
  const group = new THREE.Group();
  scene.add(group);

  const uniforms = { uTime: { value: 0 }, uScatter: { value: 0 }, uPx: { value: renderer.getPixelRatio() } };
  const vs = `
    attribute float aRand; attribute vec3 aColor;
    uniform float uTime; uniform float uScatter; uniform float uPx;
    varying vec3 vColor; varying float vA;
    void main(){
      vec3 p = position;
      float n = sin(p.x*3.0+uTime*0.9+aRand*6.0)*0.04 + cos(p.y*2.5+uTime*0.7)*0.04;
      p += normalize(p)*(n + uScatter*(0.6+aRand*2.4));
      vec4 mv = modelViewMatrix*vec4(p,1.0);
      gl_PointSize = (1.6+aRand*2.6)*uPx*(6.0/-mv.z);
      gl_Position = projectionMatrix*mv;
      vColor = aColor; vA = 0.55+aRand*0.45;
    }`;
  const fs = `
    varying vec3 vColor; varying float vA;
    void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vColor, a*vA); }`;
  const mat = () =>
    new THREE.ShaderMaterial({ uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  const cV = new THREE.Color("#A594FF");
  const cC = new THREE.Color("#6FE3F0");
  const cW = new THREE.Color("#F1EFF8");
  const small = window.innerWidth < 700;

  const pointsFrom = (pos: Float32Array, rnd: Float32Array, col: Float32Array) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, mat());
  };

  // sphere
  const N = small ? 1400 : 2400;
  const pos = new Float32Array(N * 3), rnd = new Float32Array(N), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996323;
    const rad = 1.15 + (Math.random() - 0.5) * 0.18;
    pos[i * 3] = Math.cos(th) * r * rad; pos[i * 3 + 1] = y * rad; pos[i * 3 + 2] = Math.sin(th) * r * rad;
    rnd[i] = Math.random();
    let c = cV.clone().lerp(cC, Math.random() * 0.6);
    if (Math.random() < 0.12) c = cW;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const core = pointsFrom(pos, rnd, col);
  group.add(core);

  const ring = (R: number, tube: number, count: number, tint: THREE.Color) => {
    const p = new Float32Array(count * 3), rr = new Float32Array(count), cc = new Float32Array(count * 3);
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, t = (Math.random() - 0.5) * tube;
      p[k * 3] = Math.cos(a) * (R + t); p[k * 3 + 1] = (Math.random() - 0.5) * tube * 0.6; p[k * 3 + 2] = Math.sin(a) * (R + t);
      rr[k] = Math.random() * 0.6;
      const c2 = tint.clone().lerp(cW, Math.random() * 0.4);
      cc[k * 3] = c2.r; cc[k * 3 + 1] = c2.g; cc[k * 3 + 2] = c2.b;
    }
    return pointsFrom(p, rr, cc);
  };
  const r1 = ring(2.55, 0.35, small ? 900 : 1600, cV); r1.rotation.x = 1.32; r1.rotation.z = 0.2; group.add(r1);
  const r2 = ring(3.1, 0.12, small ? 500 : 900, cC); r2.rotation.x = 1.25; r2.rotation.z = -0.35; group.add(r2);

  // filaments + sparks
  const lineMat = new THREE.LineBasicMaterial({ color: 0xa594ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
  const arcs: { curve: THREE.QuadraticBezierCurve3; t: number; s: number }[] = [];
  for (let j = 0; j < 14; j++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const end = dir.clone().multiplyScalar(2.2 + Math.random() * 0.9);
    const mid = dir.clone().multiplyScalar(1.4).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2));
    const curve = new THREE.QuadraticBezierCurve3(dir.clone().multiplyScalar(1.1), mid, end);
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMat));
    arcs.push({ curve, t: Math.random(), s: 0.12 + Math.random() * 0.25 });
  }
  const sp = new Float32Array(arcs.length * 3), sr = new Float32Array(arcs.length).fill(1), sc = new Float32Array(arcs.length * 3);
  arcs.forEach((_, m) => { const c = m % 2 ? cC : cW; sc[m * 3] = c.r; sc[m * 3 + 1] = c.g; sc[m * 3 + 2] = c.b; });
  const sparks = pointsFrom(sp, sr, sc);
  group.add(sparks);

  const mouse = { x: 0, y: 0 };
  const onMove = (e: PointerEvent) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5; };
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    group.scale.setScalar(w < 700 ? 0.72 : 1);
  };
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove, { passive: true });

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    uniforms.uScatter.value = state.scatter;
    if (!reduce) {
      core.rotation.y = t * 0.08; r1.rotation.y = t * 0.05; r2.rotation.y = -t * 0.035;
      const sa = sparks.geometry.attributes.position.array as Float32Array;
      arcs.forEach((a, q) => {
        a.t = (a.t + a.s * 0.016) % 1;
        const v = a.curve.getPoint(a.t);
        sa[q * 3] = v.x; sa[q * 3 + 1] = v.y; sa[q * 3 + 2] = v.z;
      });
      sparks.geometry.attributes.position.needsUpdate = true;
    }
    group.rotation.x += (-mouse.y * 0.35 - group.rotation.x) * 0.04;
    group.rotation.y += (mouse.x * 0.5 - group.rotation.y) * 0.04;
    camera.position.z += (state.zoom - camera.position.z) * 0.08;
    canvas.style.opacity = String(state.fade);
    renderer.render(scene, camera);
    if (!reduce) raf = requestAnimationFrame(frame);
  };
  frame();

  return {
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      renderer.dispose();
    },
  };
}
