const express = require('express');
const cors = require('cors');
const db = require('./db.cjs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Auth Login API
app.post('/api/auth/login', (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
  }
  const user = db.get('prosecutors').find({ id }).value();
  if (!user) {
    return res.status(401).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
  }
  if (user.password !== password) {
    return res.status(401).json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
  }
  // 비밀번호 필드를 응답에서 제외
  const { password: _pw, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// 2. Cases API (Main Ledger)
app.get('/api/cases', (req, res) => {
  const cases = db.get('cases').value();
  res.json(cases);
});

app.post('/api/cases', (req, res) => {
  const newCase = { id: Date.now(), ...req.body };
  db.get('cases').unshift(newCase).write();
  res.json({ success: true, case: newCase });
});

app.put('/api/cases/:id', (req, res) => {
  const caseId = parseInt(req.params.id);
  db.get('cases').find({ id: caseId }).assign(req.body).write();
  res.json({ success: true });
});

// 3. Reports API
app.get('/api/reports', (req, res) => {
  const reports = db.get('reports').value();
  res.json(reports);
});

app.post('/api/reports', (req, res) => {
  const newReport = { id: Date.now(), ...req.body };
  db.get('reports').unshift(newReport).write();
  res.json({ success: true, report: newReport });
});

// 4. Appeals API
app.get('/api/appeals', (req, res) => {
  const appeals = db.get('appeals').value();
  res.json(appeals);
});

// 5. Bookings API
app.get('/api/bookings', (req, res) => {
  const bookings = db.get('bookings').value();
  res.json(bookings);
});

// 6. Approvals API
app.get('/api/approvals', (req, res) => {
  const approvals = db.get('approvals').value();
  res.json(approvals);
});

app.post('/api/approvals', (req, res) => {
  const newDoc = req.body;
  db.get('approvals').unshift(newDoc).write();
  res.json({ success: true, doc: newDoc });
});

app.put('/api/approvals/:id/approve', (req, res) => {
  const docId = req.params.id;
  const doc = db.get('approvals').find({ id: docId }).value();

  if (!doc) {
    return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
  }

  const updatedApprovals = (doc.approvals || []).map(a => ({
    ...a,
    status: '최종결재(인장날인)',
    date: new Date().toISOString().replace('T', ' ').substring(0, 16)
  }));

  db.get('approvals')
    .find({ id: docId })
    .assign({ status: '최종승인', approvals: updatedApprovals })
    .write();

  // Also update case disposition in main ledger
  db.get('cases')
    .find({ hyeongjeNo: doc.hyeongjeNo })
    .assign({ disposition: `${doc.dispositionType} (결재완료)` })
    .write();

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`[Dose-PROS DB REST Server] Listening on http://localhost:${PORT}`);
});
