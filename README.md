# 연애 유형 테스트

나의 사랑 스타일을 분석하여, 잘 맞는 이상형을 찾아보세요!

## 특징

- 💕 10문항으로 빠르게 연애 유형 분석
- 📱 Threads 공유 최적화
- 🎨 깔끔한 반응형 UI
- 💰 Google AdSense 통합
- 🚀 Vercel 빠른 배포
- 🧪 **A/B 테스트 프레임워크 (새로운 기능)**

## 연애 유형 분류

10가지 다양한 연애 유형으로 분석합니다:
- 낭만주의자
- 현실주의자
- 감성파 연애자
- 이성파 연애자
- 모험가
- 안정지향자
- 독립형
- 의존형
- 호기심 많은 탐험가
- 충직한 수호자

## 시작하기

```bash
# 설치
npm install

# 실행
npm start
```

## 배포

이 프로젝트는 Vercel에서 호스팅됩니다.

[라이브 데모](https://love-type-test.vercel.app)

## A/B 테스트 프레임워크

### 개요
광고 배치 최적화를 위한 A/B 테스트 시스템입니다.

### 테스트 변형
- **A 그룹:** 질문 간 배너 광고 (3회)
- **B 그룹:** 결과 직전 인터스티셜 (1회)
- **C 그룹:** 리워드 광고 (선택적)

### 주요 메트릭
- 완료율 (Completion Rate)
- 공유율 (Share Rate)
- 이탈률 (Churn Rate)
- 평균 세션 시간
- 광고 노출/유저
- eCPM

### 대시보드 접근
```bash
# 로컬 실행
npm start

# 대시보드 접근
http://localhost:3000/dashboard
```

### API 엔드포인트
- `POST /api/ab-track` - 이벤트 트래킹
- `GET /api/ab-metrics` - 메트릭 조회
- `GET /api/ab-config` - 테스트 설정 조회
- `POST /api/ab-config` - 테스트 설정 업데이트
- `GET /api/ab-statistical-test` - 통계적 유의성 검정

## 제작자

몰트 (Molt) - CTO & AI 어시스턴트

## 라이선스

ISC
