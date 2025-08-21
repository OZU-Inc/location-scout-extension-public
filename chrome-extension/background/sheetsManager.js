export async function saveToSpreadsheet(locationData, slideUrl, authToken, spreadsheetId) {
    try {
        // 2行分のデータを作成（情報行とソース行）
        const dataRows = formatDataForSheetWithSource(locationData, slideUrl);
        
        const range = 'ロケハンDB!A:K';
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: dataRows  // 2行分のデータ
                })
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`スプレッドシート保存失敗: ${JSON.stringify(error)}`);
        }
        
        const result = await response.json();
        console.log('スプレッドシートに保存完了:', result);
        return result;
        
    } catch (error) {
        console.error('スプレッドシート保存エラー:', error);
        throw error;
    }
}

// 2行構成でデータを作成（情報行 + ソース行）
function formatDataForSheetWithSource(locationData, slideUrl, userName = '') {
    const now = new Date();
    const timestamp = now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // 1行目: 抽出した情報
    const dataRow = [
        timestamp,                                    // A列: 登録日時
        locationData.locationName || '記載無し',     // B列: 場所名
        locationData.address || '記載無し',          // C列: 住所
        locationData.trainAccess || '記載無し',      // D列: 電車アクセス
        locationData.carAccess || '記載無し',        // E列: 車アクセス
        locationData.parkingInfo || '記載無し',      // F列: 駐車場
        locationData.phoneNumber || '記載無し',      // G列: 電話番号
        slideUrl || '記載無し',                      // H列: スライドURL
        '',                                           // I列: 空（ソース情報用）
        '',                                           // J列: 空（ソース詳細用）
        ''                                            // K列: 空（抽出元用）
    ];
    
    // 2行目: ソース情報（薄い背景色で表示）
    const sourceRow = [
        '└ソース',                                   // A列: インデント付きラベル
        locationData.sourceInfo?.pageTitle || locationData.sourceUrl || '不明',  // B列: ページタイトル
        `=HYPERLINK("${locationData.sourceUrl}", "リンク")`,  // C列: クリック可能なリンク
        locationData.sourceInfo?.pageDescription || '',        // D列: ページ概要
        locationData.sourceInfo?.extractedFrom || '全体',      // E列: 抽出元セクション
        '',                                                     // F列: 空
        '',                                                     // G列: 空
        '',                                                     // H列: 空
        '',                                                     // I列: 空
        '',                                                     // J列: 空
        ''                                                      // K列: 空
    ];
    
    return [dataRow, sourceRow];
}

// 旧形式（互換性のため残す）
function formatDataForSheet(locationData, slideUrl, userName = '') {
    const dataRows = formatDataForSheetWithSource(locationData, slideUrl, userName);
    return dataRows[0]; // 1行目のみ返す
}

export async function saveToMasterSpreadsheet(locationData, slideUrl, authToken, masterSpreadsheetId, userName) {
    try {
        // 重複チェック
        const isDuplicate = await checkDuplicateEntry(masterSpreadsheetId, locationData.sourceUrl, authToken);
        if (isDuplicate) {
            console.log('Duplicate entry detected, skipping master DB save');
            return { success: true, duplicate: true };
        }
        
        // 2行分のデータを作成
        const masterDataRows = formatMasterDataForSheetWithSource(locationData, slideUrl, userName);
        
        const range = 'ロケハンDB!A:L';
        
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${masterSpreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    values: masterDataRows  // 2行分のデータ
                })
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`マスタースプレッドシート保存失敗: ${JSON.stringify(error)}`);
        }
        
        const result = await response.json();
        console.log('マスタースプレッドシートに保存完了:', result);
        return { success: true, duplicate: false };
        
    } catch (error) {
        console.error('マスタースプレッドシート保存エラー:', error);
        throw error;
    }
}

// マスター用2行構成データ作成
function formatMasterDataForSheetWithSource(locationData, slideUrl, userName) {
    const now = new Date();
    const timestamp = now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // 1行目: 抽出した情報
    const dataRow = [
        userName || '不明',                          // A列: 登録者
        timestamp,                                    // B列: 登録日時
        locationData.locationName || '記載無し',     // C列: 場所名
        locationData.address || '記載無し',          // D列: 住所
        locationData.trainAccess || '記載無し',      // E列: 電車アクセス
        locationData.carAccess || '記載無し',        // F列: 車アクセス
        locationData.parkingInfo || '記載無し',      // G列: 駐車場
        locationData.phoneNumber || '記載無し',      // H列: 電話番号
        slideUrl || '記載無し',                      // I列: スライドURL
        '',                                           // J列: 空
        '',                                           // K列: 空
        ''                                            // L列: 空
    ];
    
    // 2行目: ソース情報
    const sourceRow = [
        '└ソース',                                   // A列: インデント付きラベル
        '',                                           // B列: 空
        locationData.sourceInfo?.pageTitle || 'ソース',  // C列: ページタイトル
        `=HYPERLINK("${locationData.sourceUrl}", "リンク")`,  // D列: クリック可能なリンク
        locationData.sourceInfo?.pageDescription || '',        // E列: ページ概要
        locationData.sourceInfo?.extractedFrom || '全体',      // F列: 抽出元セクション
        '',                                                     // G列: 空
        '',                                                     // H列: 空
        '',                                                     // I列: 空
        '',                                                     // J列: 空
        '',                                                     // K列: 空
        ''                                                      // L列: 空
    ];
    
    return [dataRow, sourceRow];
}

// 旧形式（互換性のため残す）
function formatMasterDataForSheet(locationData, slideUrl, userName) {
    const dataRows = formatMasterDataForSheetWithSource(locationData, slideUrl, userName);
    return dataRows[0]; // 1行目のみ返す
}

async function checkDuplicateEntry(spreadsheetId, url, authToken) {
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/ロケハンDB!C:C`,
            {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }
        );
        
        if (!response.ok) return false;
        
        const data = await response.json();
        const values = data.values || [];
        
        return values.some(row => row[0] === url);
    } catch (error) {
        console.error('重複チェックエラー:', error);
        return false;
    }
}

export async function createMasterSpreadsheet(authToken, title = 'ロケハンマスターDB') {
    try {
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    title: title
                },
                sheets: [{
                    properties: {
                        title: 'ロケハンDB'
                    },
                    data: [{
                        startRow: 0,
                        startColumn: 0,
                        rowData: [{
                            values: [
                                { userEnteredValue: { stringValue: '登録者' } },
                                { userEnteredValue: { stringValue: '登録日時' } },
                                { userEnteredValue: { stringValue: 'URL' } },
                                { userEnteredValue: { stringValue: '場所名' } },
                                { userEnteredValue: { stringValue: '住所' } },
                                { userEnteredValue: { stringValue: '電車アクセス' } },
                                { userEnteredValue: { stringValue: '車アクセス' } },
                                { userEnteredValue: { stringValue: '駐車場' } },
                                { userEnteredValue: { stringValue: '電話番号' } },
                                { userEnteredValue: { stringValue: 'スライドURL' } }
                            ]
                        }]
                    }]
                }]
            })
        });
        
        if (!createResponse.ok) {
            throw new Error('マスタースプレッドシート作成失敗');
        }
        
        const spreadsheet = await createResponse.json();
        console.log('新規マスタースプレッドシート作成:', spreadsheet.spreadsheetId);
        
        await formatSpreadsheet(spreadsheet.spreadsheetId, authToken, true);
        
        return spreadsheet.spreadsheetId;
        
    } catch (error) {
        console.error('マスタースプレッドシート作成エラー:', error);
        throw error;
    }
}

export async function createSpreadsheetIfNotExists(authToken, title = 'ロケハンデータベース') {
    try {
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                properties: {
                    title: title
                },
                sheets: [{
                    properties: {
                        title: 'ロケハンDB'
                    },
                    data: [{
                        startRow: 0,
                        startColumn: 0,
                        rowData: [{
                            values: [
                                { userEnteredValue: { stringValue: '登録日時' } },
                                { userEnteredValue: { stringValue: 'URL' } },
                                { userEnteredValue: { stringValue: '場所名' } },
                                { userEnteredValue: { stringValue: '住所' } },
                                { userEnteredValue: { stringValue: '電車アクセス' } },
                                { userEnteredValue: { stringValue: '車アクセス' } },
                                { userEnteredValue: { stringValue: '駐車場' } },
                                { userEnteredValue: { stringValue: '電話番号' } },
                                { userEnteredValue: { stringValue: 'スライドURL' } }
                            ]
                        }]
                    }]
                }]
            })
        });
        
        if (!createResponse.ok) {
            throw new Error('スプレッドシート作成失敗');
        }
        
        const spreadsheet = await createResponse.json();
        console.log('新規スプレッドシート作成:', spreadsheet.spreadsheetId);
        
        await formatSpreadsheet(spreadsheet.spreadsheetId, authToken);
        
        return spreadsheet.spreadsheetId;
        
    } catch (error) {
        console.error('スプレッドシート作成エラー:', error);
        throw error;
    }
}

async function formatSpreadsheet(spreadsheetId, authToken, isMaster = false) {
    const columnCount = isMaster ? 9 : 8;
    const requests = [
        {
            repeatCell: {
                range: {
                    sheetId: 0,
                    startRowIndex: 0,
                    endRowIndex: 1
                },
                cell: {
                    userEnteredFormat: {
                        backgroundColor: {
                            red: 0.2,
                            green: 0.4,
                            blue: 0.8
                        },
                        textFormat: {
                            foregroundColor: {
                                red: 1,
                                green: 1,
                                blue: 1
                            },
                            fontSize: 11,
                            bold: true
                        }
                    }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
        },
        {
            updateDimensionProperties: {
                range: {
                    sheetId: 0,
                    dimension: 'COLUMNS',
                    startIndex: 0,
                    endIndex: columnCount
                },
                properties: {
                    pixelSize: 150
                },
                fields: 'pixelSize'
            }
        },
        {
            setDataValidation: {
                range: {
                    sheetId: 0,
                    startRowIndex: 1,
                    startColumnIndex: 6,
                    endColumnIndex: 7
                },
                rule: {
                    condition: {
                        type: 'ONE_OF_LIST',
                        values: [
                            { userEnteredValue: '有り - 無料' },
                            { userEnteredValue: '有り - 有料' },
                            { userEnteredValue: '無し' },
                            { userEnteredValue: '記載無し' }
                        ]
                    },
                    showCustomUi: true
                }
            }
        }
    ];
    
    await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        }
    );
}

export async function getSpreadsheetUrl(spreadsheetId) {
    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}