"use client";

import { type CSSProperties, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import styles from "../segment-page.module.css";

type HeroGlyphFieldProps = {
  className?: string;
};

type AmbientGlyph = {
  delay: string;
  duration: string;
  glyph: string;
  opacity: number;
  rotate: string;
  size: string;
  x: string;
  y: string;
};

const GLYPHS = ["A", "é", "ñ", "文", "語", "あ", "カ", "한", "글", "λ", "Ж", "Д"] as const;
const AMBIENT_GLYPHS: ReadonlyArray<AmbientGlyph> = [
  {
    glyph: "文",
    x: "2%",
    y: "7%",
    size: "18px",
    opacity: 0.12,
    rotate: "-10deg",
    delay: "-1s",
    duration: "12s",
  },
  {
    glyph: "語",
    x: "8%",
    y: "14%",
    size: "23px",
    opacity: 0.1,
    rotate: "7deg",
    delay: "-6s",
    duration: "14s",
  },
  {
    glyph: "あ",
    x: "14%",
    y: "8%",
    size: "15px",
    opacity: 0.08,
    rotate: "-4deg",
    delay: "-3s",
    duration: "11s",
  },
  {
    glyph: "カ",
    x: "22%",
    y: "5%",
    size: "18px",
    opacity: 0.07,
    rotate: "9deg",
    delay: "-7s",
    duration: "13s",
  },
  {
    glyph: "é",
    x: "77%",
    y: "10%",
    size: "16px",
    opacity: 0.08,
    rotate: "-8deg",
    delay: "-4s",
    duration: "12s",
  },
  {
    glyph: "글",
    x: "87%",
    y: "16%",
    size: "23px",
    opacity: 0.1,
    rotate: "5deg",
    delay: "-9s",
    duration: "15s",
  },
  {
    glyph: "Ж",
    x: "95%",
    y: "7%",
    size: "19px",
    opacity: 0.09,
    rotate: "-6deg",
    delay: "-5s",
    duration: "11s",
  },
  {
    glyph: "λ",
    x: "4%",
    y: "35%",
    size: "17px",
    opacity: 0.08,
    rotate: "8deg",
    delay: "-8s",
    duration: "14s",
  },
  {
    glyph: "ñ",
    x: "12%",
    y: "52%",
    size: "19px",
    opacity: 0.06,
    rotate: "-7deg",
    delay: "-2s",
    duration: "12s",
  },
  {
    glyph: "カ",
    x: "91%",
    y: "48%",
    size: "20px",
    opacity: 0.07,
    rotate: "11deg",
    delay: "-6s",
    duration: "13s",
  },
  {
    glyph: "文",
    x: "82%",
    y: "68%",
    size: "16px",
    opacity: 0.06,
    rotate: "-5deg",
    delay: "-10s",
    duration: "15s",
  },
  {
    glyph: "Д",
    x: "6%",
    y: "78%",
    size: "18px",
    opacity: 0.07,
    rotate: "6deg",
    delay: "-4s",
    duration: "12s",
  },
] as const;

const ATLAS_CELL_SIZE = 64;
const FRAME_MS = 1_000 / 30;
const RAIN_COLUMN_COUNT = 38;
const RAIN_GLYPHS_PER_COLUMN = 22;
const PARTICLE_COUNT = RAIN_COLUMN_COUNT * RAIN_GLYPHS_PER_COLUMN;
const VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 aCorner;
in vec4 aSeed;
in float aGlyph;
in float aSize;
in float aTrail;

uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerStrength;
uniform float uTime;
uniform float uGlyphCount;

out vec2 vUv;
out float vGlyph;
out float vAlpha;

float distanceToRect(vec2 point, vec4 rect) {
  vec2 outsideDistance = max(max(rect.xy - point, point - rect.zw), vec2(0.0));
  return length(outsideDistance);
}

float quietZoneFade(vec2 point, vec4 rect, float fadeSize, float minAlpha) {
  float distanceFromRect = distanceToRect(point, rect);
  return max(minAlpha, smoothstep(0.0, fadeSize, distanceFromRect));
}

void main() {
  float t = uTime * aSeed.z + aSeed.w;
  vec2 pos = vec2(aSeed.x, fract(aSeed.y + t));
  pos.x += sin(t * 0.86 + aTrail * 4.0) * 0.004;

  float pointerFade = 1.0;
  if (uPointer.x >= 0.0) {
    vec2 diff = pos - uPointer;
    diff.x *= uResolution.x / max(uResolution.y, 1.0);
    float distanceToPointer = length(diff);
    float influence = (1.0 - smoothstep(0.035, 0.28, distanceToPointer)) * uPointerStrength;
    float side = mix(-1.0, 1.0, step(0.0, diff.x));
    pos.x += side * influence * 0.12;
    pos.y += diff.y * influence * 0.035;
    pointerFade = mix(1.0, 0.0, influence);
  }

  vec2 pixelPosition = pos * uResolution;
  pixelPosition.y += sin(t * 1.13 + aSeed.x * 7.0) * 2.0;

  float edgeFade =
    smoothstep(0.0, 0.035, pos.x) *
    (1.0 - smoothstep(0.965, 1.0, pos.x)) *
    smoothstep(0.0, 0.035, pos.y) *
    (1.0 - smoothstep(0.965, 1.0, pos.y));
  float quietFade = min(
    quietZoneFade(pos, vec4(0.06, 0.12, 0.56, 0.59), 0.11, 0.28),
    quietZoneFade(pos, vec4(0.59, 0.16, 0.94, 0.57), 0.1, 0.3)
  );
  quietFade = min(quietFade, quietZoneFade(pos, vec4(0.08, 0.59, 0.92, 0.78), 0.09, 0.28));
  float headGlow = 1.0 - smoothstep(0.0, 0.18, aTrail);
  float trailFade = mix(1.0, 0.22, aTrail);
  float pulse = 0.72 + 0.28 * sin(t * 1.7 + aSeed.w * 5.0);
  vAlpha = edgeFade * quietFade * pointerFade * (0.16 + trailFade * 0.34 + headGlow * 0.3) * pulse;
  vGlyph = mod(aGlyph + floor(uTime * (1.2 + aSeed.z * 8.0) + aSeed.w * 17.0 + aTrail * 5.0), uGlyphCount);
  vUv = aCorner + 0.5;

  vec2 clip = ((pixelPosition + aCorner * aSize) / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}
`;
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
in float vGlyph;
in float vAlpha;

uniform sampler2D uAtlas;
uniform vec3 uColor;
uniform float uGlyphCount;

out vec4 outColor;

void main() {
  vec2 atlasUv = vec2((vGlyph + vUv.x) / uGlyphCount, vUv.y);
  float glyphAlpha = texture(uAtlas, atlasUv).a;
  outColor = vec4(uColor, glyphAlpha * vAlpha);
}
`;

function getAmbientStyle(glyph: AmbientGlyph) {
  return {
    "--glyph-delay": glyph.delay,
    "--glyph-duration": glyph.duration,
    "--glyph-opacity": glyph.opacity,
    "--glyph-rotate": glyph.rotate,
    "--glyph-size": glyph.size,
    "--glyph-x": glyph.x,
    "--glyph-y": glyph.y,
  } as CSSProperties;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) {
      gl.deleteShader(vertexShader);
    }
    if (fragmentShader) {
      gl.deleteShader(fragmentShader);
    }
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function createGlyphAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_CELL_SIZE * GLYPHS.length;
  canvas.height = ATLAS_CELL_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "white";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font =
    '600 42px "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Apple SD Gothic Neo", "Noto Sans CJK JP", "Noto Sans", system-ui, sans-serif';

  GLYPHS.forEach((glyph, index) => {
    context.fillText(glyph, index * ATLAS_CELL_SIZE + ATLAS_CELL_SIZE / 2, ATLAS_CELL_SIZE / 2);
  });

  return canvas;
}

function createParticleData() {
  const seeds = new Float32Array(PARTICLE_COUNT * 4);
  const glyphs = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const trails = new Float32Array(PARTICLE_COUNT);

  for (let column = 0; column < RAIN_COLUMN_COUNT; column += 1) {
    const columnJitter = (Math.random() - 0.5) * 0.42;
    const columnX = Math.min(
      0.98,
      Math.max(0.02, (column + 0.5 + columnJitter) / RAIN_COLUMN_COUNT),
    );
    const phase = Math.random();
    const speed = 0.065 + Math.random() * 0.075;

    for (let trailIndex = 0; trailIndex < RAIN_GLYPHS_PER_COLUMN; trailIndex += 1) {
      const index = column * RAIN_GLYPHS_PER_COLUMN + trailIndex;
      const trail = trailIndex / Math.max(1, RAIN_GLYPHS_PER_COLUMN - 1);
      const streamGap = 0.031 + Math.random() * 0.006;
      const seedOffset = index * 4;
      seeds[seedOffset] = columnX;
      seeds[seedOffset + 1] = phase - trailIndex * streamGap;
      seeds[seedOffset + 2] = speed;
      seeds[seedOffset + 3] = Math.random();
      glyphs[index] = (column + trailIndex) % GLYPHS.length;
      sizes[index] = 15 + Math.random() * 10;
      trails[index] = trail;
    }
  }

  return { glyphs, seeds, sizes, trails };
}

function bindInstanceAttribute(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
  data: Float32Array,
  size: number,
) {
  const location = gl.getAttribLocation(program, name);
  if (location < 0) {
    return null;
  }

  const buffer = gl.createBuffer();
  if (!buffer) {
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(location, 1);

  return buffer;
}

export function HeroGlyphField({ className }: HeroGlyphFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const heroSection = root?.closest("section");
    if (!root || !canvas || !heroSection || typeof window.matchMedia !== "function") {
      return;
    }

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "low-power",
      premultipliedAlpha: false,
      stencil: false,
    });
    if (!gl) {
      return;
    }

    const program = createProgram(gl);
    const glyphAtlas = createGlyphAtlas();
    if (!program || !glyphAtlas) {
      if (program) {
        gl.deleteProgram(program);
      }
      return;
    }

    root.dataset.glyphRenderer = "webgl";

    const quadBuffer = gl.createBuffer();
    const texture = gl.createTexture();
    const vertexArray = gl.createVertexArray();
    if (!quadBuffer || !texture || !vertexArray) {
      root.dataset.glyphRenderer = "fallback";
      if (quadBuffer) {
        gl.deleteBuffer(quadBuffer);
      }
      if (texture) {
        gl.deleteTexture(texture);
      }
      if (vertexArray) {
        gl.deleteVertexArray(vertexArray);
      }
      gl.deleteProgram(program);
      return;
    }

    const { glyphs, seeds, sizes, trails } = createParticleData();
    const buffers: WebGLBuffer[] = [quadBuffer];
    const rect = { height: 1, left: 0, top: 0, width: 1 };
    let animationFrame: number | null = null;
    let isVisible = true;
    let isPointerInside = false;
    let lastFrameTime = 0;
    let pointerStrength = 0;
    let pointerX = -1;
    let pointerY = -1;

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW,
    );

    const cornerLocation = gl.getAttribLocation(program, "aCorner");
    if (cornerLocation < 0) {
      root.dataset.glyphRenderer = "fallback";
      gl.deleteBuffer(quadBuffer);
      gl.deleteTexture(texture);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(program);
      return;
    }
    gl.enableVertexAttribArray(cornerLocation);
    gl.vertexAttribPointer(cornerLocation, 2, gl.FLOAT, false, 0, 0);

    for (const buffer of [
      bindInstanceAttribute(gl, program, "aSeed", seeds, 4),
      bindInstanceAttribute(gl, program, "aGlyph", glyphs, 1),
      bindInstanceAttribute(gl, program, "aSize", sizes, 1),
      bindInstanceAttribute(gl, program, "aTrail", trails, 1),
    ]) {
      if (!buffer) {
        root.dataset.glyphRenderer = "fallback";
        buffers.forEach((createdBuffer) => gl.deleteBuffer(createdBuffer));
        gl.deleteTexture(texture);
        gl.deleteVertexArray(vertexArray);
        gl.deleteProgram(program);
        return;
      }
      buffers.push(buffer);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphAtlas);

    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, "uAtlas"), 0);
    gl.uniform1f(gl.getUniformLocation(program, "uGlyphCount"), GLYPHS.length);
    gl.uniform3f(gl.getUniformLocation(program, "uColor"), 0.13, 0.03, 0.32);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const pointerStrengthLocation = gl.getUniformLocation(program, "uPointerStrength");
    const timeLocation = gl.getUniformLocation(program, "uTime");

    const updateRect = () => {
      const bounds = canvas.getBoundingClientRect();
      rect.left = bounds.left;
      rect.top = bounds.top;
      rect.width = Math.max(1, bounds.width);
      rect.height = Math.max(1, bounds.height);
    };

    const resizeCanvas = () => {
      updateRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const render = (time: number) => {
      if (!isVisible || document.visibilityState === "hidden") {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }

      if (time - lastFrameTime < FRAME_MS) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }

      lastFrameTime = time;
      pointerStrength = isPointerInside
        ? Math.min(1, pointerStrength + 0.18)
        : pointerStrength * 0.9;
      if (pointerStrength < 0.01) {
        pointerStrength = 0;
        pointerX = -1;
        pointerY = -1;
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindVertexArray(vertexArray);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(resolutionLocation, rect.width, rect.height);
      gl.uniform2f(pointerLocation, pointerX, pointerY);
      gl.uniform1f(pointerStrengthLocation, pointerStrength);
      gl.uniform1f(timeLocation, time / 1_000);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, PARTICLE_COUNT);
      animationFrame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      if (x < 0 || y < 0 || x > 1 || y > 1) {
        return;
      }

      pointerX = x;
      pointerY = y;
      isPointerInside = true;
      pointerStrength = 1;
    };

    const onPointerLeave = () => {
      isPointerInside = false;
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = Boolean(entry?.isIntersecting);
    });

    resizeCanvas();
    resizeObserver.observe(canvas);
    intersectionObserver.observe(heroSection);
    heroSection.addEventListener("pointermove", onPointerMove, { passive: true });
    heroSection.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("resize", resizeCanvas, { passive: true });
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      root.dataset.glyphRenderer = "fallback";
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      heroSection.removeEventListener("pointermove", onPointerMove);
      heroSection.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      buffers.forEach((buffer) => gl.deleteBuffer(buffer));
      gl.deleteTexture(texture);
      gl.deleteVertexArray(vertexArray);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={cn(styles.heroGlyphField, className)}
      data-glyph-renderer="fallback"
      data-testid="hero-glyph-field"
    >
      <canvas ref={canvasRef} className={styles.heroGlyphCanvas} />
      {AMBIENT_GLYPHS.map((glyph, index) => (
        <span
          key={`${glyph.glyph}-${index}`}
          className={styles.heroGlyphAmbient}
          style={getAmbientStyle(glyph)}
        >
          {glyph.glyph}
        </span>
      ))}
    </div>
  );
}
