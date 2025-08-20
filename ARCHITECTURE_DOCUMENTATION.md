# Location Scout Extension - アーキテクチャ文書

## 📁 zipファイル構造

```
location-scout-extension-v1.0.0.zip (28.5KB)
├── README.md                           # プロジェクト概要・使用方法
├── SETUP_GUIDE.md                      # セットアップ詳細ガイド  
├── manifest.json                       # Chrome拡張機能設定ファイル
├── icons/                             # 拡張機能アイコン
│   ├── icon16.png                     # ツールバー用小アイコン
│   ├── icon48.png                     # 拡張機能管理画面用
│   ├── icon128.png                    # Chrome ウェブストア用大アイコン
│   └── icon.svg                       # SVGベクターアイコン
├── popup/                             # ユーザーインターフェース
│   ├── popup.html                     # ポップアップUI構造
│   ├── popup.css                      # スタイルシート
│   └── popup.js                       # UI制御・設定管理
├── content/                           # Webページ挿入スクリプト
│   └── content.js                     # ページコンテンツ抽出
├── background/                        # バックグラウンド処理
│   ├── background.js                  # メイン処理統括
│   ├── auth.js                        # Google OAuth認証
│   ├── encryption.js                  # APIキー暗号化
│   ├── gptAnalyzer.js                 # GPT-4 API連携
│   ├── slideGenerator_custom.js       # スライド生成（カスタム形式）
│   └── sheetsManager.js               # Google Sheets連携
└── templates/                         # テンプレート設定
    └── custom-template.json           # スライドテンプレート定義
```

## 🏗️ アーキテクチャ概要

### システム構成図
```
┌─────────────────────────────────────────┐
│         Chrome Extension                 │
├─────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐  │
│  │  popup.js    │────│content.js    │  │
│  │  (UI制御)    │    │(コンテンツ抽出)│  │
│  └──────────────┘    └──────────────┘  │
│          │                   │          │
│          ▼                   ▼          │
│  ┌──────────────────────────────────┐  │
│  │    background.js (統括処理)       │  │
│  │    ├── auth.js (Google認証)      │  │
│  │    ├── gptAnalyzer.js (GPT処理) │  │
│  │    ├── slideGenerator_custom.js │  │
│  │    └── sheetsManager.js         │  │
│  └──────────────────────────────────┘  │
└─────────────────┼───────────────────────┘
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
   ┌─────────┐ ┌─────────┐ ┌──────────┐
   │GPT-4 API│ │Google   │ │Encrypted │
   │         │ │APIs     │ │Storage   │
   └─────────┘ └─────────┘ └──────────┘
```

## 📋 ファイル別機能説明

### 🎯 manifest.json - 拡張機能設定
**役割**: Chrome拡張機能の基本設定・権限定義
**重要な設定**:
- `permissions`: activeTab（現在のタブ操作）、storage（設定保存）、identity（OAuth認証）
- `oauth2.client_id`: Google Cloud ConsoleのクライアントID（要設定）
- `oauth2.scopes`: Google APIs使用権限（Slides、Drive、Sheets）
- `background.service_worker`: Manifest V3対応のService Worker
- `content_scripts`: 全Webページに自動挿入されるスクリプト

### 🎨 popup/ - ユーザーインターフェース層
**popup.html**: レイアウト構造
- メイン画面（現在ページ表示、生成ボタン）
- 設定モーダル（APIキー、チーム共有、個人データ設定）
- 進捗表示エリア、結果表示エリア、エラー表示エリア

**popup.css**: デザイン・レスポンシブ対応
- モーダルのスクロール対応（max-height: 90vh）
- ボタンスタイル（primary、secondary）
- プログレスバー、ローディング アニメーション

**popup.js**: UI制御・設定管理
- 設定の読み込み・保存（APIキー暗号化対応）
- スライド生成処理の開始・進捗管理
- エラーハンドリング・ユーザー案内
- Google OAuth設定検証

### 📄 content/content.js - コンテンツ抽出層
**役割**: 現在表示中のWebページから場所情報を抽出
**抽出内容**:
- テキスト: 見出し、段落、リスト、表から10文字以上のテキスト
- メタデータ: SEO、OGPタグ情報
- 構造化データ: 住所（address、itemprop="address"）、電話番号、営業時間
- 画像: 100x100px以上、最大10枚（外観写真想定）

**処理フロー**:
1. background.js からの 'extractContent' メッセージ受信
2. DOM解析による情報抽出
3. 構造化オブジェクトとして返却

### ⚙️ background/ - コア処理層

#### background.js - 統括処理
**役割**: 全体の処理フローを統括、各モジュールの連携
**処理手順**:
1. **Step 1**: ページコンテンツ取得（content.js に指示）
2. **Step 2**: GPT-4による情報解析（gptAnalyzer.js）
3. **Step 3**: Google OAuth認証取得（auth.js）
4. **Step 4**: スライド生成（slideGenerator_custom.js）
5. **Step 5**: スプレッドシート保存（sheetsManager.js）

**エラー処理**:
- 認証失敗時のフォールバック（GPT結果のみ表示）
- タイムアウト対応（30秒）
- 段階別エラー分類・ユーザー案内

#### auth.js - Google認証層
**役割**: Google APIs使用のためのOAuth認証
**機能**:
- `getAuthToken()`: インタラクティブ認証実行
- `removeCachedAuthToken()`: トークンキャッシュ削除
- エラー時のmanifest.json設定確認案内

#### encryption.js - セキュリティ層
**役割**: APIキーの安全な保存
**機能**:
- AES-GCM 256bit暗号化
- Web Crypto API使用
- 平文・暗号化形式両対応

#### gptAnalyzer.js - AI解析層
**役割**: ページコンテンツをGPT-4で解析し、場所情報を構造化
**抽出項目**:
- locationName: 施設・場所名
- address: 完全な住所
- trainAccess: 電車でのアクセス方法
- carAccess: 車でのアクセス方法
- parkingInfo: 駐車場情報

**特徴**:
- 情報不足時は「記載無し」を返却
- プロンプトエンジニアリング最適化
- GPT-4o-mini使用（コスト効率化）

#### slideGenerator_custom.js - スライド生成層
**役割**: 指定されたフォーマット「8. 撮影地」でスライド作成
**生成内容**:
```
URL: https://example.com ← クリック可能

8. 撮影地
──────────────────────

場所名：東京スカイツリー
住所：〒131-0045 東京都墨田区押上1-1-2

アクセス
【電車の場合】
  東武スカイツリーライン「とうきょうスカイツリー」駅すぐ

【車の場合】
  首都高速6号向島線「向島」出口より約10分

駐車場：有り - 30分350円（最初の1時間無料）
```

#### sheetsManager.js - データ管理層
**役割**: Google Sheetsにデータ保存・管理
**機能**:
- 個人用スプレッドシート作成・保存
- チーム共有マスタースプレッドシート対応
- 重複データ検出・スキップ
- 保存項目: 登録日時、URL、場所情報、スライドURL

## 🔄 処理フロー詳細

### 1. 初期化・設定読み込み
```javascript
// popup.js - 拡張機能アイコンクリック時
1. Chrome Storage からAPIキー・設定読み込み
2. 暗号化APIキーの復号化試行
3. UI状態の初期化（ボタン有効化等）
4. 現在のタブ情報取得・表示
```

### 2. スライド生成実行
```javascript
// popup.js → background.js
1. [UI] 「スライドを生成」ボタンクリック
2. [BG] handleSlideGeneration() 実行開始
3. [BG→CT] content.js にページ解析指示
4. [CT→BG] 抽出コンテンツ返却
5. [BG] GPT-4 API で情報解析
6. [BG] Google OAuth認証取得
7. [BG] スライド作成・スプレッドシート保存
8. [BG→UI] 完了通知・結果URL
```

### 3. エラーハンドリング
```javascript
// 段階別エラー処理
- Content抽出失敗: ページ読み込み不完全
- GPT解析失敗: APIキー無効・ネットワーク
- Google認証失敗: client_id未設定・ユーザー拒否
- スライド生成失敗: API制限・権限不足
```

## ⚡ パフォーマンス・制限事項

### 処理時間目安
- ページコンテンツ抽出: 1-2秒
- GPT-4解析: 5-10秒
- Google認証: 5-15秒（初回）
- スライド生成: 10-15秒
- **合計**: 約20-40秒

### API使用量（1回の生成あたり）
- **OpenAI API**: 3,000-5,000トークン
- **Google Slides API**: 15-20リクエスト
- **Google Sheets API**: 1-2リクエスト

### 制限事項
- Google OAuth設定必須（manifest.jsonのclient_id）
- OpenAI APIキー必須
- インターネット接続必須
- Chrome拡張機能権限承認必須

## 🔧 カスタマイズ・拡張

### スライドフォーマット変更
`slideGenerator_custom.js` の `createCustomFormatSlide()` 関数を編集

### 抽出情報項目変更
`gptAnalyzer.js` のプロンプトと `analyzeWithGPT()` 関数を編集

### 新しいテンプレート追加
`templates/` フォルダに新しいJSONファイル作成

## 🚀 デプロイメント

### 配布方法
1. zipファイル配布（現在の方法）
2. Chrome ウェブストア公開（要審査）
3. 企業内配布（管理者権限必要）

### セットアップ要件
1. Google Cloud Console プロジェクト作成
2. OAuth 2.0 クライアントID取得
3. manifest.json の client_id 更新
4. OpenAI API キー取得
5. Chrome拡張機能として読み込み

この拡張機能は**Manifest V3**準拠で作成されており、最新のChrome拡張機能セキュリティ基準に適合しています。