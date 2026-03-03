/**
 * Location Scout v2 - スプレッドシート管理モジュール
 * 新しい項目構成に対応
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4';

// スプレッドシートのヘッダー定義
const SHEET_HEADERS = [
    'スタジオ名',
    'サイトURL',
    '広さ',
    '電車アクセス',
    '車アクセス',
    '駐車場情報',
    '金額（ムービー）',
    '金額（スチール）',
    '金額',
    '住所',
    '電話番号',
    'メールアドレス・フォーム',
    '登録日時',
    'スライドURL',
    'フォルダURL'
];

/**
 * スプレッドシートにデータを保存
 * @param {Object} locationData - 場所情報
 * @param {Object} urls - 各種URL情報
 * @param {string} spreadsheetId - スプレッドシートID
 * @param {string} authToken - 認証トークン
 * @returns {Promise<Object>}
 */
export async function saveToSpreadsheet(locationData, urls, spreadsheetId, authToken) {
    try {
        // シートが存在するか確認、なければ作成
        await ensureSheetExists(spreadsheetId, authToken);

        // データ行を作成
        const dataRow = formatDataRow(locationData, urls);

        // データを追加
        const range = 'ロケハンDB!A:O';
        const response = await fetch(
            `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: [dataRow]
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`スプレッドシート保存失敗: ${error.error?.message || response.statusText}`);
        }

        const result = await response.json();
        console.log('スプレッドシートに保存完了:', result);

        return {
            success: true,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
        };

    } catch (error) {
        console.error('スプレッドシート保存エラー:', error);
        throw error;
    }
}

/**
 * データ行をフォーマット
 * @param {Object} data - 場所情報
 * @param {Object} urls - URL情報
 * @returns {Array} データ行
 */
function formatDataRow(data, urls) {
    const timestamp = new Date().toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    // 連絡先情報を結合
    const contact = [data.email, data.contactForm].filter(Boolean).join('\n') || '記載無し';

    return [
        data.locationName || '記載無し',                    // スタジオ名
        data.sourceUrl || data.sourceInfo?.pageUrl || '',   // サイトURL
        data.size || '記載無し',                            // 広さ
        data.trainAccess || '記載無し',                     // 電車アクセス
        data.carAccess || '記載無し',                       // 車アクセス
        data.parkingInfo || '記載無し',                     // 駐車場情報
        data.priceMovie || '記載無し',                      // 金額（ムービー）
        data.priceStill || '記載無し',                      // 金額（スチール）
        data.priceGeneral || '記載無し',                    // 金額
        data.address || '記載無し',                         // 住所
        data.phoneNumber || '記載無し',                     // 電話番号
        contact,                                            // メールアドレス・フォーム
        timestamp,                                          // 登録日時
        urls.slideUrl || '',                                // スライドURL
        urls.folderUrl || ''                                // フォルダURL
    ];
}

/**
 * シートが存在することを確認し、なければ作成
 */
async function ensureSheetExists(spreadsheetId, authToken) {
    try {
        // スプレッドシート情報を取得
        const response = await fetch(
            `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );

        if (!response.ok) {
            throw new Error('スプレッドシート情報取得失敗');
        }

        const data = await response.json();
        const sheets = data.sheets || [];
        const hasSheet = sheets.some(s => s.properties.title === 'ロケハンDB');

        if (!hasSheet) {
            // シートを作成
            await createSheet(spreadsheetId, authToken);
        }

    } catch (error) {
        console.error('シート確認エラー:', error);
        // エラーの場合はシート作成を試みる
        await createSheet(spreadsheetId, authToken);
    }
}

/**
 * 新しいシートを作成してヘッダーを設定
 */
async function createSheet(spreadsheetId, authToken) {
    // シートを追加
    const addSheetResponse = await fetch(
        `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    addSheet: {
                        properties: {
                            title: 'ロケハンDB'
                        }
                    }
                }]
            })
        }
    );

    if (!addSheetResponse.ok) {
        const error = await addSheetResponse.json();
        // シートが既に存在する場合は無視
        if (!error.error?.message?.includes('already exists')) {
            throw new Error(`シート作成失敗: ${error.error?.message}`);
        }
    }

    // ヘッダーを設定
    await fetch(
        `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}/values/ロケハンDB!A1:O1?valueInputOption=USER_ENTERED`,
        {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [SHEET_HEADERS]
            })
        }
    );

    // ヘッダー行のスタイルを設定
    await formatHeaderRow(spreadsheetId, authToken);
}

/**
 * ヘッダー行のスタイルを設定
 */
async function formatHeaderRow(spreadsheetId, authToken) {
    // まずシートIDを取得
    const response = await fetch(
        `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
            headers: { 'Authorization': `Bearer ${authToken}` }
        }
    );

    if (!response.ok) return;

    const data = await response.json();
    const sheet = data.sheets?.find(s => s.properties.title === 'ロケハンDB');
    if (!sheet) return;

    const sheetId = sheet.properties.sheetId;

    // スタイルを適用
    await fetch(
        `${SHEETS_API_BASE}/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [
                    // ヘッダー行の背景色
                    {
                        repeatCell: {
                            range: {
                                sheetId: sheetId,
                                startRowIndex: 0,
                                endRowIndex: 1
                            },
                            cell: {
                                userEnteredFormat: {
                                    backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                                    textFormat: {
                                        foregroundColor: { red: 1, green: 1, blue: 1 },
                                        fontSize: 11,
                                        bold: true
                                    }
                                }
                            },
                            fields: 'userEnteredFormat(backgroundColor,textFormat)'
                        }
                    },
                    // 列幅を設定
                    {
                        updateDimensionProperties: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'COLUMNS',
                                startIndex: 0,
                                endIndex: 15
                            },
                            properties: { pixelSize: 150 },
                            fields: 'pixelSize'
                        }
                    },
                    // ヘッダー行を固定
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId: sheetId,
                                gridProperties: { frozenRowCount: 1 }
                            },
                            fields: 'gridProperties.frozenRowCount'
                        }
                    }
                ]
            })
        }
    );
}

/**
 * 新しいスプレッドシートを作成
 * @param {string} title - スプレッドシートのタイトル
 * @param {string} authToken - 認証トークン
 * @returns {Promise<string>} 作成したスプレッドシートのID
 */
export async function createSpreadsheet(title, authToken) {
    const response = await fetch(`${SHEETS_API_BASE}/spreadsheets`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            properties: { title },
            sheets: [{
                properties: { title: 'ロケハンDB' },
                data: [{
                    startRow: 0,
                    startColumn: 0,
                    rowData: [{
                        values: SHEET_HEADERS.map(header => ({
                            userEnteredValue: { stringValue: header }
                        }))
                    }]
                }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error('スプレッドシート作成失敗');
    }

    const spreadsheet = await response.json();
    await formatHeaderRow(spreadsheet.spreadsheetId, authToken);

    return spreadsheet.spreadsheetId;
}
