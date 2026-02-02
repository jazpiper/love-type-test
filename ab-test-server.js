/**
 * A/B 테스트 분석 백엔드 API
 * 버전: 1.0.0
 * 설명: A/B 테스트 데이터 수집 및 분석 서버
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

// 데이터 저장 경로
const DATA_DIR = path.join(__dirname, '..', 'ab-test-data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

// 데이터 디렉토리 초기화
function initDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// 이벤트 로깅
function logEvent(event) {
    initDataDir();

    const eventLog = JSON.stringify({
        timestamp: event.timestamp || Date.now(),
        ...event
    }) + '\n';

    fs.appendFileSync(EVENTS_FILE, eventLog);
}

/**
 * POST /api/ab-track
 * A/B 테스트 이벤트 트래킹
 */
router.post('/api/ab-track', (req, res) => {
    try {
        const { userId, timestamp, eventName, testData, data } = req.body;

        if (!userId || !eventName || !testData) {
            return res.status(400).json({ error: '필수 필드 누락' });
        }

        logEvent({
            userId,
            timestamp,
            eventName,
            testData,
            data
        });

        res.json({ success: true });
    } catch (error) {
        console.error('이벤트 트래킹 오류:', error);
        res.status(500).json({ error: '이벤트 저장 실패' });
    }
});

/**
 * GET /api/ab-metrics
 * A/B 테스트 메트릭 계산 및 반환
 */
router.get('/api/ab-metrics', (req, res) => {
    try {
        const { testId, startDate, endDate } = req.query;

        initDataDir();

        if (!fs.existsSync(EVENTS_FILE)) {
            return res.json({
                testId,
                metrics: {},
                summary: {
                    totalUsers: 0,
                    totalEvents: 0,
                    dateRange: null
                }
            });
        }

        // 이벤트 파일 읽기
        const events = fs.readFileSync(EVENTS_FILE, 'utf8')
            .trim()
            .split('\n')
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(e => e !== null && (!testId || e.testData?.testId === testId));

        // 날짜 필터링
        const filteredEvents = events.filter(event => {
            if (!startDate && !endDate) return true;
            const eventDate = new Date(event.timestamp);
            const start = startDate ? new Date(startDate) : new Date(0);
            const end = endDate ? new Date(endDate) : new Date();
            return eventDate >= start && eventDate <= end;
        });

        // 변형별 그룹화
        const variantStats = {};

        for (const event of filteredEvents) {
            const variantId = event.testData?.variantId || 'unknown';

            if (!variantStats[variantId]) {
                variantStats[variantId] = {
                    users: new Set(),
                    events: [],
                    testAssigned: 0,
                    adShown: 0,
                    testComplete: 0,
                    share: 0,
                    sessionEnd: 0,
                    totalAdRevenue: 0,
                    totalSessionTime: 0
                };
            }

            variantStats[variantId].users.add(event.userId);
            variantStats[variantId].events.push(event);

            // 이벤트 카운트
            switch (event.eventName) {
                case 'test_assigned':
                    variantStats[variantId].testAssigned++;
                    break;
                case 'ad_shown':
                    variantStats[variantId].adShown++;
                    break;
                case 'test_complete':
                    variantStats[variantId].testComplete++;
                    break;
                case 'share':
                    variantStats[variantId].share++;
                    break;
                case 'session_end':
                    variantStats[variantId].sessionEnd++;
                    variantStats[variantId].totalSessionTime += event.data?.duration || 0;
                    break;
            }

            // 광고 수익 추가
            if (event.data?.adRevenue) {
                variantStats[variantId].totalAdRevenue += event.data.adRevenue;
            }
        }

        // 메트릭 계산
        const metrics = {};

        for (const [variantId, stats] of Object.entries(variantStats)) {
            const totalUsers = stats.users.size;
            const testAssigned = stats.testAssigned;

            // 완료율
            const completionRate = testAssigned > 0
                ? (stats.testComplete / testAssigned) * 100
                : 0;

            // 공유율
            const shareRate = testAssigned > 0
                ? (stats.share / testAssigned) * 100
                : 0;

            // 이탈률
            const churnRate = testAssigned > 0
                ? ((testAssigned - stats.testComplete) / testAssigned) * 100
                : 0;

            // 평균 세션 시간
            const avgSessionTime = stats.sessionEnd > 0
                ? stats.totalSessionTime / stats.sessionEnd / 1000 // ms to seconds
                : 0;

            // 광고 노출/유저
            const adImpressionsPerUser = totalUsers > 0
                ? stats.adShown / totalUsers
                : 0;

            // eCPM (척도, 실제 광고 수익이 필요)
            const ecpm = stats.totalAdRevenue > 0
                ? (stats.totalAdRevenue / stats.adShown) * 1000
                : 0;

            metrics[variantId] = {
                totalUsers,
                completionRate: parseFloat(completionRate.toFixed(2)),
                shareRate: parseFloat(shareRate.toFixed(2)),
                churnRate: parseFloat(churnRate.toFixed(2)),
                avgSessionTime: parseFloat(avgSessionTime.toFixed(2)),
                adImpressionsPerUser: parseFloat(adImpressionsPerUser.toFixed(2)),
                ecpm: parseFloat(ecpm.toFixed(2)),
                totalAdRevenue: stats.totalAdRevenue,
                eventCounts: {
                    testAssigned: stats.testAssigned,
                    adShown: stats.adShown,
                    testComplete: stats.testComplete,
                    share: stats.share,
                    sessionEnd: stats.sessionEnd
                }
            };
        }

        // 요약 정보
        const totalUsers = Object.values(variantStats).reduce((sum, v) => sum + v.users.size, 0);
        const totalEvents = filteredEvents.length;

        res.json({
            testId,
            metrics,
            summary: {
                totalUsers,
                totalEvents,
                dateRange: {
                    start: startDate || 'all',
                    end: endDate || 'now'
                }
            }
        });
    } catch (error) {
        console.error('메트릭 계산 오류:', error);
        res.status(500).json({ error: '메트릭 계산 실패' });
    }
});

/**
 * GET /api/ab-config
 * A/B 테스트 설정 반환
 */
router.get('/api/ab-config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'ab-test-config.json');

        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            res.json(config);
        } else {
            res.status(404).json({ error: '설정 파일 없음' });
        }
    } catch (error) {
        console.error('설정 읽기 오류:', error);
        res.status(500).json({ error: '설정 읽기 실패' });
    }
});

/**
 * POST /api/ab-config
 * A/B 테스트 설정 업데이트
 */
router.post('/api/ab-config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'ab-test-config.json');

        fs.writeFileSync(
            configPath,
            JSON.stringify(req.body, null, 2)
        );

        res.json({ success: true, message: '설정 업데이트 완료' });
    } catch (error) {
        console.error('설정 업데이트 오류:', error);
        res.status(500).json({ error: '설정 업데이트 실패' });
    }
});

/**
 * GET /api/ab-statistical-test
 * 통계적 유의성 검정
 */
router.get('/api/ab-statistical-test', (req, res) => {
    try {
        const { testId, metricName, variantA, variantB } = req.query;

        initDataDir();

        if (!fs.existsSync(EVENTS_FILE)) {
            return res.json({ error: '데이터 없음' });
        }

        // 이벤트 파일 읽기
        const events = fs.readFileSync(EVENTS_FILE, 'utf8')
            .trim()
            .split('\n')
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(e => e !== null && e.testData?.testId === testId);

        // 변형별 데이터 추출
        const getMetricValue = (events, variantId, metricName) => {
            const variantEvents = events.filter(e => e.testData?.variantId === variantId);

            switch (metricName) {
                case 'completion_rate':
                    const completed = variantEvents.filter(e => e.eventName === 'test_complete').length;
                    const assigned = variantEvents.filter(e => e.eventName === 'test_assigned').length;
                    return assigned > 0 ? completed / assigned : 0;
                case 'share_rate':
                    const shares = variantEvents.filter(e => e.eventName === 'share').length;
                    const totalShares = variantEvents.filter(e => e.eventName === 'test_assigned').length;
                    return totalShares > 0 ? shares / totalShares : 0;
                default:
                    return 0;
            }
        };

        const pA = getMetricValue(events, variantA, metricName);
        const pB = getMetricValue(events, variantB, metricName);

        const nA = new Set(events.filter(e => e.testData?.variantId === variantA).map(e => e.userId)).size;
        const nB = new Set(events.filter(e => e.testData?.variantId === variantB).map(e => e.userId)).size;

        // Z-테스트 (비율 비교)
        const pooledP = (pA * nA + pB * nB) / (nA + nB);
        const se = Math.sqrt(pooledP * (1 - pooledP) * (1/nA + 1/nB));
        const z = se > 0 ? (pA - pB) / se : 0;

        // 양측 p-값
        const pValue = 2 * (1 - normalCDF(Math.abs(z)));

        // 결과
        const significant = pValue < 0.05;
        const winner = pA > pB ? variantA : variantB;
        const lift = pB > 0 ? ((pA - pB) / pB) * 100 : 0;

        res.json({
            testId,
            metricName,
            variantA: { id: variantA, value: pA, n: nA },
            variantB: { id: variantB, value: pB, n: nB },
            statisticalTest: {
                zScore: parseFloat(z.toFixed(4)),
                pValue: parseFloat(pValue.toFixed(4)),
                significant,
                confidence: significant ? 95 : null,
                winner,
                lift: parseFloat(lift.toFixed(2))
            }
        });
    } catch (error) {
        console.error('통계 검정 오류:', error);
        res.status(500).json({ error: '통계 검정 실패' });
    }
});

// 표준 정규 분포 CDF (근사치)
function normalCDF(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
}

module.exports = router;
