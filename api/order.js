// /api/order  -- 버셀 서버리스 함수 (주문 생성 프록시)
// 클라이언트(buddycane 랜딩)에서 same-origin으로 호출 -> 여기서 아임웹에 서버-투-서버로 요청
// -> CORS 없음. 응답의 back_url_base64를 디코딩해서 결제페이지 경로를 돌려준다.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 아임웹 OMS_add_order 에 보낼 body (실제 주문 요청과 동일한 파라미터)
    const params = new URLSearchParams();
    params.append('backurl', 'https://shl.ltd/buddycane');
    params.append('prodIdx', '3');
    params.append('orderCount', '1');
    params.append('type', 'normal');
    params.append('deliv_type', 'parcel');
    params.append('deliv_pay_type', 'price');
    params.append('deliv_country', 'KR');
    params.append('is_gift_buy', 'false');
    params.append('shipping_template_code', 'T2025091524fc192cfdb2d');
    params.append('infoUrl', 'https://shl.ltd');

    const imwebRes = await fetch('https://shl.ltd/shop/oms/OMS_add_order.cm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        'imweb-landing-url': 'https://shl.ltd/buddycane',
        'referer': 'https://shl.ltd/buddycane'
      },
      body: params.toString()
    });

    // 아임웹이 내려준 Set-Cookie (게스트 세션 등)를 클라이언트로 전달 시도
    // (비회원 주문이 게스트 세션을 필요로 하는 경우 대비)
    const setCookie = imwebRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    const data = await imwebRes.json();

    if (data && data.back_url_base64) {
      // base64 디코딩 -> 결제페이지 경로 (/shop_payment/?order_code=...)
      const path = Buffer.from(data.back_url_base64, 'base64').toString('utf-8');
      const paymentUrl = 'https://shl.ltd' + path;
      res.status(200).json({
        ok: true,
        paymentUrl: paymentUrl,
        order_code: data.order_code || null,
        ic_event_id: data.ic_event_id || null,
        total_price: data.total_price || null,
        raw_msg: data.msg || null
      });
    } else {
      // 주문 실패 (배송, 세션 등). 원본 응답을 그대로 돌려줘서 디버깅
      res.status(200).json({
        ok: false,
        reason: data && data.msg ? data.msg : 'NO_BACK_URL',
        raw: data
      });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
