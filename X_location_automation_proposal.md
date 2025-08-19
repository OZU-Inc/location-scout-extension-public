# 撮影ロケ地情報自動収集・スライド作成システム企画書

## エグゼクティブサマリー
本企画書では、撮影ロケ地の情報収集からGoogleスライド資料作成までを自動化するシステムを提案します。プログラミング知識不要で、URLを入力するだけで完成したスライドが作成される仕組みを実現します。

## 実現可能な技術案

### 案1: Google Apps Script（GAS）ベースのソリューション 【推奨】
**概要**: Google Workspace内で完結する自動化システム

**技術スタック**:
- Google Apps Script（スプレッドシート内で実行）
- Puppeteer API または Cheerio（スクレイピング）
- OpenAI API（情報抽出・検証）
- Google Sheets API
- Google Slides API

**実装方法**:
1. Googleスプレッドシートに専用シートを作成
2. カスタムメニューを追加（「ロケ地情報を取得」ボタン）
3. URL入力セルにURLを貼り付けてボタンクリック
4. 自動でスライドが生成される

**メリット**:
- ✅ インストール不要（ブラウザのみで動作）
- ✅ Google製品との完璧な連携
- ✅ 共有・配布が簡単
- ✅ 無料で運用可能（API利用料のみ）

**デメリット**:
- ⚠️ 実行時間制限あり（6分/実行）
- ⚠️ スクレイピング機能に制限

---

### 案2: Chrome拡張機能
**概要**: ブラウザ拡張機能として実装

**技術スタック**:
- Chrome Extension API
- Content Scripts（スクレイピング）
- Google APIs（OAuth2認証）
- OpenAI API

**実装方法**:
1. Chrome拡張機能をインストール
2. ロケ地サイトを開いて拡張機能ボタンをクリック
3. 自動で情報抽出・スライド作成

**メリット**:
- ✅ ワンクリック操作
- ✅ 強力なスクレイピング機能
- ✅ リアルタイムプレビュー可能

**デメリット**:
- ⚠️ Chrome限定
- ⚠️ 拡張機能のインストールが必要
- ⚠️ セキュリティポリシーによる制限の可能性

---

### 案3: ローカルアプリケーション（Electron）
**概要**: デスクトップアプリとして提供

**技術スタック**:
- Electron（クロスプラットフォーム）
- Playwright（スクレイピング）
- Google APIs
- OpenAI API

**実装方法**:
1. アプリをダウンロード・インストール
2. アプリを起動してURLを入力
3. 「実行」ボタンで自動処理

**メリット**:
- ✅ 高機能・高速処理
- ✅ オフライン処理部分も実装可能
- ✅ バッチ処理対応

**デメリット**:
- ⚠️ インストールが必要
- ⚠️ アップデート配布が必要
- ⚠️ 開発・保守コストが高い

---

### 案4: Webアプリケーション（SaaS）
**概要**: ブラウザベースのWebサービス

**技術スタック**:
- Next.js / React（フロントエンド）
- Node.js（バックエンド）
- Puppeteer / Playwright（サーバーサイドスクレイピング）
- Google APIs
- OpenAI API

**実装方法**:
1. 専用WebサイトにアクセスしてGoogleアカウントでログイン
2. URLを入力して実行
3. 結果をGoogleドライブに自動保存

**メリット**:
- ✅ どこからでもアクセス可能
- ✅ アップデート即時反映
- ✅ 複数ユーザー対応

**デメリット**:
- ⚠️ サーバー運用コスト
- ⚠️ 初回ログインが必要

---

### 案5: Google Colab + Python
**概要**: Googleが提供する無料のPython実行環境を活用

**技術スタック**:
- Python（BeautifulSoup, Selenium）
- Google Colab
- gspread（Googleスプレッドシート連携）
- python-pptx → Google Slides API

**実装方法**:
1. 共有されたColabノートブックを開く
2. URLを入力して実行ボタンをクリック
3. 自動で処理が実行される

**メリット**:
- ✅ 完全無料
- ✅ 強力なスクレイピング機能
- ✅ GPUも利用可能

**デメリット**:
- ⚠️ セッション時間制限
- ⚠️ 多少の技術的理解が必要

---

## 推奨ソリューション: Google Apps Script（案1）の詳細設計

### システム構成図
```
[ユーザー] 
    ↓ URLを入力
[Googleスプレッドシート]
    ↓ GASスクリプト実行
[情報収集処理]
    ├→ [Web Scraping API]
    └→ [OpenAI API（検証用）]
    ↓
[データ整形・保存]
    ↓
[Googleスライド自動生成]
    ↓
[完成スライド]
```

### 実装手順

#### 1. 初期セットアップ（開発者が実施）
```javascript
// Code.gs - メインスクリプト
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎬 ロケ地ツール')
    .addItem('📍 情報を取得してスライド作成', 'processLocation')
    .addItem('⚙️ 設定', 'showSettings')
    .addToUi();
}

function processLocation() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const url = sheet.getRange('B2').getValue();
  
  if (!url) {
    SpreadsheetApp.getUi().alert('URLを入力してください');
    return;
  }
  
  // 処理実行
  const locationData = scrapeLocationInfo(url);
  const verifiedData = verifyWithAI(locationData);
  saveToSheet(verifiedData);
  createSlide(verifiedData);
}
```

#### 2. スクレイピング処理
```javascript
function scrapeLocationInfo(url) {
  // URLFetchApp + Cheerio または専用APIを使用
  const response = UrlFetchApp.fetch(url);
  const content = response.getContentText();
  
  // パターンマッチングで情報抽出
  const data = {
    name: extractLocationName(content),
    address: extractAddress(content),
    access: {
      train: extractTrainAccess(content),
      car: extractCarAccess(content)
    },
    parking: extractParkingInfo(content),
    sourceUrl: url,
    scrapedAt: new Date()
  };
  
  return data;
}
```

#### 3. AI検証処理（ハルシネーション対策）
```javascript
function verifyWithAI(data) {
  const openaiApiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  
  const prompt = `
    以下の情報を検証してください。
    元URL: ${data.sourceUrl}
    
    抽出された情報:
    - 名称: ${data.name}
    - 住所: ${data.address}
    - アクセス: ${JSON.stringify(data.access)}
    
    この情報に明らかな誤りがある場合は修正してください。
    確信度も含めて返してください。
  `;
  
  // OpenAI APIコール
  const verification = callOpenAI(prompt);
  
  return {
    ...data,
    verified: true,
    confidence: verification.confidence,
    corrections: verification.corrections
  };
}
```

#### 4. Googleスライド生成
```javascript
function createSlide(data) {
  // テンプレートスライドをコピー
  const templateId = 'TEMPLATE_SLIDE_ID';
  const presentation = SlidesApp.openById(templateId);
  const newPresentation = DriveApp.getFileById(templateId).makeCopy(
    `ロケ地_${data.name}_${Utilities.formatDate(new Date(), 'JST', 'yyyyMMdd')}`
  );
  
  const slides = SlidesApp.openById(newPresentation.getId());
  
  // プレースホルダーを置換
  replaceText(slides, '{{LOCATION_NAME}}', data.name);
  replaceText(slides, '{{ADDRESS}}', data.address);
  replaceText(slides, '{{TRAIN_ACCESS}}', data.access.train);
  replaceText(slides, '{{CAR_ACCESS}}', data.access.car);
  replaceText(slides, '{{PARKING}}', data.parking);
  
  // 画像があれば挿入
  if (data.images && data.images.length > 0) {
    insertImages(slides, data.images);
  }
  
  // URLをスプレッドシートに記録
  recordSlideUrl(newPresentation.getUrl());
}
```

### ユーザー操作手順

1. **初回設定（5分で完了）**
   - 共有されたGoogleスプレッドシートをコピー
   - OpenAI APIキーを設定（オプション）

2. **日常利用**
   - スプレッドシートを開く
   - B2セルにロケ地URLを貼り付け
   - メニューから「情報を取得してスライド作成」をクリック
   - 30秒〜1分で完成

### ハルシネーション対策

1. **多層検証アプローチ**
   ```javascript
   // 信頼性スコアリング
   function calculateReliability(data) {
     const checks = [
       checkAddressFormat(data.address),     // 住所形式チェック
       checkPostalCode(data.address),        // 郵便番号検証
       checkPhoneFormat(data.phone),         // 電話番号形式
       crossCheckWithGoogleMaps(data),       // Google Maps API検証
     ];
     
     return checks.reduce((acc, check) => acc + check.score, 0) / checks.length;
   }
   ```

2. **情報源の明示**
   - スクレイピング元URLを常に記録
   - 抽出日時を記録
   - 信頼度スコアを表示

3. **人間による確認ポイント**
   - 低信頼度の項目をハイライト
   - 確認チェックボックスを設置

### 拡張機能案

1. **バッチ処理対応**
   - 複数URLの一括処理
   - 進捗表示とエラーハンドリング

2. **画像自動収集**
   - ロケ地写真の自動取得
   - スライドへの自動配置

3. **料金情報の追加**
   - 利用料金の自動抽出
   - 料金表の自動生成

4. **地図の自動生成**
   - Google Maps静的画像の挿入
   - アクセスマップの作成

5. **履歴管理**
   - 過去の検索履歴
   - お気に入り機能

### 導入スケジュール

| フェーズ | 期間 | 内容 |
|---------|------|------|
| 開発 | 1週間 | GASスクリプト開発・テスト |
| テスト | 3日 | 実際のロケ地サイトでテスト |
| 導入 | 1日 | ユーザー環境へのセットアップ |
| 運用開始 | - | マニュアル提供・サポート開始 |

### コスト試算

| 項目 | 月額費用 |
|------|---------|
| Google Workspace | 既存契約内で対応 |
| OpenAI API | 約1,000円（月100件想定） |
| 開発費用 | 初期のみ |
| 保守・運用 | 最小限 |

### まとめ

Google Apps Scriptベースのソリューションが最適です。理由：
- ✅ ユーザーの技術レベルに最適
- ✅ Google製品との完璧な統合
- ✅ インストール不要
- ✅ 低コストで運用可能
- ✅ 共有・配布が簡単

このシステムにより、URLを入力するだけで30秒〜1分で完成したスライドが作成され、作業時間を90%以上削減できます。