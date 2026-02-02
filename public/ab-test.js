/**
 * A/B Testing Library for Love Type Test
 * 버전: 1.0.0
 * 설명: 광고 배치 최적화 A/B 테스트 프레임워크
 */

class ABTestManager {
    constructor(config) {
        this.config = config;
        this.userId = this.getUserId();
        this.variants = this.getActiveVariants();
    }

    /**
     * 사용자 ID 생성 또는 가져오기
     */
    getUserId() {
        let userId = this.getCookie(this.config.globalSettings.userIdCookie);

        if (!userId) {
            userId = this.generateUserId();
            this.setCookie(
                this.config.globalSettings.userIdCookie,
                userId,
                this.config.globalSettings.cookieExpirationDays
            );
        }

        return userId;
    }

    /**
     * 랜덤 사용자 ID 생성
     */
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 쿠키 설정
     */
    setCookie(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    }

    /**
     * 쿠키 가져오기
     */
    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');

        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }

        return null;
    }

    /**
     * 활성 테스트의 변형 목록 가져오기
     */
    getActiveVariants() {
        const activeTests = this.config.activeTests.filter(test => test.status === 'active');
        return activeTests.flatMap(test => test.variants);
    }

    /**
     * 사용자에게 변형 할당 (해시 기반 일관성 보장)
     */
    assignVariant() {
        let variant = this.getCookie(this.config.globalSettings.variantCookie);

        if (!variant) {
            // 활성 테스트의 첫 번째 테스트 사용
            const test = this.config.activeTests.find(t => t.status === 'active');
            if (!test) return null;

            // 사용자 ID 기반 해시로 변형 선택
            const hash = this.hashUserId(this.userId);
            variant = this.selectVariantByHash(hash, test.variants);

            this.setCookie(
                this.config.globalSettings.variantCookie,
                variant.id,
                this.config.globalSettings.cookieExpirationDays
            );
        } else {
            // 쿠키에서 찾기
            const test = this.config.activeTests.find(t => t.status === 'active');
            if (!test) return null;
            variant = test.variants.find(v => v.id === variant);
        }

        return variant;
    }

    /**
     * 사용자 ID 해싱 (일관성 보장)
     */
    hashUserId(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32비트 정수로 변환
        }
        return Math.abs(hash);
    }

    /**
     * 해시 기반 변형 선택
     */
    selectVariantByHash(hash, variants) {
        const cumulativeWeights = [];
        let sum = 0;

        // 누적 가중치 계산
        for (const variant of variants) {
            sum += variant.weight;
            cumulativeWeights.push({ variant, threshold: sum });
        }

        // 해시를 [0, 1] 범위로 정규화
        const normalizedHash = (hash % 10000) / 10000;

        // 적절한 변형 선택
        for (const item of cumulativeWeights) {
            if (normalizedHash < item.threshold) {
                return item.variant;
            }
        }

        return variants[variants.length - 1];
    }

    /**
     * 현재 테스트 설정 가져오기
     */
    getTestConfig() {
        const test = this.config.activeTests.find(t => t.status === 'active');
        if (!test) return null;

        const variant = this.assignVariant();

        return {
            testId: test.id,
            testName: test.name,
            variantId: variant.id,
            variantName: variant.name,
            config: variant.config,
            metrics: test.metrics
        };
    }

    /**
     * 이벤트 트래킹
     */
    trackEvent(eventName, data = {}) {
        const testConfig = this.getTestConfig();

        const eventData = {
            userId: this.userId,
            timestamp: Date.now(),
            eventName,
            testData: {
                testId: testConfig.testId,
                variantId: testConfig.variantId,
                variantName: testConfig.variantName
            },
            data
        };

        if (this.config.globalSettings.analytics.enabled) {
            this.sendToAnalytics(eventData);
        }
    }

    /**
     * 분석 서버로 전송
     */
    async sendToAnalytics(eventData) {
        try {
            await fetch(this.config.globalSettings.trackingEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });
        } catch (error) {
            console.error('A/B 테스트 이벤트 전송 실패:', error);
        }
    }

    /**
     * 광고 표시 여부 확인
     */
    shouldShowAd(questionNumber) {
        const testConfig = this.getTestConfig();
        if (!testConfig) return false;

        const adConfig = testConfig.config;

        // 표시할 위치 확인
        if (adConfig.positions.includes(questionNumber)) {
            return true;
        }

        // 간격 확인
        if (questionNumber % adConfig.showInterval === 0) {
            return true;
        }

        return false;
    }

    /**
     * 광고 타입 가져오기
     */
    getAdType() {
        const testConfig = this.getTestConfig();
        return testConfig?.config?.adType || 'banner';
    }

    /**
     * 리워드 확인 (리워드 광고인 경우)
     */
    getReward() {
        const testConfig = this.getTestConfig();
        return testConfig?.config?.reward || null;
    }
}

// 전역 인스턴스 생성 (콘피그는 나중에 로드)
let abTestManager = null;

/**
 * A/B 테스트 매니저 초기화
 */
async function initABTest() {
    try {
        const response = await fetch('/ab-test-config.json');
        const config = await response.json();

        abTestManager = new ABTestManager(config);

        // 초기 할당 이벤트 트래킹
        const testConfig = abTestManager.getTestConfig();
        if (testConfig) {
            abTestManager.trackEvent('test_assigned', {
                testId: testConfig.testId,
                variantId: testConfig.variantId,
                variantName: testConfig.variantName
            });
        }

        return abTestManager;
    } catch (error) {
        console.error('A/B 테스트 초기화 실패:', error);
        return null;
    }
}

/**
 * A/B 테스트 광고 표시 함수
 */
function showABTestAd(questionNumber) {
    if (!abTestManager) return null;

    if (abTestManager.shouldShowAd(questionNumber)) {
        const adType = abTestManager.getAdType();
        const reward = abTestManager.getReward();

        // 광고 표시 이벤트 트래킹
        abTestManager.trackEvent('ad_shown', {
            questionNumber,
            adType,
            reward
        });

        return { adType, reward };
    }

    return null;
}

/**
 * 테스트 완료 이벤트 트래킹
 */
function trackTestComplete(data) {
    if (!abTestManager) return;

    abTestManager.trackEvent('test_complete', data);
}

/**
 * 공유 이벤트 트래킹
 */
function trackShare(platform) {
    if (!abTestManager) return;

    abTestManager.trackEvent('share', { platform });
}

/**
 * 세션 종료 이벤트 트래킹
 */
function trackSessionEnd(duration) {
    if (!abTestManager) return;

    abTestManager.trackEvent('session_end', { duration });
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initABTest);
