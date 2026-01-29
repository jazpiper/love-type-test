const fs = require('fs');
const path = require('path');

class LoveTypeCalculator {
  constructor() {
    this.questions = this.loadQuestions();
    this.types = this.loadTypes();
  }

  loadQuestions() {
    const questionsPath = path.join(__dirname, 'questions.json');
    const data = fs.readFileSync(questionsPath, 'utf8');
    return JSON.parse(data);
  }

  loadTypes() {
    const typesPath = path.join(__dirname, 'types.json');
    const data = fs.readFileSync(typesPath, 'utf8');
    return JSON.parse(data).types;
  }

  getQuestionsForTest() {
    return this.questions;
  }

  calculate(answers) {
    // 각 차원의 점수 계산
    const scores = {
      idealism_vs_pragmatism: { idealism: 0, pragmatism: 0 },
      emotion_vs_rationality: { emotion: 0, rationality: 0 },
      independence_vs_dependence: { independence: 0, dependence: 0 },
      adventure_vs_stability: { adventure: 0, stability: 0 },
      curiosity_vs_loyalty: { curiosity: 0, loyalty: 0 }
    };

    // 답변을 통해 점수 누적
    answers.forEach((answer, index) => {
      const question = this.questions[index];
      if (!question) return;

      const selectedOption = question.options.find(opt => opt.text === answer);
      if (selectedOption) {
        const dimension = scores[question.dimension];
        if (dimension) {
          dimension[selectedOption.dimension_value]++;
        }
      }
    });

    // 각 차원에서 더 높은 점수 선택
    const result = {
      idealism_vs_pragmatism: scores.idealism_vs_pragmatism.idealism >= scores.idealism_vs_pragmatism.pragmatism ? 'idealism' : 'pragmatism',
      emotion_vs_rationality: scores.emotion_vs_rationality.emotion >= scores.emotion_vs_rationality.rationality ? 'emotion' : 'rationality',
      independence_vs_dependence: scores.independence_vs_dependence.independence >= scores.independence_vs_dependence.dependence ? 'independence' : 'dependence',
      adventure_vs_stability: scores.adventure_vs_stability.adventure >= scores.adventure_vs_stability.stability ? 'adventure' : 'stability',
      curiosity_vs_loyalty: scores.curiosity_vs_loyalty.curiosity >= scores.curiosity_vs_loyalty.loyalty ? 'curiosity' : 'loyalty'
    };

    // 가장 가까운 타입 찾기
    const type = this.findClosestType(result);

    return {
      type: type.id,
      typeInfo: type,
      dimensions: result
    };
  }

  findClosestType(result) {
    // 각 타입과 일치하는 정도 계산
    const matches = this.types.map(type => {
      let matchScore = 0;

      // mbti_like 코드 파싱 (예: I-E-I-A-C -> [idealism, emotion, independence, adventure, curiosity])
      const typeTraits = type.mbti_like.split('-');

      // 각 차원에 대해 일치 확인
      // 1. 이상주의 vs 현실주의 (첫 번째 문자: I = idealism, P = pragmatism)
      if (result.idealism_vs_pragmatism === (typeTraits[0] === 'I' ? 'idealism' : 'pragmatism')) matchScore++;

      // 2. 감성 vs 이성 (두 번째 문자: E = emotion, R = rationality)
      if (result.emotion_vs_rationality === (typeTraits[1] === 'E' ? 'emotion' : 'rationality')) matchScore++;

      // 3. 독립 vs 의존 (세 번째 문자: I = independence, D = dependence)
      if (result.independence_vs_dependence === (typeTraits[2] === 'I' ? 'independence' : 'dependence')) matchScore++;

      // 4. 모험 vs 안정 (네 번째 문자: A = adventure, S = stability)
      if (result.adventure_vs_stability === (typeTraits[3] === 'A' ? 'adventure' : 'stability')) matchScore++;

      // 5. 호기심 vs 충직 (다섯 번째 문자: C = curiosity, L = loyalty)
      if (result.curiosity_vs_loyalty === (typeTraits[4] === 'C' ? 'curiosity' : 'loyalty')) matchScore++;

      return { type, matchScore };
    });

    // 가장 높은 일치 점수를 가진 타입 선택
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches[0].type;
  }
}

module.exports = LoveTypeCalculator;
