# Location Scout Extension - インストールガイド

## 📦 Zip配布版インストール手順

### ステップ1: ファイルの準備
1. `location-scout-extension.zip`をダウンロード
2. 任意のフォルダに解凍
3. フォルダ内のファイル構成を確認

### ステップ2: Chrome拡張機能のインストール
1. Chromeブラウザで`chrome://extensions/`を開く
2. 右上の「デベロッパーモード」をONにする
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. 解凍したフォルダ内の`chrome-extension`フォルダを選択

### ステップ3: 初期設定

#### Google Cloud Projectの設定
1. [Google Cloud Console](https://console.cloud.google.com/)で新規プロジェクト作成
2. 以下のAPIを有効化：
   - Google Slides API
   - Google Sheets API
   - Google Drive API

#### OAuth設定
1. 「APIとサービス」→「認証情報」
2. OAuth 2.0クライアントIDを作成
3. アプリケーションの種類：「Chrome拡張機能」
4. 拡張機能のIDを入力（Chrome拡張機能管理画面で確認）

#### manifest.jsonの更新
```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com"
  }
}
```

### ステップ4: APIキーの設定
1. [OpenAI Platform](https://platform.openai.com/)でAPIキー取得
2. 拡張機能アイコンをクリック
3. 設定ボタン→APIキーを入力
4. 「保存」をクリック

## 🔒 セキュリティ機能

### APIキーの暗号化保存
- AES-GCM 256bit暗号化
- ローカルストレージに安全に保存
- 拡張機能外からの読み取り不可

### 権限の最小化
```json
{
  "permissions": [
    "activeTab",
    "storage", 
    "identity"
  ]
}
```

## ⚡ 使用方法

### 基本的な使い方
1. ロケ地のWebページを開く
2. 拡張機能アイコンをクリック
3. 「スライドを生成」ボタンを押す
4. 生成されたスライドへのリンクをクリック

### 設定オプション
- **テンプレート**: 撮影地フォーマット（推奨）
- **スプレッドシート保存**: 自動でデータベース化
- **画像含有**: ページ内画像の自動取得

## 🛠️ トラブルシューティング

### よくある問題

#### 1. 「認証に失敗しました」
**原因**: OAuth設定が不完全
**解決**: 
- Google Cloud Consoleで拡張機能IDを再確認
- manifest.jsonのclient_idを更新
- 拡張機能を再読み込み

#### 2. 「APIキーが無効です」
**原因**: OpenAI APIキーの問題
**解決**:
- 新しいAPIキーを生成
- 利用制限・残高を確認
- キーを再入力

#### 3. スライド生成が失敗する
**原因**: Google API制限
**解決**:
- Google Slides APIが有効か確認
- 認証をやり直す
- 時間を置いて再試行

### ログの確認方法
1. `chrome://extensions/`で「Service Worker」をクリック
2. DevToolsのConsoleタブでエラーを確認
3. Networkタブで通信状況を確認

## 🔄 アップデート方法

### 新バージョンのインストール
1. 新しいZipファイルを解凍
2. 古いフォルダを新しいフォルダで置換
3. Chrome拡張機能管理画面で「再読み込み」

### データの移行
- 設定は自動で引き継がれます
- APIキーは再入力不要
- スプレッドシートIDは保持されます

## 📊 配布パッケージ内容

```
location-scout-extension/
├── chrome-extension/          # 拡張機能本体
│   ├── manifest.json         # 拡張機能設定
│   ├── icons/               # アイコンファイル
│   ├── popup/               # ポップアップUI
│   ├── content/             # コンテンツスクリプト
│   ├── background/          # バックグラウンド処理
│   └── templates/           # テンプレート設定
├── INSTALLATION_GUIDE.md    # インストールガイド
├── IMPLEMENTATION_GUIDE.md  # 実装ガイド
└── TEMPLATE_SETUP_GUIDE.md  # テンプレート設定ガイド
```

## ⚠️ 重要な注意事項

### セキュリティ
- APIキーは信頼できる人にのみ共有
- 定期的なキーのローテーション推奨
- 不審な動作があれば即座にキーを無効化

### 利用制限
- OpenAI API: 使用量に応じた課金
- Google APIs: 無料枠内での利用推奨
- 大量利用時は事前に制限を確認

### サポート
- GitHub Issues: バグ報告・機能要望
- Wiki: 詳細な使用方法
- FAQ: よくある質問集

正常にインストールできれば、ワンクリックでプロ品質のロケハン資料が作成できます！