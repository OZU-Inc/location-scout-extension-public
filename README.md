# Location Scout v2

ロケ地情報を自動収集・整理するChrome拡張機能

## 概要

Webサイトからロケ地・撮影スタジオの情報を自動収集し、Google Drive/Slides/Sheetsに整理して保存するChrome拡張機能です。

## 主な機能

- **自動情報抽出**: ページからロケ地名、住所、アクセス、料金などを自動抽出
- **複数ページクロール**: 関連ページ（料金、アクセス、ギャラリー等）を自動検出して情報収集
- **AI画像選別**: GPT-4o-miniのVision APIで画像を判定し、ロケ地写真のみを自動保存
- **スライド自動生成**: 収集した情報からGoogle Slidesを自動作成
- **スプレッドシート連携**: ロケハンDBへの自動登録

## 技術スタック

- Chrome Extension Manifest V3 (Service Worker)
- OpenAI GPT-4o-mini (Vision API)
- Google APIs (Drive, Slides, Sheets)

## フォルダ構成

```
chrome-extension/
├── manifest.json          # 拡張機能マニフェスト
├── background/
│   ├── background.js      # メイン処理統括
│   ├── auth.js            # Google OAuth認証
│   ├── driveManager.js    # Drive操作（フォルダ、画像保存）
│   ├── crawler.js         # 複数ページクロール
│   ├── gptAnalyzer.js     # GPT解析・AI画像選別
│   ├── slideGenerator.js  # スライド生成
│   └── sheetsManager.js   # スプレッドシート保存
├── content/
│   └── content.js         # ページ情報・画像抽出
├── popup/
│   ├── popup.html         # ポップアップUI
│   ├── popup.css          # スタイル
│   └── popup.js           # ポップアップ制御
└── icons/                 # 拡張機能アイコン
```

## 処理フロー

```
1. content.js: ページから情報・画像を抽出（最大40枚）
   ├── テキスト情報（タイトル、住所、アクセス等）
   ├── 画像URL（img, background-image, picture等）
   └── 関連ページリンク
       ↓
2. crawler.js: 関連ページをクロール（最大5ページ）
   └── アクセス、料金、ギャラリー等のページを自動検出
       ↓
3. gptAnalyzer.js: AI処理
   ├── テキスト解析: 構造化された場所情報を抽出
   └── 画像選別: Valid/Invalid判定（バッチ処理）
       ├── Valid: ロケ地写真 → 保存
       └── Invalid: イラスト、アイコン等 → 除外
           ↓
4. driveManager.js: Google Driveに保存
   └── フォルダ作成、画像保存
       ↓
5. slideGenerator.js: スライド生成
       ↓
6. sheetsManager.js: スプレッドシートに登録
```

## AI画像選別機能

GPT-4o-miniのVision APIを使用して、画像を自動判定します。

**保存対象（Valid）:**
- 実際の場所・空間・建物の写真
- 内観写真（リビング、キッチン、オフィス、スタジオなど）
- 外観写真（建物、庭、駐車場など）

**除外対象（Invalid）:**
- イラスト、漫画、アニメ調の画像
- アイコン、ロゴ、シンボルマーク
- 地図、間取り図、フロアマップ
- 文字が主体のバナー広告
- 人物のバストアップ、ポートレート
- UI部品、ボタン、SNSアイコン

## セットアップ

### 1. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. 以下のAPIを有効化:
   - Google Drive API
   - Google Slides API
   - Google Sheets API
3. OAuth 2.0クライアントIDを作成（Chrome拡張機能用）
4. ご自身のGoogle Cloudプロジェクトで発行したOAuth Client IDを、`manifest.json`の`oauth2.client_id`（`YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com`の部分）に記載してください。

### 2. OpenAI API設定

1. [OpenAI](https://platform.openai.com/)でAPIキーを取得
2. GPT-4o-miniが利用可能であることを確認

### 3. 拡張機能のインストール

1. Chrome で `chrome://extensions` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. `chrome-extension` フォルダを選択

### 4. 初期設定

1. 拡張機能アイコンをクリック
2. 設定（歯車アイコン）を開く
3. 以下を設定:
   - OpenAI APIキー
   - Google Drive親フォルダID
   - スプレッドシートID（オプション）
4. 「Googleアカウントでログイン」で認証

## 使い方

1. ロケ地情報のあるWebページを開く
2. 拡張機能アイコンをクリック
3. オプションを確認:
   - 「関連ページも自動取得」: アクセスや料金ページも収集
   - 「画像を保存」: ロケ地画像をDriveに保存（AI選別付き）
4. 「情報を収集」ボタンをクリック
5. 完了後、各リンクから結果を確認

## 出力

### Google Drive
```
親フォルダ/
└── YYYY-MM-DD_場所名/
    └── images/
        ├── 場所名_001_リビング.jpg
        ├── 場所名_002_キッチン.jpg
        └── ...
```

### スプレッドシート
| スタジオ名 | サイトURL | 広さ | 電車アクセス | 車アクセス | 駐車場情報 | 金額（ムービー） | 金額（スチール） | 金額 | 住所 | 電話番号 | メールアドレス・フォーム | 登録日時 | スライドURL | フォルダURL |

### スライド
- 場所名・住所
- アクセス情報（電車・車）
- 駐車場情報
- 電話番号・URL

## 画像分類カテゴリ

**住居系**: キッチン、リビング、ベッドルーム、お風呂、トイレ、玄関、廊下、和室、洋室、バルコニー、庭

**オフィス系**: 会議室、エレベーターホール、ロビー、食堂、オフィス、受付、屋上

**スタジオ系**: 白ホリゾント、黒ホリゾント、控室、メイクルーム

**その他**: 外観、駐車場

## 注意事項

- 画像保存は最大40枚まで（AI選別後）
- クロール対象は同一ドメイン内のみ
- 画像ダウンロードはCORS制限により失敗する場合があります
- 「関連ロケ地」セクションの画像は自動除外されます

## トラブルシューティング

### 「APIキーが無効です」
- OpenAI APIキーが正しいか確認
- APIキーの利用制限を確認

### 「Google認証に失敗しました」
- manifest.jsonのclient_idが正しいか確認
- OAuth同意画面の設定を確認

### 「画像のダウンロードに失敗しました」
- 画像がCORS制限されている可能性があります
- 外部ドメインの画像は保存できない場合があります

### デバッグ方法
1. `chrome://extensions` を開く
2. 拡張機能の「Service Worker」をクリック
3. Consoleタブでログを確認

## ライセンス

MIT License
