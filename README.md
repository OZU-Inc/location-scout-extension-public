# Location Scout Extension - ロケハン自動化Chrome拡張機能

現在のWebページから場所情報を自動抽出し、GPT-4で解析してロケハン用スライドとスプレッドシートを生成するChrome拡張機能です。

![Version](https://img.shields.io/badge/version-1.6-blue.svg)
![Status](https://img.shields.io/badge/status-Stable-green.svg)
![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-yellow.svg)

## 🎯 プロジェクト概要

この拡張機能は映像制作チーム向けのロケハン（ロケーション・ハンティング）を効率化するツールです。Webページを閲覧中にワンクリックで場所情報を抽出し、統一されたフォーマットでドキュメント化できます。

## ✨ 主な機能

- **自動コンテンツ抽出**: 現在のWebページから場所情報を自動抽出
- **GPT-4分析**: OpenAI GPT-4 APIによる高精度な情報構造化
- **スライド自動生成**: 統一フォーマットでGoogle Slidesを生成
- **データベース管理**: Google Sheetsでの情報管理
- **チーム共有**: 複数メンバーでの共同作業対応
- **進捗表示**: 5段階の処理進捗をリアルタイム表示

## 📊 処理フロー

1. **ページコンテンツ抽出** - 現在のWebページから関連情報を取得
2. **GPT-4解析** - OpenAI APIで場所情報を構造化
3. **Google認証** - OAuth 2.0による安全な認証
4. **スライド生成** - 「8. 撮影地」フォーマットでスライド作成
5. **スプレッドシート保存** - データベースへの自動保存

## 🗂️ 抽出データ項目

- **場所名** - 施設・場所の名称
- **住所** - 詳細な所在地
- **電車アクセス** - 公共交通機関でのアクセス方法
- **車アクセス** - 自動車でのアクセス方法
- **駐車場情報** - 駐車場の有無・料金情報
- **電話番号** - 連絡先（ハイフン区切り形式）

## 🔧 技術仕様

### アーキテクチャ
- **Manifest V3**: 最新のChrome Extension仕様
- **Service Worker**: バックグラウンド処理（静的importのみ）
- **Content Scripts**: Webページ情報抽出（動的注入対応）
- **エラーハンドリング**: 各段階での詳細な検証とフォールバック

### 使用API
- **OpenAI GPT-4 API**: コンテンツ解析
- **Google Slides API**: プレゼンテーション生成
- **Google Sheets API**: データ管理
- **Google Drive API**: ファイル操作

### セキュリティ
- **AES-GCM 256bit暗号化**: APIキーの安全な保存
- **OAuth 2.0**: Google APIの安全な認証
- **個人認証**: 各メンバーが個別にGoogle認証

## 📦 インストール方法

### 必要な準備
1. **OpenAI APIキー**: GPT-4 APIアクセス権限付き
2. **Google Cloud Console**: OAuth 2.0クライアントID
3. **Google APIs有効化**: 3つのAPIの有効化が必要

### 手順
1. `location-scout-extension-latest.zip`をダウンロード・解凍
2. Chrome拡張機能ページ（`chrome://extensions/`）で「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」で解凍フォルダを選択

詳細な設定手順は[MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md)を参照してください。

## 🔧 開発状況

### 最新バージョン v1.6 (2024-08-21)
- ✅ **変数名衝突問題を解決**: content.jsの変数スコープ修正
- ✅ **エラーハンドリング強化**: 各段階での詳細なエラー検証
- ✅ **Service Worker安定化**: 静的インポートでの安定動作
- ✅ **Content Script動的注入**: ページ読み込み状態に関係なく動作

### 解決済みの問題
- ❌ Service Workerの動的import制限 → ✅ 静的importに変更
- ❌ Content Script接続エラー → ✅ 動的注入機能追加  
- ❌ sendResponse未定義エラー → ✅ スコープ問題修正
- ❌ プロパティアクセスエラー → ✅ nullチェック追加
- ❌ 変数名衝突 → ✅ 変数スコープ整理

### 動作確認済み環境
- Chrome 120+ (Manifest V3対応)
- 通常のWebページ (HTTP/HTTPS)
- システムページでの適切なエラー表示

## 📋 設定が必要な項目

### 必須設定
1. **OpenAI APIキー** - 拡張機能の設定画面で入力（`sk-`から始まる完全なキー）
2. **Google OAuth Client ID** - manifest.json の40行目を変更
3. **Google APIs有効化** - Google Cloud Consoleで以下の3つのAPIを有効化:
   - **Google Slides API** - スライド作成用
   - **Google Sheets API** - スプレッドシート保存用
   - **Google Drive API** - ファイル操作用

### オプション設定
- 個人用スプレッドシートID
- チーム共有用マスタースプレッドシートID
- ユーザー名（チーム共有時）

## 🚀 使用方法

1. ロケ地情報が掲載されているWebページを開く
2. 拡張機能アイコンをクリック
3. 「スライドを生成」ボタンを押す
4. 進捗表示（1→2→3→4→5）を確認しながら完了を待つ
5. 生成されたスライドとスプレッドシートを確認

### 生成されるスライド形式
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

## 📁 ファイル構成

```
chrome-extension/
├── manifest.json           # 拡張機能設定
├── background/             # Service Worker
│   ├── background.js       # メイン処理統括
│   ├── gptAnalyzer.js      # GPT-4解析
│   ├── slideGenerator_custom.js # スライド生成
│   ├── sheetsManager.js    # Sheets管理
│   ├── auth.js            # Google認証
│   └── encryption.js      # 暗号化処理
├── content/               # コンテンツ抽出
│   └── content.js         # ページ情報取得
├── popup/                 # UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── icons/                 # アイコン
```

## 🆘 トラブルシューティング

### よくある問題
- **API Key未設定**: OpenAI APIキーの入力確認（`sk-`から始まる完全なキー）
- **Google OAuth設定が必要**: manifest.jsonのclient_id設定
- **このページからは情報を取得できません**: 通常のWebページで実行しているか確認
- **Service Worker非アクティブ**: 拡張機能の再読み込み

### エラー確認方法
1. 拡張機能アイコン右クリック → 「ポップアップを検査」
2. Chrome拡張機能ページ → Service Worker「検査」
3. アクティブタブでF12 → Console確認

## 📄 関連ドキュメント

- [MANUAL_SETUP_CHECKLIST.md](./MANUAL_SETUP_CHECKLIST.md) - 詳細セットアップ手順
- [ARCHITECTURE_DOCUMENTATION.md](./ARCHITECTURE_DOCUMENTATION.md) - 技術仕様書
- [FINAL_CODE_DOCUMENTATION.md](./FINAL_CODE_DOCUMENTATION.md) - コード解説

## 🔄 バージョン履歴

- **v1.6** (2024-08-21): 変数衝突問題修正、安定版完成
- **v1.5** (2024-08-21): Content Script接続問題修正
- **v1.4** (2024-08-21): Service Worker動的import問題修正
- **v1.3** (2024-08-21): sendResponse問題修正
- **v1.2** (2024-08-21): 進捗表示機能追加
- **v1.1** (2024-08-21): チーム共有機能追加
- **v1.0** (2024-08-21): 初期リリース

## 📊 パフォーマンス

### 処理時間
- **ページコンテンツ抽出**: 1-2秒
- **GPT-4解析**: 5-10秒
- **Google認証**: 1-2秒
- **スライド生成**: 5-8秒
- **スプレッドシート保存**: 1-2秒
- **合計**: 約15-25秒

### API使用量（1回の生成あたり）
- **OpenAI API**: 約3,000-5,000トークン
- **Google Slides API**: 15-20リクエスト
- **Google Sheets API**: 1-2リクエスト

## 📧 サポート

問題が発生した場合は、Console ログを確認してエラー内容を特定してください。各段階でのエラーメッセージが詳細に表示されます。

---

**🎬 効率的なロケハンのために開発された実用的ツールです！**