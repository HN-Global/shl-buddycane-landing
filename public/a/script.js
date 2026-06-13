/* script.js - Interactive Scripts and Performance Optimizations for A/B Test Landing Page */

document.addEventListener('DOMContentLoaded', () => {
    // 로딩 속도 최적화 1: YouTube iframe 지연 로딩
    // 초기 로딩 시 페이지 렌더링에 방해되지 않도록 스크롤 할 때 또는 일정 시간 후에 비디오 리소스를 로드합니다.
    const lazyIframes = document.querySelectorAll('iframe[data-src]');
    
    // Intersection Observer를 사용하여 화면에 보일 때만 비디오 로드 (더 높은 최적화)
    if ('IntersectionObserver' in window) {
        let iframeObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    let iframe = entry.target;
                    iframe.src = iframe.dataset.src;
                    iframe.removeAttribute('data-src');
                    iframeObserver.unobserve(iframe);
                }
            });
        }, {
            rootMargin: '200px 0px', // 화면에 보이기 200px 전부터 로딩 시작
            threshold: 0.01
        });

        lazyIframes.forEach(function(iframe) {
            iframeObserver.observe(iframe);
        });
    } else {
        // Fallback for older browsers
        lazyIframes.forEach(iframe => {
            iframe.src = iframe.dataset.src;
        });
    }

    // 모의 구매하기 함수 (구매 스크립트가 로드되지 않았을 경우 대비)
    if (typeof window.shlBuy !== 'function') {
        window.shlBuy = function() {
            window.location.href = 'https://shl.ltd/shop_view/?idx=3';
        };
    }

    // 동적으로 partials/floating-button.html을 불러오는 로직 (개발 및 테스트 용도)
    // 실제 서버 환경에서는 서버사이드 인클루드를 사용하는 것이 좋습니다.
    const floatingContainer = document.getElementById('floating-button-container');
    if (floatingContainer) {
        fetch('/partials/floating-button.html')
            .then(response => {
                if (response.ok) return response.text();
                throw new Error('Network response was not ok.');
            })
            .then(html => {
                floatingContainer.innerHTML = html;
            })
            .catch(error => console.error('Error loading floating button:', error));
    }
});
