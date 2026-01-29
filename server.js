const express = require('express');
const cors = require('cors');
const path = require('path');
const LoveTypeCalculator = require('./calculator');

const app = express();
const PORT = process.env.PORT || 3000;
const calculator = new LoveTypeCalculator();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/questions', (req, res) => {
  const questions = calculator.getQuestionsForTest();
  res.json({ questions, total: questions.length });
});

app.post('/api/calculate', (req, res) => {
  const { answers } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: '답변이 필요합니다' });
  }

  const result = calculator.calculate(answers);

  const shareData = {
    type: result.type,
    typeInfo: result.typeInfo,
    dimensions: result.dimensions,
    timestamp: new Date().toISOString(),
    emoji: result.typeInfo?.emoji || '💕',
    shareText: `나의 연애 유형은 ${result.typeInfo.name} ${result.typeInfo.emoji}!\n${result.typeInfo.title}\n\n테스트: https://love-type-test.vercel.app`
  };

  res.json({
    success: true,
    result: shareData
  });
});

app.get('/api/types', (req, res) => {
  res.json({ types: calculator.types });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: '찾을 수 없습니다' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: '서버 에러' });
});

app.listen(PORT, () => {
  console.log(`🚀 연애 유형 테스트가 ${PORT}번 포트에서 실행 중입니다!`);
  console.log(`📱 메인: http://localhost:${PORT}`);
});
