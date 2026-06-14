// ============================================================
// /api/render  -- A/B 콘텐츠에 추적 로직 + 플로팅 버튼을 주입해 내려주는 핵심 함수
//
// [동작]
//   /            -> 쿠키 기반 50:50 랜덤 (없으면 새로 배정)
//   /a           -> 강제 A (테스트용)
//   /b           -> 강제 B (테스트용)
//
// [주입 위치]
//   </head> 앞 : GA gtag + Meta pixel + AB 배정 스크립트
//   </body> 앞 : 공통 플로팅 버튼 + 이벤트(클릭/스크롤) 스크립트
//
// 디자이너는 pages/A.html, pages/B.html, partials/floating-button.html 만 수정.
// 이 파일(추적 로직)은 디자이너가 건드리지 않는다.
// ============================================================

const fs = require('fs');
const path = require('path');

// ----- 설정값 -----
const GA_ID = 'G-VMNDG3DTXX';
const META_PIXEL_ID = '1606841370427807';
const PROD = { idx: '3', name: 'buddycane', price: 129000, currency: 'KRW' };

// 파일 경로: 이 파일은 /api 안 -> 루트는 한 단계 위.
// Vercel 서버리스에서 process.cwd()는 신뢰 불가, __dirname 기준으로 잡는다.
const ROOT = path.join(__dirname, '..');
function readFileSafe(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.readFileSync(full, 'utf-8');
}

// ----- <head>에 주입할 추적/AB 스크립트 -----
function headInjection() {
  return `
<!-- ===== [주입] GA4 + Meta + AB 배정 (자동 생성, 수정 금지) ===== -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  // AB 버전: 서버가 정해 window.SHL_AB_VARIANT 로 주입함 (아래 body 주입부 참고)
  var abVariant = window.SHL_AB_VARIANT;

  // 사용자 속성 (사용자 범위)
  gtag('set', 'user_properties', { ab_variant: abVariant });

  // 크로스도메인
  gtag('config', '${GA_ID}', {
    'linker': { 'domains': ['shl.ltd', 'buddycane.shl.ltd'], 'accept_incoming': true }
  });

  // view_item (ab_variant 이벤트 매개변수로 직접 부착)
  gtag('event', 'view_item', {
    currency: '${PROD.currency}', value: ${PROD.price}, ab_variant: abVariant,
    items: [{ item_id: '${PROD.idx}', item_name: '${PROD.name}', price: ${PROD.price} }]
  });
</script>

<!-- Meta Pixel -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${META_PIXEL_ID}');
  fbq('track', 'PageView');
  fbq('track', 'ViewContent', {
    content_name: '${PROD.name}', content_type: 'product',
    value: ${PROD.price}, currency: '${PROD.currency}'
  });
</script>

<!-- Microsoft Clarity -->
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "x75e2wiont");
</script>
`;
}

// ----- AB 변수를 페이지 최상단에 먼저 심는 스크립트 (head 주입보다 먼저 실행돼야 함) -----
function abVariantBootScript(variant) {
  return `<script>window.SHL_AB_VARIANT = ${JSON.stringify(variant)};</script>`;
}

// ----- </body> 앞에 주입할 플로팅 버튼 + 이벤트 스크립트 -----
function bodyInjection(floatingButtonHtml) {
  return `
<!-- ===== [주입] 공통 플로팅 버튼 ===== -->
${floatingButtonHtml}

<!-- Meta noscript -->
<noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1"/></noscript>

<!-- ===== [주입] 주문 + 이벤트 로직 (자동 생성, 수정 금지) ===== -->
<script>
  // ============================================================
  // 주문 prefetch 전략
  //  - 페이지가 한가해지면(idle) 백그라운드로 주문을 미리 생성해 paymentUrl 확보
  //  - 주문하기 클릭 시: 준비됐으면 즉시 이동 / 진행중이면 그 요청을 기다림 / 아직이면 즉시 호출
  //  - 초기 로딩 부하 타이밍은 requestIdleCallback 으로 회피
  // ============================================================
  var shlPrefetch = {
    status: 'idle',   // 'idle' | 'loading' | 'ready' | 'failed'
    promise: null,    // 진행 중인 요청 Promise
    paymentUrl: null
  };
  var shlClicked = false; // 클릭으로 인한 이동이 시작됐는지

  // 실제 주문 생성 요청 (한 번만 의미있게 실행되도록 status로 가드)
  function shlCreateOrder() {
    if (shlPrefetch.status === 'ready') {
      return Promise.resolve(shlPrefetch.paymentUrl);
    }
    if (shlPrefetch.status === 'loading' && shlPrefetch.promise) {
      return shlPrefetch.promise; // 이미 진행 중인 요청 재사용 (중복 호출 방지)
    }
    shlPrefetch.status = 'loading';
    shlPrefetch.promise = fetch('/api/order', { method: 'POST' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.ok && data.paymentUrl) {
          shlPrefetch.status = 'ready';
          shlPrefetch.paymentUrl = data.paymentUrl;
          return data.paymentUrl;
        } else {
          shlPrefetch.status = 'failed';
          throw new Error(data && data.reason ? data.reason : 'NO_PAYMENT_URL');
        }
      })
      .catch(function (err) {
        shlPrefetch.status = 'failed';
        shlPrefetch.promise = null; // 실패 시 재시도 가능하도록
        throw err;
      });
    return shlPrefetch.promise;
  }

  // 한가해지면 백그라운드 prefetch (초기 로딩 부하 회피)
  function shlSchedulePrefetch() {
    if (window.requestIdleCallback) {
      requestIdleCallback(function () { shlCreateOrder().catch(function(){}); }, { timeout: 4000 });
    } else {
      // 미지원 브라우저: 로드 후 약간의 여유를 두고 실행
      setTimeout(function () { shlCreateOrder().catch(function(){}); }, 1500);
    }
  }
  if (document.readyState === 'complete') {
    shlSchedulePrefetch();
  } else {
    window.addEventListener('load', shlSchedulePrefetch);
  }

  // 주문하기 클릭
  async function shlBuy() {
    if (shlClicked) return;
    shlClicked = true;
    var btn = document.getElementById('shlBuyBtn');

    // 이벤트 발사 (이동 전에)
    if (typeof gtag === 'function') {
      gtag('event', 'click_buy_now', {
        currency: '${PROD.currency}', value: ${PROD.price}, ab_variant: window.SHL_AB_VARIANT,
        items: [{ item_id: '${PROD.idx}', item_name: '${PROD.name}', price: ${PROD.price} }]
      });
    }
    if (typeof fbq === 'function') {
      fbq('track', 'InitiateCheckout', { content_name: '${PROD.name}', value: ${PROD.price}, currency: '${PROD.currency}' });
    }

    // 1) 이미 준비됨 -> 즉시 이동
    if (shlPrefetch.status === 'ready' && shlPrefetch.paymentUrl) {
      window.location.href = shlPrefetch.paymentUrl;
      return;
    }

    // 2) 아직 준비 안 됨(진행중이거나 시작 전) -> 요청 보장 후 이동
    if (btn) { btn.disabled = true; btn.dataset.originalText = btn.textContent; btn.textContent = '처리 중...'; }
    try {
      var url = await shlCreateOrder(); // 진행중이면 그 Promise를, 아니면 새로 호출
      window.location.href = url;
    } catch (err) {
      alert('주문 처리 중 오류: ' + err.message);
      resetBtn();
    }
  }
  function resetBtn() {
    shlClicked = false;
    var btn = document.getElementById('shlBuyBtn');
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.originalText || '주문하기'; }
  }

  // 스크롤 뎁스 (1=시작/10/25/50/75)
  (function () {
    var thresholds = [1, 10, 25, 50, 75], fired = {};
    function onScroll() {
      var st = window.scrollY || document.documentElement.scrollTop;
      var dh = document.documentElement.scrollHeight - window.innerHeight;
      if (dh <= 0) return;
      var pct = (st / dh) * 100;
      thresholds.forEach(function (t) {
        if (pct >= t && !fired[t]) {
          fired[t] = true;
          if (typeof gtag === 'function') gtag('event', 'scroll', { percent_scrolled: t, ab_variant: window.SHL_AB_VARIANT });
        }
      });
      if (thresholds.every(function (t) { return fired[t]; })) window.removeEventListener('scroll', onScroll);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  // 히어로(첫 화면) 실제 노출 측정
  //  - 페이지 첫 화면이 사용자에게 실제로 보였을 때 1회 발사
  //  - 백그라운드 탭(로드만 되고 안 본 경우)은 제외
  (function () {
    var fired = false;
    function fireHeroView() {
      if (fired) return;
      // 화면이 실제로 보이는 상태일 때만
      if (document.visibilityState !== 'visible') return;
      fired = true;
      if (typeof gtag === 'function') {
        gtag('event', 'hero_view', { ab_variant: window.SHL_AB_VARIANT });
      }
    }
    function start() {
      if (document.visibilityState === 'visible') {
        fireHeroView();
      } else {
        // 지금은 백그라운드 -> 사용자가 탭을 보는 순간 발사
        document.addEventListener('visibilitychange', function onVis() {
          if (document.visibilityState === 'visible') {
            document.removeEventListener('visibilitychange', onVis);
            fireHeroView();
          }
        });
      }
    }
    // 첫 페인트 이후 발사 (콘텐츠가 그려진 다음)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  })();
</script>
`;
}

// ----- 메인 핸들러 -----
module.exports = function handleRender(req, res, forcedVariant) {
  try {
    // 1. AB 변수 결정
    let variant = forcedVariant; // 'A' | 'B' | undefined
    let setCookieHeader = null;

    if (variant !== 'A' && variant !== 'B') {
      // 쿠키 확인
      const cookie = req.headers.cookie || '';
      const m = cookie.match(/(?:^|;)\s*ab_variant\s*=\s*([^;]+)/);
      const existing = m ? m[1] : null;
      if (existing === 'A' || existing === 'B') {
        variant = existing;
      } else {
        // 50:50 신규 배정
        variant = Math.random() < 0.5 ? 'A' : 'B';
        const exp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
        setCookieHeader = 'ab_variant=' + variant + '; Expires=' + exp + '; Path=/; Domain=.shl.ltd; SameSite=Lax';
      }
    }
    // 강제 모드(/a,/b)에서도 쿠키를 그 값으로 맞춰줘서 결제페이지까지 일관 유지
    if (forcedVariant === 'A' || forcedVariant === 'B') {
      const exp = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
      setCookieHeader = 'ab_variant=' + forcedVariant + '; Expires=' + exp + '; Path=/; Domain=.shl.ltd; SameSite=Lax';
    }

    // 2. 콘텐츠 + 플로팅 버튼 읽기
    const pageFile = variant === 'A' ? 'public/a/index.html' : 'public/b/index.html';
    let html = readFileSafe(pageFile);
    const floatingBtn = readFileSafe('partials/floating-button.html');

    // 3. 주입
    //   - <head> 시작 직후에 abVariant boot 스크립트 (가장 먼저 실행)
    //   - </head> 앞에 추적 스크립트
    //   - </body> 앞에 플로팅 버튼 + 이벤트
    const boot = abVariantBootScript(variant);

    if (html.indexOf('<head>') !== -1) {
      html = html.replace('<head>', '<head>\n' + boot);
    } else {
      // head 없으면 맨 앞에
      html = boot + html;
    }

    if (html.indexOf('</head>') !== -1) {
      html = html.replace('</head>', headInjection() + '\n</head>');
    } else {
      html = headInjection() + html;
    }

    if (html.indexOf('</body>') !== -1) {
      html = html.replace('</body>', bodyInjection(floatingBtn) + '\n</body>');
    } else {
      html = html + bodyInjection(floatingBtn);
    }

    // 4. 응답
    if (setCookieHeader) res.setHeader('Set-Cookie', setCookieHeader);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store'); // AB 랜덤이 캐시에 굳지 않게
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('render error: ' + err.message);
  }
};
