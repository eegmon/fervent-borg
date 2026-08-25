import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// vite-plugin-obfuscator is optional — skip gracefully if not installed
let obfuscatorPlugin = null;
try {
  const mod = await import('vite-plugin-obfuscator');
  obfuscatorPlugin = mod.viteObfuscateFile ?? mod.default ?? null;
} catch {
  // not installed — obfuscation disabled
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),

    // 난독화는 프로덕션 빌드에서만, 플러그인이 설치된 경우에만 실행
    mode === 'production' && obfuscatorPlugin && obfuscatorPlugin({
      // 적용 대상: HWP 템플릿 등 대용량 자동생성 파일은 제외해 빌드 시간 단축
      include: ['src/**/*.js', 'src/**/*.jsx'],
      exclude: ['src/data/hwpTemplates.js'],

      options: {
        // ── 기본 난독화 ─────────────────────────────────────────────
        compact: true,
        simplify: true,

        // ── 식별자 난독화 ────────────────────────────────────────────
        identifierNamesGenerator: 'hexadecimal', // _0x1a2b 형태
        renameGlobals: false,     // 전역 변수 rename → true 시 React 충돌 가능

        // ── 문자열 난독화 ────────────────────────────────────────────
        stringArray: true,
        stringArrayThreshold: 0.75,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: 'function',
        splitStrings: true,
        splitStringsChunkLength: 8,

        // ── 제어 흐름 난독화 (성능 vs 보호 트레이드오프) ───────────────
        controlFlowFlattening: false,

        // ── 디버깅 방해 ──────────────────────────────────────────────
        disableConsoleOutput: true,
        debugProtection: false,
        selfDefending: true,

        // ── 소스맵 ──────────────────────────────────────────────────
        sourceMap: false,
        sourceMapMode: 'separate',
      },
    }),
  ].filter(Boolean),

  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
}));
