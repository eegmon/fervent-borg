# 도스온라인 검찰청 사건관리시스템

## 실행 및 운영 설정

```bash
npm install
npm run dev
```

API 서버는 별도 터미널에서 `npm start`로 실행합니다.

운영 환경에서는 `NODE_ENV=production`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `BOOTSTRAP_SECRET`을 설정해야 합니다. DB 또는 허용 origin이 누락되면 서버가 시작되지 않습니다. 계정이 하나도 없을 때 회원가입 화면에 `BOOTSTRAP_SECRET`과 일치하는 초기화 코드를 입력하면 최초 관리자 계정이 한 번 생성됩니다.

개발 화면은 `http://127.0.0.1:5173/`, 서버 상태 확인은 `http://localhost:5000/api/health`에서 할 수 있습니다.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
