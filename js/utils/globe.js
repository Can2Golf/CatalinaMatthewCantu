// Three.js globe — sphere, atmosphere, story markers (3 idle pulse rings each),
// connecting arcs with a traveling comet on each, hover spotlight, click
// explosion + camera rush.

import * as THREE from 'three';
import gsap from 'gsap';
import { buildMapCanvas, latLngToVec3 } from './dots.js';

const SPHERE_RADIUS = 1;
const MARKER_RADIUS = 0.018;
const PIN_HEIGHT    = 0.04;

export class Globe {
  constructor(container, storyPoints, handlers = {}) {
    this.container = container;
    this.storyPoints = storyPoints;
    this.handlers = handlers;

    this.markers = [];
    this.arcs = [];
    this._comets = [];

    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._hovered = null;
    this._autoRotate = true;
    this._disposed = false;
    this._reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this._init();
  }

  _init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    // Cap pixel ratio at 1.5 — full DPR doubles GPU pixels for marginal gain
    // and is the single biggest cause of jank on the globe.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 2.8);

    const ambient = new THREE.AmbientLight(0x6b8db5, 0.7);
    this.scene.add(ambient);
    const point = new THREE.PointLight(0xf0c878, 1.6, 0, 1);
    point.position.set(-2, 2, 3);
    this.scene.add(point);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    // Globe sphere
    const mapCanvas = buildMapCanvas();
    const mapTex = new THREE.CanvasTexture(mapCanvas);
    mapTex.colorSpace = THREE.SRGBColorSpace;
    mapTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy?.() ?? 4;

    const sphereGeo = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({
      map: mapTex,
      emissive: new THREE.Color(0x0a1f40),
      emissiveIntensity: 0.6,
      shininess: 18,
      specular: new THREE.Color(0x4a6f99)
    });
    this.sphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.world.add(this.sphere);
    this._mapTexture = mapTex;

    // Atmosphere
    const atmoGeo = new THREE.SphereGeometry(SPHERE_RADIUS * 1.02, 64, 64);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: 0x6fa8ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    this.atmosphere = new THREE.Mesh(atmoGeo, atmoMat);
    this.scene.add(this.atmosphere);

    // Outer halo
    const haloGeo = new THREE.SphereGeometry(SPHERE_RADIUS * 1.15, 64, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x4a8fff,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide
    });
    this.halo = new THREE.Mesh(haloGeo, haloMat);
    this.scene.add(this.halo);

    // Shockwave ring used for the entrance burst (lives in scene, not world)
    this._buildShockwaveRing();

    this._addMarkers();
    this._addArcs();
    this._addArcComets();
    this._bindEvents();

    this._clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    this.renderer.setAnimationLoop(this._animate);

    // Start hidden — entrance animation will scale it up
    this.world.scale.setScalar(this._reduced ? 1 : 0.001);
    this.atmosphere.scale.setScalar(this._reduced ? 1 : 0.001);
    this.halo.scale.setScalar(this._reduced ? 1 : 0.001);
  }

  /* ============================ ENTRANCE ============================ */

  _buildShockwaveRing() {
    const geo = new THREE.RingGeometry(0.02, 0.024, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf0c878,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this._shockwave = new THREE.Mesh(geo, mat);
    this._shockwave.position.set(0, 0, 0);
    this.scene.add(this._shockwave);
  }

  /**
   * Plays the cinematic entrance: world expands from a tiny point, atmosphere
   * pulses once, shockwave ring expands and fades. Returns a GSAP timeline.
   */
  playEntrance() {
    if (this._reduced) return gsap.timeline();
    const tl = gsap.timeline();

    // Expand world + atmosphere + halo
    tl.to(this.world.scale,      { x: 1, y: 1, z: 1, duration: 1.4, ease: 'power3.out' }, 0)
      .to(this.atmosphere.scale, { x: 1, y: 1, z: 1, duration: 1.4, ease: 'power3.out' }, 0)
      .to(this.halo.scale,       { x: 1, y: 1, z: 1, duration: 1.4, ease: 'power3.out' }, 0);

    // One-shot shockwave ring expanding
    tl.to(this._shockwave.material, { opacity: 0.85, duration: 0.25, ease: 'power2.out' }, 0.15)
      .to(this._shockwave.scale,    { x: 60, y: 60, z: 60, duration: 1.2, ease: 'power2.out' }, 0.15)
      .to(this._shockwave.material, { opacity: 0, duration: 0.9, ease: 'power2.in' }, 0.45);

    // Atmosphere pulse — flash brighter then settle
    tl.to(this.atmosphere.material, { opacity: 0.28, duration: 0.4, ease: 'power2.out' }, 0.4)
      .to(this.atmosphere.material, { opacity: 0.08, duration: 0.9, ease: 'power2.in' }, 0.85);

    return tl;
  }

  /* ============================ MARKERS ============================ */

  _addMarkers() {
    this.storyPoints.forEach((point, idx) => {
      const pos = latLngToVec3(point.lat, point.lng, SPHERE_RADIUS + 0.005);
      const colorHex = new THREE.Color(point.color || '#f0c878');

      const group = new THREE.Group();
      group.position.set(pos.x, pos.y, pos.z);
      group.lookAt(0, 0, 0);
      group.rotateY(Math.PI);

      // Core
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(MARKER_RADIUS, 24, 24),
        new THREE.MeshBasicMaterial({ color: colorHex })
      );
      core.userData.point = point;
      core.userData.kind = 'marker';
      group.add(core);

      // Bloom shell — additive, scales up on hover
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(MARKER_RADIUS * 1.6, 16, 16),
        new THREE.MeshBasicMaterial({
          color: colorHex, transparent: true, opacity: 0.28,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      group.add(bloom);

      // Three concentric pulse rings — radar ping look
      const pulses = [];
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(MARKER_RADIUS * 1.05, MARKER_RADIUS * 1.18, 32),
          new THREE.MeshBasicMaterial({
            color: colorHex, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            depthWrite: false
          })
        );
        // Orient ring perpendicular to surface (face outward)
        ring.position.z = -0.001;     // slightly inside for stable z-order
        group.add(ring);
        pulses.push(ring);
      }

      // Vertical pin
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0009, 0.0009, PIN_HEIGHT, 6),
        new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.55 })
      );
      pin.rotation.x = Math.PI / 2;
      pin.position.z = -PIN_HEIGHT / 2;
      group.add(pin);

      // Start hidden + tiny — shooting-star arrival animates them in
      group.scale.setScalar(0);

      this.world.add(group);
      this.markers.push({ point, mesh: core, bloom, pulses, group, idx });

      // Continuous radar ping loops (3 rings staggered)
      if (!this._reduced) {
        pulses.forEach((ring, k) => {
          const tl = gsap.timeline({ repeat: -1, delay: k * 0.6 + idx * 0.15 });
          tl.set(ring.scale, { x: 0.6, y: 0.6, z: 1 })
            .set(ring.material, { opacity: 0.65 })
            .to(ring.scale,    { x: 4, y: 4, duration: 1.8, ease: 'power1.out' }, 0)
            .to(ring.material, { opacity: 0, duration: 1.8, ease: 'power1.out' }, 0);
        });
      } else {
        pulses[0].material.opacity = 0.4;
        pulses[0].scale.setScalar(1.5);
      }
    });
  }

  /**
   * Animate each marker arriving like a shooting star — a streak from off-globe
   * to the marker position, then the marker pops in with a shockwave.
   */
  revealMarkers(opts = {}) {
    const { onComplete } = opts;
    const tl = gsap.timeline({ onComplete });

    this.markers.forEach((m, i) => {
      const start = i * 0.6;
      const surfacePos = latLngToVec3(m.point.lat, m.point.lng, SPHERE_RADIUS + 0.005);
      const startPos = latLngToVec3(m.point.lat, m.point.lng, SPHERE_RADIUS + 0.7);

      // Build a brief streak (small glowing line) for the shooting star
      if (!this._reduced) {
        const colorHex = new THREE.Color(m.point.color || '#f0c878');
        const geom = new THREE.BufferGeometry();
        const pos = new Float32Array([
          startPos.x, startPos.y, startPos.z,
          surfacePos.x, surfacePos.y, surfacePos.z
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const lineMat = new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending
        });
        const streak = new THREE.Line(geom, lineMat);
        this.world.add(streak);

        // Streak: 0 -> 1 -> 0 quickly, then dispose
        tl.to(lineMat, { opacity: 1, duration: 0.18, ease: 'power2.out' }, start)
          .to(lineMat, { opacity: 0, duration: 0.35, ease: 'power2.in' }, start + 0.18)
          .add(() => { streak.geometry.dispose(); streak.material.dispose(); this.world.remove(streak); }, start + 0.6);
      }

      // Marker pop-in with overshoot
      tl.to(m.group.scale, {
        x: 1, y: 1, z: 1,
        duration: 0.55,
        ease: 'back.out(2.4)'
      }, start + 0.45);

      // Shockwave ring at marker landing
      if (!this._reduced) {
        const ringGeo = new THREE.RingGeometry(MARKER_RADIUS * 1.1, MARKER_RADIUS * 1.35, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(m.point.color || '#f0c878'),
          transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(surfacePos.x, surfacePos.y, surfacePos.z);
        ring.lookAt(0, 0, 0);
        this.world.add(ring);
        tl.fromTo(ringMat, { opacity: 0.95 }, { opacity: 0, duration: 1.0, ease: 'power2.out' }, start + 0.5)
          .fromTo(ring.scale, { x: 0.4, y: 0.4, z: 1 }, { x: 6, y: 6, z: 1, duration: 1.0, ease: 'power2.out' }, start + 0.5)
          .add(() => { ringGeo.dispose(); ringMat.dispose(); this.world.remove(ring); }, start + 1.6);
      }
    });

    // Animate arcs in *after* all markers landed
    const arcStart = this.markers.length * 0.6 + 0.5;
    this.arcs.forEach((a, i) => {
      tl.to(a.uniforms.uProgress, {
        value: 1,
        duration: 1.2,
        ease: 'power2.inOut'
      }, arcStart + i * 0.4);
    });

    return tl;
  }

  /* ============================ ARCS + COMETS ============================ */

  _addArcs() {
    for (let i = 0; i < this.storyPoints.length - 1; i++) {
      const a = this.storyPoints[i];
      const b = this.storyPoints[i + 1];
      const arc = this._createArc(a, b);
      this.arcs.push(arc);
      this.world.add(arc.mesh);
    }
  }

  _createArc(a, b) {
    const start = latLngToVec3(a.lat, a.lng, SPHERE_RADIUS);
    const end   = latLngToVec3(b.lat, b.lng, SPHERE_RADIUS);
    const v1 = new THREE.Vector3(start.x, start.y, start.z);
    const v2 = new THREE.Vector3(end.x, end.y, end.z);
    const distance = v1.distanceTo(v2);

    const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const lift = SPHERE_RADIUS + Math.min(0.6, 0.18 + distance * 0.4);
    mid.normalize().multiplyScalar(lift);

    const ctrlA = new THREE.Vector3().lerpVectors(v1, mid, 0.5).normalize().multiplyScalar(SPHERE_RADIUS + (lift - SPHERE_RADIUS) * 0.7);
    const ctrlB = new THREE.Vector3().lerpVectors(mid, v2, 0.5).normalize().multiplyScalar(SPHERE_RADIUS + (lift - SPHERE_RADIUS) * 0.7);

    const curve = new THREE.CatmullRomCurve3([v1, ctrlA, mid, ctrlB, v2]);
    const tubeGeo = new THREE.TubeGeometry(curve, 80, 0.0035, 8, false);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uColor:    { value: new THREE.Color(0xd4a853) }
      },
      vertexShader: `
        varying float vU;
        void main() {
          vU = uv.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vU;
        uniform float uProgress;
        uniform vec3  uColor;
        void main() {
          if (vU > uProgress) discard;
          float edge = smoothstep(uProgress - 0.06, uProgress, vU);
          vec3 c = mix(uColor, vec3(1.0, 0.92, 0.7), edge * 0.35);
          gl_FragColor = vec4(c, 0.85);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(tubeGeo, mat);
    return { mesh, material: mat, uniforms: mat.uniforms, curve };
  }

  /**
   * For each arc, attach a small bright sphere that races along the curve.
   * Re-trips every 6s. When `uProgress` of the arc hits 1, the comet starts.
   */
  _addArcComets() {
    this.arcs.forEach((a, idx) => {
      const cometMat = new THREE.MeshBasicMaterial({
        color: 0xffeec0,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const comet = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 16), cometMat);
      this.world.add(comet);
      // Trail — line geometry that updates each frame
      const trailGeom = new THREE.BufferGeometry();
      const trailLen = 14;
      trailGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailLen * 3), 3));
      const trailMat = new THREE.LineBasicMaterial({
        color: 0xffeec0, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      const trail = new THREE.Line(trailGeom, trailMat);
      this.world.add(trail);

      const state = {
        comet, trail, trailGeom, trailLen,
        history: [],
        progress: 0,
        active: false,
        delay: idx * 1.5
      };
      this._comets.push(state);
    });

    if (!this._reduced) {
      // Start comet loop after arcs have drawn
      const totalDelay = this.markers.length * 0.6 + 1.8;
      setTimeout(() => this._startComets(), totalDelay * 1000);
    }
  }

  _startComets() {
    this._comets.forEach((c, i) => {
      // Stagger initial start by delay
      setTimeout(() => this._loopComet(c), c.delay * 1000);
    });
  }
  _loopComet(c) {
    if (this._disposed) return;
    c.active = true;
    c.progress = 0;
    c.comet.material.opacity = 1;
    gsap.to(c, {
      progress: 1,
      duration: 2.4,
      ease: 'power1.inOut',
      onUpdate: () => {
        const arc = this.arcs[this._comets.indexOf(c)];
        if (!arc?.curve) return;
        const p = arc.curve.getPointAt(Math.min(0.999, Math.max(0.001, c.progress)));
        c.comet.position.copy(p);
        // History trail
        c.history.unshift(p.clone());
        if (c.history.length > c.trailLen) c.history.length = c.trailLen;
        const arr = c.trailGeom.attributes.position.array;
        for (let k = 0; k < c.trailLen; k++) {
          const pt = c.history[k] || p;
          arr[k * 3]     = pt.x;
          arr[k * 3 + 1] = pt.y;
          arr[k * 3 + 2] = pt.z;
        }
        c.trailGeom.attributes.position.needsUpdate = true;
      },
      onComplete: () => {
        c.active = false;
        c.history.length = 0;
        gsap.to(c.comet.material, { opacity: 0, duration: 0.3 });
        // Loop again every 6s
        setTimeout(() => this._loopComet(c), 3600);
      }
    });
  }

  /* ============================ INTERACTION ============================ */

  _bindEvents() {
    this._onPointerMove = (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this._pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      this._lastClient = { x: e.clientX, y: e.clientY };
    };
    this._onClick = () => {
      if (this._hovered) {
        this.handlers.onMarkerClick?.(this._hovered.point, this._hovered);
      }
    };
    this._onResize = () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    this.renderer.domElement.addEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.addEventListener('click', this._onClick);
    window.addEventListener('resize', this._onResize);
  }

  _animate() {
    if (this._disposed) return;
    const delta = this._clock.getDelta();

    if (this._autoRotate && !this._reduced) {
      this.world.rotation.y += 0.0012 * 60 * delta;
    }

    // Hover detection
    this._raycaster.setFromCamera(this._pointer, this.camera);
    const hits = this._raycaster.intersectObjects(this.markers.map(m => m.mesh));
    const hit = hits[0]?.object;

    if (hit !== this._hovered?.mesh) {
      // Leave previous
      if (this._hovered) {
        this._unhover(this._hovered);
        this._hovered = null;
        this.handlers.onMarkerLeave?.();
      }
      // Enter new
      if (hit) {
        const m = this.markers.find(mm => mm.mesh === hit);
        if (m) {
          this._hovered = m;
          this._hover(m);
          this.renderer.domElement.style.cursor = 'pointer';
          this.handlers.onMarkerHover?.(m.point, this._lastClient);
          this._autoRotate = false;
          return;
        }
      }
      this.renderer.domElement.style.cursor = '';
      this._autoRotate = true;
    } else if (this._hovered) {
      this.handlers.onMarkerHover?.(this._hovered.point, this._lastClient);
    }

    this.renderer.render(this.scene, this.camera);
  }

  _hover(m) {
    gsap.to(m.group.scale, { x: 3, y: 3, z: 3, duration: 0.45, ease: 'back.out(2.2)' });
    // Bloom amped up
    gsap.to(m.bloom.material, { opacity: 0.7, duration: 0.4 });
    // Speed up pulses 2x by re-issuing tweens — simpler: tween timeScale of any active gsap timeline
    // Instead, just scale them larger so they read as faster ripples
    m.pulses.forEach(p => {
      gsap.to(p.scale, { x: 6, y: 6, duration: 0.4, ease: 'power2.out' });
    });
  }

  _unhover(m) {
    gsap.to(m.group.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' });
    gsap.to(m.bloom.material, { opacity: 0.28, duration: 0.4 });
    m.pulses.forEach(p => {
      gsap.to(p.scale, { x: 4, y: 4, duration: 0.4, ease: 'power2.out' });
    });
  }

  /* ============================ FOCUS / RUSH ============================ */

  /**
   * Spin to face the point quickly, rush the camera in, optionally explode
   * the marker as a confetti of gold particles.
   */
  focusOn(point, { duration = 0.6, zoomTo = 1.4, explode = false } = {}) {
    const m = this.markers.find(mm => mm.point === point);
    const { x, y, z } = latLngToVec3(point.lat, point.lng, 1);
    const targetY = Math.atan2(x, z);
    const targetX = -Math.asin(y);

    this._autoRotate = false;
    const tl = gsap.timeline();

    tl.to(this.world.rotation, {
      x: targetX, y: targetY,
      duration,
      ease: 'power3.out'
    }, 0);

    tl.to(this.camera.position, {
      z: zoomTo,
      duration: 1.0,
      ease: 'power2.inOut'
    }, 0);

    if (explode && m && !this._reduced) {
      tl.add(() => this._explodeMarker(m), duration * 0.4);
    }

    return tl;
  }

  /** Pull the camera back to its idle position. */
  resetCamera(duration = 1.0) {
    return gsap.to(this.camera.position, {
      z: 2.8,
      duration,
      ease: 'power2.out',
      onComplete: () => { this._autoRotate = true; }
    });
  }
  resumeAutoRotate() { this._autoRotate = true; }

  /**
   * Stop the render loop and pause every continuous GSAP timeline (marker
   * pulses, arc comets). Use when the globe section is off-screen so the
   * GPU and main thread are free for scroll work elsewhere.
   */
  pause() {
    if (this._paused || this._disposed) return;
    this._paused = true;
    this.renderer.setAnimationLoop(null);
    // Pause every running gsap tween that's targeting one of our objects
    this.scene.traverse(obj => {
      if (obj.material) gsap.getTweensOf(obj.material).forEach(t => t.pause());
      gsap.getTweensOf(obj.scale).forEach(t => t.pause());
      gsap.getTweensOf(obj).forEach(t => t.pause());
    });
  }
  resume() {
    if (!this._paused || this._disposed) return;
    this._paused = false;
    this.renderer.setAnimationLoop(this._animate);
    this.scene.traverse(obj => {
      if (obj.material) gsap.getTweensOf(obj.material).forEach(t => t.resume());
      gsap.getTweensOf(obj.scale).forEach(t => t.resume());
      gsap.getTweensOf(obj).forEach(t => t.resume());
    });
  }

  flashMarker(point) {
    const m = this.markers.find(mm => mm.point === point);
    if (!m) return;
    const orig = m.point.color ? new THREE.Color(m.point.color) : new THREE.Color(0xf0c878);
    gsap.fromTo(m.mesh.material.color,
      { r: 1, g: 1, b: 1 },
      { r: orig.r, g: orig.g, b: orig.b, duration: 0.8, ease: 'power2.out' }
    );
  }

  /** Burst gold particles outward from a marker on click. */
  _explodeMarker(m) {
    const COUNT = 24;
    const colorHex = new THREE.Color(m.point.color || '#f0c878');
    const surfaceVec = m.group.position.clone();

    const particles = [];
    for (let i = 0; i < COUNT; i++) {
      const geo = new THREE.SphereGeometry(0.005 + Math.random() * 0.004, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(surfaceVec);
      this.world.add(p);

      // Random outward direction relative to surface normal
      const normal = surfaceVec.clone().normalize();
      const random = new THREE.Vector3(
        (Math.random() - 0.5),
        (Math.random() - 0.5),
        (Math.random() - 0.5)
      ).normalize();
      const blend = normal.clone().multiplyScalar(0.7).add(random.multiplyScalar(0.6)).normalize();
      const dist = 0.08 + Math.random() * 0.18;
      const target = surfaceVec.clone().add(blend.multiplyScalar(dist));

      gsap.to(p.position, { x: target.x, y: target.y, z: target.z, duration: 0.9, ease: 'power2.out' });
      gsap.to(mat, {
        opacity: 0, duration: 0.9, ease: 'power2.in',
        onComplete: () => { geo.dispose(); mat.dispose(); this.world.remove(p); }
      });
      particles.push(p);
    }
  }

  dispose() {
    this._disposed = true;
    this.renderer.setAnimationLoop(null);
    this.renderer.domElement.removeEventListener('pointermove', this._onPointerMove);
    this.renderer.domElement.removeEventListener('click', this._onClick);
    window.removeEventListener('resize', this._onResize);

    this.scene.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this._mapTexture?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
