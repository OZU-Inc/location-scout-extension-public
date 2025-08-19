# ロケハンスライド自動生成Chrome拡張機能 - 詳細企画書

## 1. プロジェクト概要

### 製品名
**Location Scout Slide Generator**

### 目的
現在閲覧中のWebページから場所情報を自動抽出し、ロケハン用のGoogleスライドを即座に生成するChrome拡張機能

### 主要機能
- ワンクリックで現在のページから場所情報を抽出
- GPT-4 APIを使用した高精度な情報解析
- Google Slidesへの自動出力
- カスタマイズ可能なスライドテンプレート

## 2. 技術仕様

### 必要なAPI・サービス
1. **OpenAI API**
   - モデル: GPT-4o または GPT-4o-mini
   - 用途: ページコンテンツの解析と構造化

2. **Google APIs**
   - Google Slides API v1
   - Google Drive API v3
   - OAuth 2.0認証

3. **Chrome Extension APIs**
   - chrome.tabs（タブ操作）
   - chrome.storage（設定保存）
   - chrome.identity（OAuth認証）
   - chrome.runtime（バックグラウンド処理）

### アーキテクチャ

```
┌─────────────────────────────────────────┐
│         Chrome Extension                 │
├─────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐  │
│  │  Popup UI    │────│Content Script│  │
│  └──────────────┘    └──────────────┘  │
│          │                   │          │
│          ▼                   ▼          │
│  ┌──────────────────────────────────┐  │
│  │    Background Service Worker      │  │
│  └──────────────────────────────────┘  │
│                    │                    │
└────────────────────┼────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌─────────┐ ┌──────────┐
   │GPT API  │ │Google   │ │Chrome    │
   │         │ │Slides   │ │Storage   │
   └─────────┘ └─────────┘ └──────────┘
```

## 3. 詳細機能仕様

### 3.1 情報抽出プロセス

1. **ページ内容の取得**
   - DOM全体のテキストコンテンツを取得
   - メタデータ（title, description, og:tags）を収集
   - 画像URLの収集（最大10枚）

2. **GPT APIによる解析**
   - 入力: ページのテキストコンテンツとメタデータ
   - プロンプト例:
   ```
   以下のWebページから場所・施設に関する情報を抽出してください：
   - 名称
   - 住所
   - アクセス方法
   - 営業時間
   - 特徴・見どころ
   - 撮影に適したポイント
   - 注意事項
   ```
   - 出力: 構造化されたJSON形式

3. **データ構造**
   ```json
   {
     "locationName": "場所名",
     "address": "住所",
     "access": "アクセス方法",
     "businessHours": "営業時間",
     "features": ["特徴1", "特徴2"],
     "photoSpots": ["撮影ポイント1", "撮影ポイント2"],
     "notes": "注意事項",
     "images": ["URL1", "URL2"],
     "sourceUrl": "元のWebページURL"
   }
   ```

### 3.2 スライド生成仕様

#### デフォルトテンプレート構成（5スライド）

1. **タイトルスライド**
   - タイトル: [場所名]
   - サブタイトル: ロケハン資料
   - 日付: 自動挿入

2. **概要スライド**
   - 場所名
   - 住所
   - アクセス方法
   - 営業時間

3. **特徴・見どころスライド**
   - 箇条書きで特徴を列挙
   - 撮影に適したポイント

4. **画像スライド**
   - 最大4枚の画像をグリッド配置
   - キャプション付き

5. **注意事項・メモスライド**
   - 撮影時の注意点
   - 連絡先情報
   - 参照URL

### 3.3 カスタマイズ機能

#### テンプレート設定
```json
{
  "template": {
    "slideCount": 5,
    "slides": [
      {
        "type": "TITLE",
        "layout": "TITLE_AND_BODY",
        "elements": ["title", "subtitle", "date"]
      },
      {
        "type": "CONTENT",
        "layout": "TITLE_AND_TWO_COLUMNS",
        "elements": ["locationInfo", "access"]
      }
    ],
    "theme": {
      "fontFamily": "Noto Sans JP",
      "primaryColor": "#1a73e8",
      "secondaryColor": "#34a853"
    }
  }
}
```

## 4. 実装手順

### Phase 1: 基本構造（Day 1-2）
- manifest.json作成
- ポップアップUI実装
- Content Script基本実装
- Background Service Worker設定

### Phase 2: API連携（Day 3-4）
- OpenAI API統合
- プロンプトエンジニアリング
- Google OAuth認証実装
- Google Slides API接続

### Phase 3: コア機能（Day 5-7）
- ページ情報抽出ロジック
- GPT解析処理
- スライド生成ロジック
- エラーハンドリング

### Phase 4: UI/UX改善（Day 8-9）
- 設定画面実装
- プログレス表示
- エラーメッセージ
- 成功通知

### Phase 5: テスト・最適化（Day 10）
- 各種サイトでのテスト
- パフォーマンス最適化
- バグ修正

## 5. セキュリティ考慮事項

### APIキー管理
- APIキーは拡張機能の設定画面から入力
- chrome.storage.localに暗号化して保存
- バックグラウンドスクリプトでのみ使用

### 権限管理
```json
{
  "permissions": [
    "activeTab",
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://*/*",
    "http://*/*"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID",
    "scopes": [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive.file"
    ]
  }
}
```

## 6. 使用フロー

1. **初回設定**
   - 拡張機能インストール
   - OpenAI APIキー設定
   - Googleアカウント連携

2. **通常使用**
   - ロケ地情報のあるWebページを開く
   - 拡張機能アイコンをクリック
   - 「スライド生成」ボタンを押す
   - 進捗表示（解析中→生成中→完了）
   - Google Slidesへのリンク表示

3. **カスタマイズ**
   - 設定画面でテンプレート選択
   - スライド形式の調整
   - 出力先フォルダの指定

## 7. 制限事項と対策

### 技術的制限
- **スクレイピング不使用**: GPT APIのみで情報抽出するため、構造化されていないページでは精度が低下する可能性
- **対策**: プロンプトの最適化、複数回の解析試行

### API制限
- **GPT API**: レート制限とトークン制限
- **Google Slides API**: 1分あたり60リクエスト
- **対策**: キャッシング、バッチ処理、エラーリトライ

## 8. 拡張可能性

### 将来的な機能追加
1. **マルチ言語対応**
2. **地図連携**（Google Maps埋め込み）
3. **天気情報の自動取得**
4. **複数ページの一括処理**
5. **PDFエクスポート機能**
6. **チーム共有機能**

## 9. 開発環境要件

### 必要なツール
- Node.js 18+
- npm または yarn
- Chrome Browser（開発者モード）
- Visual Studio Code（推奨）

### 開発用パッケージ
```json
{
  "devDependencies": {
    "@types/chrome": "^0.0.260",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.4",
    "typescript": "^5.3.0",
    "eslint": "^8.56.0"
  },
  "dependencies": {
    "openai": "^4.28.0",
    "googleapis": "^134.0.0"
  }
}
```

## 10. 成功指標

### KPI
- スライド生成成功率: 95%以上
- 平均生成時間: 30秒以内
- 情報抽出精度: 80%以上

### ユーザビリティ目標
- 3クリック以内で生成完了
- 直感的なUI
- エラー時の明確なフィードバック