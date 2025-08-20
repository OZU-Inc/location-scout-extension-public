# チーム共有ソリューション

## 🎯 問題と解決策

### ❌ **不可能な方法**
**APIキー共有**: Google APIsはOAuth 2.0個人認証が必須のため不可能

### ✅ **推奨解決策: 共有フォルダ方式**

## 🔧 **実装方法**

### **ステップ1: マスター管理者の設定**

#### **1. 共有フォルダ作成**
```
1. Google Driveで「ロケハン共有フォルダ」作成
2. フォルダを右クリック → 共有
3. チームメンバーのメールアドレスを追加
4. 権限: 「編集者」に設定
5. フォルダIDをコピー（URLから取得）
   https://drive.google.com/drive/folders/[フォルダID]
```

#### **2. マスター統計スプレッドシート作成**
```
1. 共有フォルダ内にスプレッドシート作成
2. 名前: 「ロケハンマスターDB」
3. ヘッダー設定:
   | A列: 登録者 | B列: 登録日時 | C列: URL | D列: 場所名 | 
   | E列: 住所 | F列: 電車アクセス | G列: 車アクセス | 
   | H列: 駐車場 | I列: スライドURL |
4. スプレッドシートIDをコピー
5. 全メンバーに共有
```

### **ステップ2: 拡張機能の改善**

#### **新機能追加**
- 共有フォルダ指定
- チーム設定画面
- 登録者名の自動記録
- 統一データベース

### **ステップ3: チームメンバーの設定**
```
1. 各自のGoogleアカウントで拡張機能認証
2. OpenAI APIキーは各自設定
3. 共有設定で以下を入力:
   - 共有フォルダID
   - マスタースプレッドシートID
   - 登録者名
```

## 💻 **改善されたアプリ仕様**

### **新しい設定画面**
```
┌─────────────────────────────────────┐
│ 📊 Location Scout - チーム設定      │
├─────────────────────────────────────┤
│ 【個人設定】                        │
│ OpenAI API Key: [sk-xxx...]         │
│ 登録者名: [山田太郎]                │
│                                     │
│ 【チーム共有設定】                  │
│ □ チーム共有モードを有効にする       │
│ 共有フォルダID: [1a2b3c...]        │
│ マスターDB ID: [4d5e6f...]         │
│                                     │
│ 【個人設定】                        │
│ □ 個人用スプレッドシートも作成       │
│ 個人DB ID: [7g8h9i...]             │
└─────────────────────────────────────┘
```

### **動作フロー**
```
1. ページから情報抽出
2. スライド生成 → 共有フォルダに保存
3. マスターDBに記録:
   - 登録者名
   - 生成日時
   - 抽出データ
   - スライドURL（共有フォルダ内）
4. (オプション) 個人DBにも保存
```

## 🔄 **3つの運用方式**

### **方式A: 完全共有方式**
- すべてのスライド・データを共有フォルダで管理
- チーム全体で一元管理
- 重複チェック機能付き

### **方式B: ハイブリッド方式**  
- スライド: 共有フォルダ
- データ: マスターDB + 個人DB
- 柔軟な管理が可能

### **方式C: レポート方式**
- 各自は個人管理
- 定期的にマスターDBに統合
- プライバシー重視

## 🛠️ **実装が必要な機能**

### **1. 共有フォルダ連携**
```javascript
// 共有フォルダにスライド保存
async function saveToSharedFolder(slideData, sharedFolderId) {
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: `${slideData.locationName}_${timestamp}.pdf`,
            parents: [sharedFolderId]
        })
    });
}
```

### **2. マスターDB更新**
```javascript
// 共有スプレッドシートに追記
async function appendToMasterDB(data, masterSheetId) {
    const rowData = [
        settings.userName,        // 登録者
        new Date().toLocaleString(), // 登録日時
        data.sourceUrl,          // URL
        data.locationName,       // 場所名
        data.address,           // 住所
        data.trainAccess,       // 電車
        data.carAccess,         // 車
        data.parkingInfo,       // 駐車場
        slideUrl               // スライドURL
    ];
    
    await appendToSpreadsheet(masterSheetId, rowData);
}
```

### **3. 重複チェック機能**
```javascript
// 同じURLが既に処理済みかチェック
async function checkDuplicate(url, masterSheetId) {
    const existingData = await getSheetData(masterSheetId);
    return existingData.some(row => row[2] === url);
}
```

## 📋 **セットアップ手順書**

### **管理者用手順書**
```markdown
1. Google Driveで共有フォルダ作成
2. チームメンバーを招待（編集権限）
3. マスタースプレッドシート作成・共有
4. フォルダID・シートIDを全員に共有
5. 運用ルールの策定
```

### **メンバー用手順書**  
```markdown
1. 拡張機能をインストール
2. 個人のGoogleアカウントで認証
3. OpenAI APIキーを設定
4. チーム設定で共有ID入力
5. 登録者名を設定
```

## 🔒 **セキュリティ考慮事項**

### **メリット**
- ✅ 各自のアカウントで認証（安全）
- ✅ APIキーは個人管理
- ✅ 共有権限はGoogle管理

### **注意点**
- ⚠️ 共有フォルダの権限管理重要
- ⚠️ マスターDBの編集権限制御
- ⚠️ 退職者のアクセス削除必要

## 🚀 **実装優先度**

### **Phase 1: 基本共有機能**
- 共有フォルダ保存
- マスターDB連携
- 設定画面追加

### **Phase 2: 高度な機能**
- 重複チェック
- 検索・フィルター
- 統計レポート

### **Phase 3: 運用支援**
- 自動バックアップ
- アクセスログ
- 管理ダッシュボード

**この方式なら、セキュアで実用的なチーム共有が実現できます！**