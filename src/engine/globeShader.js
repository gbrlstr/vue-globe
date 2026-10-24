import {
    ShaderMaterial,
    Vector2,
    Vector3,
    Color,
    FrontSide,
    LinearFilter,
} from "three";

const vertexShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
        vUv = uv;
        vec3 analyticalNormal = normalize(position);
        vNormal = normalize(normalMatrix * analyticalNormal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

const fragmentShader = /* glsl */ `
    uniform sampler2D uEarthTexture;
    uniform sampler2D uOceanTexture;
    uniform sampler2D uOceanMask;
    uniform sampler2D uNormalMap;
    uniform sampler2D uBumpMap;
    uniform sampler2D uHeatMap;

    uniform vec3 uLightDir;
    uniform float uNormalScale;
    uniform float uBumpScale;
    uniform vec2 uMouseUV;
    uniform float uTime;

    uniform float uNoiseScale;
    uniform float uNoiseSpeed;
    uniform float uNoiseStrength;

    uniform float uGridLatSpacing;
    uniform float uGridLngSpacing;
    uniform float uGridLineWidth;
    uniform vec3 uGridLineColor;
    uniform float uGridLineOpacity;

    uniform vec3 uOceanTint;
    uniform float uOceanTintStrength;
    uniform float uOceanDarken;
    uniform int uOceanIteration;
    uniform int uWarpIteration;
    uniform vec3 uCloudLightColor;

    uniform vec3 uHoverCellColor;
    uniform float uHoverCellOpacity;
    uniform float uTrailOpacity;

    uniform float uLandDesaturation;
    uniform float uLandBrightness;
    uniform vec3 uLandColor;

    uniform vec3 uAutoCellColor;
    uniform float uAutoCellOpacity;

    uniform float uGlitchSpeed;
    uniform float uGlitchAmount;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    float hash2(vec2 p) {
        p = fract(p * vec2(127.1, 311.7));
        p += dot(p, p + 19.19);
        return fract(p.x * p.y);
    }

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
    
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
    
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
    
        i = mod289(i);
        vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
    
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
    
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
    
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
    
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
    
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
    
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    float fbm(vec3 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < uOceanIteration; i++) {
            v += amp * snoise(p);
            p = p * 2.1 + vec3(1.7, 9.2, 3.4);
            amp *= 0.53;
        }
        return v;
    }

    float fbmWarp(vec3 p) {
        float v = 0.0;
        float amp = 0.5;
        for (int i = 0; i < uWarpIteration; i++) {
            v += amp * snoise(p);
            p = p * 2.1 + vec3(1.7, 9.2, 3.4);
            amp *= 0.53;
        }
        return v;
    }

    vec2 uvToGrid(vec2 uv) {
        float lng = uv.x * 360.0;
        float lat = uv.y * 180.0;
        return vec2(lng / uGridLngSpacing, lat / uGridLatSpacing);
    }

    float gridLines(vec2 gridCoord) {
        vec2 wrapped = fract(gridCoord);
        vec2 dist = min(wrapped, 1.0 - wrapped);
        vec2 fw = fwidth(gridCoord) * uGridLineWidth;
        vec2 line = smoothstep(fw, vec2(0.0), dist);
        return max(line.x, line.y);
    }

    void main() {
        const float PI = 3.14159265359;
        vec3 dir = normalize(vWorldPosition);
        float theta = atan(dir.z, -dir.x);
        if (theta < 0.0) theta += 2.0 * PI;
        vec2 sphericalUV = vec2(theta / (2.0 * PI), (asin(clamp(dir.y, -1.0, 1.0)) + PI * 0.5) / PI);

        vec4 texColor = texture2D(uEarthTexture, sphericalUV);
        float isOcean = texture2D(uOceanMask, sphericalUV).r;

        vec2 gridCoord = uvToGrid(sphericalUV);

        float grid = gridLines(gridCoord);
        float heat = texture2D(uHeatMap, sphericalUV).r;

        float currentHover = 0.0;
        if (uMouseUV.x >= 0.0) {
            vec2 mouseGrid = floor(uvToGrid(uMouseUV));
            vec2 cellGrid = floor(gridCoord);
            
            if (cellGrid == mouseGrid) {
                currentHover = isOcean;
            }
        }

        float hoverTotal = max(currentHover, heat * uTrailOpacity) * isOcean;
        float texLuminance = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

        vec2 cellGrid = floor(gridCoord);

        float glitchPhase = fract(hash2(cellGrid * 4.33 + 11.7) + uTime * uGlitchSpeed);
        float glitchStart = 1.0 - uGlitchAmount;
        float glitchFadeW = uGlitchAmount * 0.25;
        float isGlitched  = smoothstep(glitchStart, glitchStart + glitchFadeW, glitchPhase)
                          * (1.0 - smoothstep(1.0 - glitchFadeW, 1.0, glitchPhase));

        vec4 texOcean = texture2D(uOceanTexture, sphericalUV);

        float h1 = hash2(cellGrid);
        float h2 = hash2(cellGrid * 1.73 + 3.71);

        float eligible   = step(0.55, h1);
        float autoPhase  = fract(hash2(cellGrid * 2.17 + 5.4) + uTime * uGlitchSpeed);
        float autoWindow = uGlitchAmount + 0.02;
        float autoStart  = 1.0 - autoWindow;
        float autoFadeW  = autoWindow * 0.25;
        float autoActive = eligible
                         * smoothstep(autoStart, autoStart + autoFadeW, autoPhase)
                         * (1.0 - smoothstep(1.0 - autoFadeW, 1.0, autoPhase));

        vec2 cellFract = fract(gridCoord);
        float stripe   = step(0.55, fract(cellFract.x * 4.0 + cellFract.y * 2.0));
        float isSolid  = step(0.4, h2);
        float cellPattern = mix(stripe, 1.0, isSolid);

        float autoCellBase = autoActive * cellPattern;
        float autoCell = autoCellBase * isOcean;

        // Ruído de nuvens é a parte mais cara do shader: só roda no oceano e com as nuvens ligadas.
        float cloud = 0.0;
        if (uNoiseStrength > 0.0 && isOcean > 0.001) {
            vec3 cloudBase = vWorldPosition * uNoiseScale;
            vec3 warpOffset = vec3(
                fbmWarp(cloudBase + vec3(uTime * uNoiseSpeed)),
                fbmWarp(cloudBase + vec3(5.2, 1.3, 0.0) + vec3(uTime * uNoiseSpeed * 0.7)),
                0.0
            );
            cloud = fbm(cloudBase + 0.6 * warpOffset + vec3(uTime * uNoiseSpeed * 0.4)) * 0.5 + 0.5;
            cloud = smoothstep(0.25, 0.75, cloud);
            cloud = mix(cloud, 1.0 - cloud, isGlitched);
        }

        vec3 oceanBase = texOcean.rgb * 2.;

        oceanBase = mix(oceanBase, uOceanTint * (texLuminance * 0.4 + 0.6), uOceanTintStrength);
        oceanBase *= uOceanDarken;
        oceanBase = mix(oceanBase, uGridLineColor, grid * uGridLineOpacity * isOcean);
        oceanBase = mix(oceanBase, uAutoCellColor, autoCell * uAutoCellOpacity);
        oceanBase = mix(oceanBase, uHoverCellColor, hoverTotal * uHoverCellOpacity);
        oceanBase *= 1.0 - uNoiseStrength * 0.4 * (1.0 - cloud);
        oceanBase = mix(oceanBase, uCloudLightColor * 1.1, uNoiseStrength * 0.4 * cloud);

        float grey = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 land = mix(texColor.rgb, vec3(grey), uLandDesaturation);
        land = mix(vec3(0.7), land, 0.25) * uLandBrightness * uLandColor;

        vec3 color = mix(land, oceanBase, isOcean);

        vec3 Q1  = dFdx(vWorldPosition);
        vec3 Q2  = dFdy(vWorldPosition);
        vec2 st1 = dFdx(sphericalUV);
        vec2 st2 = dFdy(sphericalUV);
        float det = st1.x * st2.y - st2.x * st1.y;
        vec3 T = normalize((Q1 * st2.y - Q2 * st1.y) / det);
        vec3 B = normalize((Q2 * st1.x - Q1 * st2.x) / det);
        mat3 TBN = mat3(T, B, vNormal);

        vec3 normalSample = texture2D(uNormalMap, sphericalUV).rgb * 2.0 - 1.0;
        normalSample.xy *= uNormalScale;
        vec3 N = normalize(TBN * normalSample);

        float bumpH = texture2D(uBumpMap, sphericalUV).r;
        N = normalize(N + (dFdx(bumpH) * T + dFdy(bumpH) * B) * uBumpScale);

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 L = normalize(uLightDir);
        float rawNdotL = dot(N, L);
        float light = smoothstep(-0.15, 0.25, rawNdotL);
        vec3 shadowColor = color * 0.35 + vec3(0.0, 0.01, 0.04);
        vec3 litColor = color * 0.9;
        color = mix(shadowColor, litColor, light);

        float rim = 1.0 - max(dot(N, viewDir), 0.0);
        rim = pow(rim, 2.5) * 0.08;
        float rimMask = smoothstep(-0.3, 0.1, rawNdotL);
        color += vec3(0.15, 0.35, 0.6) * rim * rimMask;

        gl_FragColor = vec4(color, 1.0);
    }
`;

const fillSphereVertexShader = /* glsl */ `
    varying vec3 vWorldPosition;
    void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

const fillSphereFragmentShader = /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec3 vWorldPosition;

    void main() {
        const float PI = 3.14159265359;
        vec3 dir = normalize(vWorldPosition);
        float theta = atan(dir.z, -dir.x);
        if (theta < 0.0) theta += 2.0 * PI;
        vec2 sphericalUV = vec2(theta / (2.0 * PI), (asin(clamp(dir.y, -1.0, 1.0)) + PI * 0.5) / PI);
        vec4 texSample = texture2D(uMap, sphericalUV);
        gl_FragColor = vec4(uColor * texSample.rgb, texSample.a * uOpacity);
    }
`;

export function createGlobeMaterial(
    earthTexture,
    oceanTexture,
    oceanMask,
    bumpMap,
    normalMap,
    heatMap,
    spacing,
    iteration = 4,
    warpIteration = iteration,
    noiseScale = 1.1,
) {
    return new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
            uEarthTexture: { value: earthTexture },
            uOceanTexture: { value: oceanTexture },
            uOceanMask: { value: oceanMask },
            uNormalMap: { value: normalMap },
            uBumpMap: { value: bumpMap },
            uHeatMap: { value: heatMap },
            uLightDir: { value: new Vector3(1, 1, 1).normalize() },
            uNormalScale: { value: 1 },
            uBumpScale: { value: 0.5 },
            uMouseUV: { value: new Vector2(-1, -1) },
            uTime: { value: 0 },

            uNoiseScale: { value: noiseScale },
            uNoiseSpeed: { value: 0.015 },
            uNoiseStrength: { value: 0.9 },

            uGridLatSpacing: { value: spacing - 3 },
            uGridLngSpacing: { value: spacing },
            uGridLineWidth: { value: 1.5 },
            uGridLineColor: { value: new Color(0xcedff3) },
            uGridLineOpacity: { value: 0.5 },

            uCloudLightColor: {
                value: new Color(0xf0f3fa).convertLinearToSRGB(),
            },
            uOceanTint: { value: new Color(0x214898).convertLinearToSRGB() },
            uOceanTintStrength: { value: 0.94 },
            uOceanDarken: { value: 1.2 },
            uOceanIteration: { value: iteration },
            uWarpIteration: { value: warpIteration },

            uHoverCellColor: { value: new Color(0xc9dff8) },
            uHoverCellOpacity: { value: 1 },
            uTrailOpacity: { value: 0.8 },

            uAutoCellColor: { value: new Color(0xc9dff8) },
            uAutoCellOpacity: { value: 1 },

            uGlitchSpeed: { value: 0.015 },
            uGlitchAmount: { value: 0.12 },

            uLandDesaturation: { value: 1.0 },
            uLandBrightness: { value: 1.35 },
            uLandColor: { value: new Color(0xfefefe) },
        },
        side: FrontSide,
    });
}

export function createFillSphereMaterial(texture, color) {
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;

    return new ShaderMaterial({
        vertexShader: fillSphereVertexShader,
        fragmentShader: fillSphereFragmentShader,
        uniforms: {
            uMap: { value: texture },
            uColor: { value: new Color(color) },
            uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: FrontSide,
    });
}
