# Location Scout Chrome拡張機能 - 実装ガイド

## セットアップ手順

### 1. 必要な準備

#### OpenAI APIキーの取得
1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. アカウント作成またはログイン
3. API Keys セクションで新しいキーを生成
4. `sk-` で始まるキーをコピー

#### Google Cloud Projectの設定
1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. 以下のAPIを有効化：
   - Google Slides API
   - Google Drive API

#### OAuth 2.0クライアントIDの作成
1. Google Cloud Console → APIとサービス → 認証情報
2. 「認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類：「Chrome拡張機能」
4. アイテムID：拡張機能のID（後で取得）
5. クライアントIDをコピー

### 2. 拡張機能のインストール

#### ローカル開発環境での設定
1. Chromeブラウザを開く
2. `chrome://extensions/` にアクセス
3. 右上の「デベロッパーモード」をON
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `chrome-extension`フォルダを選択

#### 拡張機能IDの取得
1. インストール後、拡張機能のIDが表示される
2. このIDをコピー
3. Google Cloud ConsoleのOAuth設定に戻り、このIDを入力

#### manifest.jsonの更新
```json
{
  "oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [...]
  }
}
```

### 3. 初回設定

1. 拡張機能アイコンをクリック
2. 設定ボタン（⚙️）をクリック
3. OpenAI APIキーを入力
4. 保存

### 4. 使用方法

#### 基本的な使い方
1. ロケ地情報があるWebページを開く
2. 拡張機能アイコンをクリック
3. 「スライドを生成」ボタンをクリック
4. 初回はGoogleアカウントの認証が必要
5. 処理が完了するとGoogle Slidesへのリンクが表示

#### 対応サイト例
- 観光施設の公式サイト
- レストラン・カフェのページ
- 美術館・博物館のサイト
- 公園・庭園の情報ページ
- ホテル・宿泊施設のページ

## Google Slidesテンプレートの指定方法

### カスタムテンプレートの作成

#### 1. テンプレートスライドの作成
```javascript
// slideGenerator.jsをカスタマイズ
const customTemplate = {
    slides: [
        {
            layout: 'TITLE',
            content: {
                title: '${locationName}',
                subtitle: 'ロケハン資料 - ${date}'
            }
        },
        {
            layout: 'TITLE_AND_TWO_COLUMNS',
            content: {
                title: '基本情報',
                leftColumn: '${basicInfo}',
                rightColumn: '${accessInfo}'
            }
        },
        // 追加のスライド定義
    ]
};
```

#### 2. レイアウトオプション
Google Slides APIで使用可能なレイアウト：
- `BLANK` - 空白
- `CAPTION_ONLY` - キャプションのみ
- `TITLE` - タイトルスライド
- `TITLE_AND_BODY` - タイトルと本文
- `TITLE_AND_TWO_COLUMNS` - タイトルと2列
- `TITLE_ONLY` - タイトルのみ
- `SECTION_HEADER` - セクションヘッダー
- `SECTION_TITLE_AND_DESCRIPTION` - セクションタイトルと説明
- `ONE_COLUMN_TEXT` - 1列テキスト
- `MAIN_POINT` - メインポイント
- `BIG_NUMBER` - 大きな数字

#### 3. スタイル設定
```javascript
const slideStyle = {
    theme: {
        fontFamily: 'Noto Sans JP',
        colors: {
            primary: '#1a73e8',
            secondary: '#34a853',
            accent: '#fbbc04',
            text: '#202124',
            background: '#ffffff'
        }
    },
    textStyles: {
        title: {
            fontSize: { magnitude: 36, unit: 'PT' },
            fontFamily: 'Noto Sans JP',
            bold: true
        },
        body: {
            fontSize: { magnitude: 14, unit: 'PT' },
            fontFamily: 'Noto Sans JP'
        }
    }
};
```

### テンプレート設定ファイル

#### templates/default.json
```json
{
    "name": "デフォルト",
    "slideCount": 5,
    "slides": [
        {
            "type": "title",
            "layout": "TITLE",
            "fields": ["locationName", "date"]
        },
        {
            "type": "info",
            "layout": "TITLE_AND_BODY",
            "fields": ["address", "access", "hours"]
        },
        {
            "type": "features",
            "layout": "TITLE_AND_TWO_COLUMNS",
            "fields": ["features", "photoSpots"]
        },
        {
            "type": "images",
            "layout": "BLANK",
            "maxImages": 4
        },
        {
            "type": "notes",
            "layout": "TITLE_AND_BODY",
            "fields": ["notes", "sourceUrl"]
        }
    ]
}
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. APIキーエラー
- **問題**: 「APIキーが無効です」
- **解決**: 
  - OpenAI APIキーが正しくコピーされているか確認
  - APIキーの利用制限や残高を確認
  - 新しいキーを生成して再試行

#### 2. Google認証エラー
- **問題**: 「認証に失敗しました」
- **解決**:
  - manifest.jsonのclient_idが正しいか確認
  - Google Cloud ConsoleでAPIが有効化されているか確認
  - 拡張機能を再読み込み

#### 3. スライド生成エラー
- **問題**: 「スライドの生成に失敗しました」
- **解決**:
  - Google Slides APIの割り当て制限を確認
  - ネットワーク接続を確認
  - コンソールログでエラー詳細を確認

#### 4. コンテンツ抽出エラー
- **問題**: 「ページ情報を取得できません」
- **解決**:
  - ページが完全に読み込まれているか確認
  - 拡張機能の権限設定を確認
  - Content Security Policyの制限を確認

### デバッグ方法

#### Chrome DevToolsの使用
1. 拡張機能の管理ページで「Service Worker」をクリック
2. DevToolsが開く
3. Consoleタブでログを確認
4. NetworkタブでAPI通信を確認

#### ログの確認
```javascript
// background.jsにデバッグログを追加
console.log('Request:', request);
console.log('Response:', response);
console.log('Error:', error);
```

## パフォーマンス最適化

### キャッシング戦略
```javascript
const cache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30分

async function getCachedData(key, fetchFunction) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    const data = await fetchFunction();
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
    return data;
}
```

### API呼び出しの最適化
- バッチリクエストの使用
- 不要なデータの除外
- レート制限の管理

## セキュリティベストプラクティス

### APIキーの保護
- APIキーをソースコードに直接記述しない
- chrome.storage.localを使用して暗号化保存
- 定期的なキーのローテーション

### 権限の最小化
- 必要最小限の権限のみリクエスト
- host_permissionsを特定のドメインに限定（可能な場合）

### データの取り扱い
- 個人情報を含む可能性のあるデータは保存しない
- HTTPSでの通信を強制
- CSPヘッダーの適切な設定

## 今後の拡張案

### 機能追加のアイデア
1. **バッチ処理**: 複数ページを一括処理
2. **テンプレートエディタ**: GUIでテンプレート作成
3. **履歴機能**: 過去に生成したスライドの管理
4. **共有機能**: チームメンバーとの共有
5. **エクスポート**: PDF、PowerPoint形式での出力
6. **AI強化**: 画像認識による追加情報抽出

### 実装の優先順位
1. 基本機能の安定化
2. エラーハンドリングの改善
3. UIの使いやすさ向上
4. 新機能の追加