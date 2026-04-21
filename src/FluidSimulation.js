import * as THREE from "three";
import shaders from "./shaders";

export class FluidSimulation {
  constructor(canvas, config) {
    this.config = config;
    this._setupRenderer(canvas);
    this._setupScene();
    this._setupTargets();
    this._setupMaterials();
    this._setupInput();
    this._loop();
  }

  _setupRenderer(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.dpr = this.renderer.getPixelRatio();
    this.width = window.innerWidth * this.dpr;
    this.height = window.innerHeight * this.dpr;

    window.addEventListener("resize", () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.width = window.innerWidth * this.dpr;
      this.height = window.innerHeight * this.dpr;
    });
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.scene.add(this.quad);
  }

  _setupTargets() {
    const { simResolution, dyeResolution } = this.config;
    const aspect = this.width / this.height;

    const options = {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    };

    const createRT = (w, h) => new THREE.WebGLRenderTarget(w, h, options);

    const createDoubleRT = (w, h) => ({
      read: createRT(w, h),
      write: createRT(w, h),
      swap() {
        [this.read, this.write] = [this.write, this.read];
      },
    });

    this.simSize = {
      w: simResolution,
      h: Math.round(simResolution / aspect),
    };

    this.dyeSize = {
      w: dyeResolution,
      h: Math.round(dyeResolution / aspect),
    };

    this.velocity = createDoubleRT(this.simSize.w, this.simSize.h);
    this.dye = createDoubleRT(this.dyeSize.w, this.dyeSize.h);
    this.divergence = createRT(this.simSize.w, this.simSize.h);
    this.curl = createRT(this.simSize.w, this.simSize.h);
    this.pressure = createDoubleRT(this.simSize.w, this.simSize.h);
  }

  _setupMaterials() {
    const make = ([vert, frag], uniforms) =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms,
      });

    const tex = () => ({ value: null });
    const num = (v = 0) => ({ value: v });
    const v2 = () => ({ value: new THREE.Vector2() });

    this.material = {
      splat: make(shaders.splat, {
        uTarget: tex(),
        aspectRatio: num(),
        radius: num(),
        color: { value: new THREE.Vector3() },
        point: { value: new THREE.Vector2() },
      }),

      advection: make(shaders.advection, {
        uVelocity: tex(), // ✅ fixed name
        uSource: tex(),
        texelSize: v2(),
        dt: num(),
        dissipation: num(),
      }),

      divergence: make(shaders.divergence, {
        uVelocity: tex(),
        texelSize: v2(),
      }),

      curl: make(shaders.curl, {
        uVelocity: tex(),
        texelSize: v2(),
      }),

      vorticity: make(shaders.vorticity, {
        uVelocity: tex(), // ✅ fixed name
        uCurl: tex(),
        texelSize: v2(),
        curlStrength: num(),
        dt: num(),
      }),

      pressure: make(shaders.pressure, {
        uPressure: tex(),
        uDivergence: tex(),
        texelSize: v2(),
      }),

      gradientSubtract: make(shaders.gradientSubtract, {
        uPressure: tex(),
        uVelocity: tex(),
        texelSize: v2(),
      }),

      clear: make(shaders.clear, {
        uTexture: tex(),
        value: num(),
      }),

      display: make(shaders.display, {
        uTexture: tex(),
        threshold: num(),
        edgeSoftness: num(),
        inkColor: { value: new THREE.Color() },
      }),
    };
  }

  _setupInput() {
    this.mouse = { x: 0, y: 0, velocityX: 0, velocityY: 0, moved: false };

    const onMove = (x, y) => {
      this.mouse.velocityX =
        (x * this.dpr - this.mouse.x) * this.config.forceStrength;
      this.mouse.velocityY =
        (y * this.dpr - this.mouse.y) * this.config.forceStrength;

      this.mouse.x = x * this.dpr;
      this.mouse.y = y * this.dpr;
      this.mouse.moved = true;
    };

    window.addEventListener("mousemove", (e) =>
      onMove(e.clientX, e.clientY)
    );
  }

  _pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(this.scene, this.camera);
  }

  _set(material, values) {
    Object.entries(values).forEach(([k, v]) => {
      material.uniforms[k].value = v;
    });
    return material;
  }

_splat(x, y, vx, vy) {
  const { material: m, velocity: vel, dye, width, height } = this;

  // common uniforms
  this._set(m.splat, {
    aspectRatio: width / height,
    point: new THREE.Vector2(x / width, 1 - y / height),
    radius: 0.02,
  });

  // ✅ velocity (IMPORTANT)
  this._set(m.splat, {
    uTarget: vel.read.texture,
    color: new THREE.Vector3(vx, vy, 0),
  });
  this._pass(m.splat, vel.write);
  vel.swap();

  // ✅ dye (visible ink)
  this._set(m.splat, {
    uTarget: dye.read.texture,
    color: new THREE.Vector3(5, 5, 5), // stronger for visibility
  });
  this._pass(m.splat, dye.write);
  dye.swap();
}
 _simulate(dt) {
  const { material: m, velocity: vel, dye } = this;

  const texel = new THREE.Vector2(
    1 / this.simSize.w,
    1 / this.simSize.h
  );

  // advect velocity
  this._set(m.advection, {
    uVelocity: vel.read.texture,
    uSource: vel.read.texture,
    texelSize: texel,
    dt,
    dissipation: 0.98,
  });
  this._pass(m.advection, vel.write);
  vel.swap();

  // advect dye
  this._set(m.advection, {
    uVelocity: vel.read.texture,
    uSource: dye.read.texture,
    texelSize: texel,
    dt,
    dissipation: 0.99,
  });
  this._pass(m.advection, dye.write);
  dye.swap();
}


_render() {
  this._pass(
    this._set(this.material.display, {
      uTexture: this.dye.read.texture,
    }),
    null
  );
}


_loop() {
  let last = performance.now();

  const tick = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.016);
    last = now;

    // ✅ ALWAYS animate (for testing)
    this._splat(
      this.width / 2,
      this.height / 2,
      Math.sin(performance.now() * 0.002) * 50,
      Math.cos(performance.now() * 0.002) * 50
    );

    // mouse interaction
    if (this.mouse.moved) {
      this._splat(
        this.mouse.x,
        this.mouse.y,
        this.mouse.velocityX,
        this.mouse.velocityY
      );
      this.mouse.moved = false;
    }

    this._simulate(dt);
    this._render();

    requestAnimationFrame(tick);
  };

  tick();
}
}