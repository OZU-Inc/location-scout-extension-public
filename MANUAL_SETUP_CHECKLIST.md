# Location Scout Extension - 手動設定項目一覧

この拡張機能を使用するために、以下の項目を手動で設定する必要があります。

## 必須設定項目

### 1. OpenAI APIキー (必須)
- **設定場所**: 拡張機能のポップアップ → 設定ボタン
- **取得方法**: 
  1. https://platform.openai.com でアカウント作成
  2. API Keys セクションで新しいキーを生成
  3. `sk-` で始まるキーをコピー
- **注意**: GPT-4 APIアクセス権限が必要

### 2. Google OAuth 2.0 クライアントID (必須)
- **設定場所**: `manifest.json` ファイル 40行目
- **現在の値**: `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com`
- **変更が必要**: ✅ はい
- **取得方法**:
  1. Google Cloud Console (https://console.cloud.google.com) でプロジェクト作成
  2. APIs & Services → Credentials
  3. OAuth 2.0 Client IDs を作成
  4. アプリケーションタイプ: Chrome Extension
  5. 承認済みリダイレクトURI: `https://<extension-id>.chromiumapp.org/`

### 3. Google APIs の有効化 (必須)
Google Cloud Console で以下の3つのAPIを有効化:
- **Google Slides API** - スライド作成用
- **Google Sheets API** - スプレッドシート保存用
- **Google Drive API** - ファイル操作用

## オプション設定項目

### 4. 個人用Google スプレッドシートID (オプション)
- **設定場所**: 拡張機能のポップアップ → 設定ボタン
- **取得方法**: 
  1. Google Sheets で新しいスプレッドシートを作成
  2. URLから ID部分をコピー
  3. 例: `https://docs.google.com/spreadsheets/d/[ここがID]/edit`

### 5. チーム共有設定 (オプション)
#### 5a. ユーザー名
- **設定場所**: 拡張機能のポップアップ → 設定ボタン
- **用途**: チーム共有時の登録者名として使用

#### 5b. マスタースプレッドシートID
- **設定場所**: 拡張機能のポップアップ → 設定ボタン
- **用途**: チーム全体で共有するスプレッドシート
- **取得方法**: 管理者が作成したスプレッドシートのIDを共有

#### 5c. 共有フォルダID (未実装)
- **設定場所**: 拡張機能のポップアップ → 設定ボタン
- **用途**: 将来的なファイル共有機能用

## 設定確認方法

### 拡張機能が正常に動作しているかチェック:
1. Chrome 拡張機能ページ (`chrome://extensions/`) で「Location Scout Slide Generator」が有効
2. Service Worker が "active" 状態
3. ポップアップで「スライドを生成」ボタンが有効（灰色でない）

### エラー確認方法:
1. 拡張機能アイコンを右クリック → 「ポップアップを検査」→ Console タブ
2. 拡張機能ページ → 「Service Worker」→ 「検査」→ Console タブ
3. アクティブなタブで F12 → Console タブ

## トラブルシューティング

### よくある問題と解決方法:

1. **"API Key未設定" と表示される**
   - OpenAI APIキーが正しく保存されていない
   - 設定画面で再入力してください

2. **"Google OAuth設定が必要です" エラー**
   - manifest.json の client_id が未設定
   - Google Cloud Console でOAuthクライアントIDを取得

3. **"ページ情報を取得中" で止まる**
   - Content Script が正常に動作していない
   - ページを再読み込みしてから再試行

4. **Service Worker が表示されない**
   - manifest.json にエラーがある可能性
   - 拡張機能を一度削除して再インストール

## セキュリティ注意事項

- OpenAI APIキーは暗号化されてローカルに保存されます
- Google認証は個人アカウントで行われ、他の人と共有されません
- チーム共有機能使用時も、各自のGoogle認証が必要です

## サポート

問題が発生した場合:
1. Console ログでエラー内容を確認
2. この設定一覧を再確認
3. 必要に応じて拡張機能を再インストール