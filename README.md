# Location Scout Extension

🎯 現在開いているWebページから場所情報を自動抽出し、ロケハン用スライドとスプレッドシートを即座に生成するChrome拡張機能

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome Extension](https://img.shields.io/badge/platform-Chrome%20Extension-yellow.svg)

## 🌟 主な機能

### ✨ ワンクリック生成
- **スライド自動作成**: 指定フォーマットでプロ品質のロケハン資料
- **データベース化**: Google Sheetsに自動保存で一元管理
- **URL連携**: 元ページへのクリック可能リンク

### 🔍 高精度抽出
- **GPT-4 API**: スクレイピング不要の高精度情報解析
- **5項目のみ**: 場所名、住所、電車アクセス、車アクセス、駐車場
- **エラーハンドリング**: 情報不足時は「記載無し」で明確化

### 🔒 セキュリティ
- **暗号化保存**: APIキーはAES-GCM 256bitで保護
- **最小権限**: 必要最小限のブラウザ権限のみ使用
- **ローカル処理**: 機密データは外部送信なし

## 🚀 クイックスタート

### 1. インストール
```bash
# リポジトリをクローン
git clone https://github.com/yourusername/location-scout-extension.git
cd location-scout-extension

# 配布用zipを作成（オプション）
npm install
npm run build
```

### 2. Chrome拡張機能として追加
1. `chrome://extensions/` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」
4. `chrome-extension`フォルダを選択

### 3. API設定

#### OpenAI APIキー
1. [OpenAI Platform](https://platform.openai.com/)でAPIキー取得
2. 拡張機能アイコン → 設定 → APIキー入力

#### Google APIs設定
1. [Google Cloud Console](https://console.cloud.google.com/)で新規プロジェクト
2. 以下のAPIを有効化：
   - Google Slides API
   - Google Sheets API
   - Google Drive API
3. OAuth 2.0クライアントID作成（Chrome拡張機能用）
4. `chrome-extension/manifest.json`の`client_id`を更新

## 📋 使用方法

### 基本操作
1. **ロケ地のWebページを開く**
2. **拡張機能アイコンをクリック**
3. **「スライドを生成」ボタンを押す**
4. **生成完了を待つ（20-30秒）**
5. **Google Slidesリンクをクリックして確認**

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

### スプレッドシート保存
| 項目 | 内容 |
|------|------|
| 登録日時 | 2024/01/20 14:30:00 |
| URL | 元ページのURL |
| 場所名 | 施設・場所の名称 |
| 住所 | 完全な住所 |
| 電車アクセス | 路線、駅名、所要時間 |
| 車アクセス | IC、ルート情報 |
| 駐車場 | 有無、料金、台数 |
| スライドURL | 生成されたスライドへのリンク |

## 🛠️ 技術仕様

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
   │GPT API  │ │Google   │ │Encrypted │
   │         │ │APIs     │ │Storage   │
   └─────────┘ └─────────┘ └──────────┘
```

### 使用技術
- **フロントエンド**: HTML5, CSS3, Vanilla JavaScript
- **APIs**: OpenAI GPT-4o-mini, Google Slides API, Google Sheets API
- **暗号化**: Web Crypto API (AES-GCM)
- **権限**: Chrome Extension Manifest V3

### ファイル構成
```
location-scout-extension/
├── chrome-extension/              # 拡張機能本体
│   ├── manifest.json             # 拡張機能設定
│   ├── popup/                    # UI部分
│   │   ├── popup.html           # ポップアップ画面
│   │   ├── popup.css            # スタイル
│   │   └── popup.js             # UI制御
│   ├── content/                  # コンテンツスクリプト
│   │   └── content.js           # ページ情報抽出
│   ├── background/               # バックグラウンド処理
│   │   ├── background.js        # メイン処理
│   │   ├── gptAnalyzer.js       # GPT API連携
│   │   ├── slideGenerator_custom.js  # スライド生成
│   │   ├── sheetsManager.js     # スプレッドシート連携
│   │   ├── auth.js              # Google認証
│   │   └── encryption.js        # 暗号化処理
│   ├── icons/                    # アイコン
│   └── templates/                # テンプレート
├── docs/                         # ドキュメント
│   ├── SETUP_GUIDE.md           # セットアップガイド
│   └── DEVELOPER_GUIDE.md       # 開発者ガイド
├── build.js                      # ビルドスクリプト
├── package.json                  # 依存関係
└── README.md                     # このファイル
```

## ⚙️ カスタマイズ

### スライドフォーマット変更
1. `chrome-extension/background/slideGenerator_custom.js`を編集
2. レイアウト、フォント、配色を調整
3. 拡張機能を再読み込み

### 抽出する情報の変更
1. `chrome-extension/background/gptAnalyzer.js`のプロンプトを編集
2. 必要な情報フィールドを追加・削除
3. スプレッドシートの列も対応して調整

### 新しいテンプレート追加
1. `chrome-extension/templates/`にJSONファイル作成
2. `popup.html`の選択肢に追加
3. `background.js`で処理ロジック追加

## 🐛 トラブルシューティング

### よくある問題

#### APIキーエラー
```bash
Error: "APIキーが無効です"
```
**解決方法**: 
- OpenAI Platform で新しいAPIキー生成
- 利用制限・残高を確認
- 設定画面で再入力

#### Google認証エラー
```bash
Error: "認証に失敗しました"
```
**解決方法**:
- Google Cloud Console で拡張機能ID確認
- manifest.json の client_id 更新
- 拡張機能を再読み込み

#### スライド生成失敗
```bash
Error: "スライドの生成に失敗しました"
```
**解決方法**:
- Google Slides API が有効か確認
- 認証をリセット
- 時間を置いて再試行

### デバッグ方法
1. `chrome://extensions/` → Service Worker → DevTools
2. Console タブでエラーログ確認
3. Network タブで API通信状況確認

## 📊 パフォーマンス

### 処理時間
- **情報抽出**: 5-10秒
- **スライド生成**: 10-15秒
- **スプレッドシート保存**: 2-3秒
- **合計**: 約20-30秒

### API使用量（1回の生成あたり）
- **OpenAI API**: 約3,000-5,000トークン
- **Google Slides API**: 15-20リクエスト
- **Google Sheets API**: 1-2リクエスト

## 🔄 アップデート

### 最新版の取得
```bash
git pull origin main
npm run build
```

### 変更履歴
- **v1.0.0**: 初回リリース
  - 基本的なスライド生成機能
  - スプレッドシート連携
  - セキュアなAPIキー保存

## 🤝 コントリビューション

### 開発環境セットアップ
```bash
git clone https://github.com/yourusername/location-scout-extension.git
cd location-scout-extension
npm install
```

### プルリクエスト
1. フィーチャーブランチを作成
2. 変更を実装
3. テストを実行
4. プルリクエスト作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 📞 サポート

- **Issues**: [GitHub Issues](https://github.com/yourusername/location-scout-extension/issues)
- **Wiki**: [プロジェクトWiki](https://github.com/yourusername/location-scout-extension/wiki)
- **Email**: support@example.com

---

**🎬 このツールで効率的なロケハンを！**