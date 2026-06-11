# SHL 버디케인 랜딩 (A/B 테스트)

## 디자이너가 작업하는 곳 (여기만 수정하세요)

```
public/
├── a/              ← A 버전. 이 폴더 안만 수정
│   ├── index.html      페이지 내용
│   ├── style.css       스타일
│   └── images/         이미지 (여기에 넣고 /a/images/파일명 으로 사용)
└── b/              ← B 버전. 이 폴더 안만 수정
    ├── index.html
    ├── style.css
    └── images/

partials/
└── floating-button.html   ← 하단 "주문하기" 버튼 (디자인/문구만 수정)
```

### 규칙
- **A 버전**은 `public/a/` 폴더 안에서만, **B 버전**은 `public/b/` 폴더 안에서만 작업합니다.
- 이미지는 해당 폴더의 `images/`에 넣고, html에서 `/a/images/파일명.png` (B면 `/b/images/...`) 로 불러옵니다.
- `index.html`은 `<head>`와 `<body>` 태그 구조를 정상적으로 유지해 주세요. (그 안 내용은 자유)
- 플로팅 버튼(`partials/floating-button.html`)은 디자인과 문구를 바꿔도 되지만,
  **버튼의 `id="shlBuyBtn"` 와 `onclick="shlBuy()"` 두 가지는 절대 지우지 마세요.** (주문 기능 연결됨)

## 절대 건드리지 않는 곳
```
api/            ← 추적/주문/AB 로직. 수정 금지
vercel.json     ← 배포 설정. 수정 금지
```

## 미리보기 주소 (배포 후)
- `buddycane.shl.ltd/a` → A 버전만 보기
- `buddycane.shl.ltd/b` → B 버전만 보기
- `buddycane.shl.ltd`   → 실제 방문자에게 보이는 화면 (A/B 랜덤)
