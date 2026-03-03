/**
 * Location Scout v2 - スライド生成モジュール
 * テンプレートの位置情報を使用した固定レイアウト方式
 */

const SLIDES_API_BASE = 'https://slides.googleapis.com/v1';

/**
 * スライドを作成
 * @param {Object} locationData - 場所情報
 * @param {Array} images - 保存済み画像情報（Drive上のファイルID）
 * @param {string} authToken - 認証トークン
 * @param {Object} settings - 設定
 * @returns {Promise<string>} スライドURL
 */
export async function createSlide(locationData, images, authToken, settings = {}) {
    try {
        console.log('スライド生成開始:', {
            imageCount: images?.length,
            slideMode: settings.slideMode,
            masterSlideId: settings.masterSlideId
        });

        let presentationId;
        let slideId;

        // スライドモードに応じて処理を分岐
        if (settings.slideMode === 'append' && settings.masterSlideId) {
            // 既存のプレゼンテーションに追加
            presentationId = settings.masterSlideId;
            console.log('既存スライドに追加:', presentationId);

            // 新しいスライドを追加（insertionIndex省略で最後に追加）
            slideId = generateId();
            const addSlideRequest = [{
                createSlide: {
                    objectId: slideId,
                    slideLayoutReference: { predefinedLayout: 'BLANK' }
                }
            }];

            await batchUpdate(presentationId, addSlideRequest, authToken);
            console.log('スライド追加完了:', slideId);
        } else {
            // 新規プレゼンテーション作成
            const presentation = await createPresentation(locationData.locationName, authToken);
            presentationId = presentation.presentationId;
            slideId = generateId();

            // 新しいスライドを作成（デフォルトのスライドは後で削除）
            const addSlideRequest = [{
                createSlide: {
                    objectId: slideId,
                    slideLayoutReference: { predefinedLayout: 'BLANK' }
                }
            }];
            await batchUpdate(presentationId, addSlideRequest, authToken);
        }

        // レイアウトを取得
        const templateLayout = getDefaultLayout();

        // テキストと線を作成（画像は技術的制限により除外）
        const contentRequests = generateContentRequests(templateLayout, locationData, slideId);

        if (contentRequests.length > 0) {
            await batchUpdate(presentationId, contentRequests, authToken);
        }

        const slideUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
        console.log('スライド生成完了:', slideUrl);
        return slideUrl;

    } catch (error) {
        console.error('スライド生成エラー:', error);
        throw new Error(`スライド生成に失敗しました: ${error.message}`);
    }
}

/**
 * コンテンツ（テキスト・線）生成リクエストを作成
 * 注: 画像はGoogle Slides APIの制限により、Drive URLからの直接挿入が困難なため除外
 */
function generateContentRequests(layout, data, slideId) {
    const requests = [];

    // テキストボックスを作成
    for (const tb of layout.textBoxes) {
        const tbId = generateId();
        const text = getTextForPlaceholder(tb.placeholder, data);

        requests.push({
            createShape: {
                objectId: tbId,
                shapeType: 'TEXT_BOX',
                elementProperties: {
                    pageObjectId: slideId,
                    size: {
                        width: { magnitude: tb.width, unit: 'PT' },
                        height: { magnitude: tb.height, unit: 'PT' }
                    },
                    transform: {
                        scaleX: 1,
                        scaleY: 1,
                        translateX: tb.x,
                        translateY: tb.y,
                        unit: 'PT'
                    }
                }
            }
        });

        if (text) {
            requests.push({
                insertText: {
                    objectId: tbId,
                    text: text,
                    insertionIndex: 0
                }
            });

            // フォントサイズ・色設定（全て10pt、黒色）
            requests.push({
                updateTextStyle: {
                    objectId: tbId,
                    textRange: { type: 'ALL' },
                    style: {
                        fontSize: { magnitude: 10, unit: 'PT' },
                        bold: tb.placeholder === 'title',
                        foregroundColor: {
                            opaqueColor: {
                                rgbColor: { red: 0, green: 0, blue: 0 }
                            }
                        }
                    },
                    fields: 'fontSize,bold,foregroundColor'
                }
            });

            // 段落スタイル（行間・余白をゼロに）
            requests.push({
                updateParagraphStyle: {
                    objectId: tbId,
                    textRange: { type: 'ALL' },
                    style: {
                        lineSpacing: 100,
                        spaceAbove: { magnitude: 0, unit: 'PT' },
                        spaceBelow: { magnitude: 0, unit: 'PT' }
                    },
                    fields: 'lineSpacing,spaceAbove,spaceBelow'
                }
            });
        }

        // テキストボックスの垂直位置を設定
        // タイトルは中央揃え、それ以外は上揃え
        requests.push({
            updateShapeProperties: {
                objectId: tbId,
                shapeProperties: {
                    contentAlignment: tb.verticalAlign || 'TOP'
                },
                fields: 'contentAlignment'
            }
        });
    }

    // 線を作成
    for (const line of layout.lines) {
        const lineId = generateId();

        requests.push({
            createLine: {
                objectId: lineId,
                lineCategory: 'STRAIGHT',
                elementProperties: {
                    pageObjectId: slideId,
                    size: {
                        width: { magnitude: line.width, unit: 'PT' },
                        height: { magnitude: line.height, unit: 'PT' }
                    },
                    transform: {
                        scaleX: 1,
                        scaleY: 1,
                        translateX: line.x,
                        translateY: line.y,
                        unit: 'PT'
                    }
                }
            }
        });
    }

    return requests;
}

/**
 * プレースホルダーに対応するテキストを取得
 */
function getTextForPlaceholder(placeholder, data) {
    switch (placeholder) {
        case 'title':
            return 'ロケ地候補';
        case 'locationName':
            return `場所名：${data.locationName || '記載無し'}`;
        case 'address':
            return `住所：${data.address || '記載無し'}`;
        case 'locationAddress':
            return `場所名：${data.locationName || '記載無し'}\n住所：${data.address || '記載無し'}`;
        case 'phone':
            return `電話番号：${data.phoneNumber || '記載無し'}`;
        case 'url':
            return `URL：${data.sourceUrl || ''}`;
        case 'phoneUrl':
            return `電話番号：${data.phoneNumber || '記載無し'}\nURL：${data.sourceUrl || ''}`;
        case 'trainAccess':
            return `【電車の場合】\n${data.trainAccess || '記載無し'}`;
        case 'carAccess':
            return `【車の場合】\n${data.carAccess || '記載無し'}`;
        case 'parking':
            return `駐車場：${data.parkingInfo || '記載無し'}`;
        case 'access':
            return `アクセス\n【電車の場合】\n${data.trainAccess || '記載無し'}\n【車の場合】\n${data.carAccess || '記載無し'}\n駐車場：${data.parkingInfo || '記載無し'}`;
        default:
            return '';
    }
}

/**
 * デフォルトのレイアウト（pptxテンプレートから抽出）
 * EMUからPTへの変換: 1 PT = 12700 EMU
 */
function getDefaultLayout() {
    // EMUからPTへの変換
    const emuToPt = (emu) => emu / 12700;

    return {
        textBoxes: [
            // タイトル「ロケ地候補」（左上）- 垂直中央揃え
            {
                x: emuToPt(635000),
                y: emuToPt(105558),
                width: emuToPt(3810000),
                height: emuToPt(507900),
                placeholder: 'title',
                verticalAlign: 'MIDDLE'  // pptxではanchor="ctr"
            },
            // 電話番号・URL（右上）- 上揃え
            {
                x: emuToPt(3893375),
                y: emuToPt(105550),
                width: emuToPt(3983400),
                height: emuToPt(381000),
                placeholder: 'phoneUrl',
                verticalAlign: 'TOP'
            },
            // 場所名・住所 - 上揃え
            {
                x: emuToPt(635000),
                y: emuToPt(740550),
                width: emuToPt(7620000),
                height: emuToPt(381000),
                placeholder: 'locationAddress',
                verticalAlign: 'TOP'
            },
            // アクセス情報（左下）- 上揃え
            {
                x: emuToPt(635000),
                y: emuToPt(3661550),
                width: emuToPt(7620000),
                height: emuToPt(1269900),
                placeholder: 'access',
                verticalAlign: 'TOP'
            }
        ],
        images: [
            // 上段左
            {
                x: emuToPt(177806),
                y: emuToPt(1248662),
                width: emuToPt(2845915),
                height: emuToPt(1897277)
            },
            // 上段中央
            {
                x: emuToPt(3149038),
                y: emuToPt(1248650),
                width: emuToPt(2845915),
                height: emuToPt(1897277)
            },
            // 上段右
            {
                x: emuToPt(6122251),
                y: emuToPt(1248663),
                width: emuToPt(2845915),
                height: emuToPt(1897277)
            },
            // 右下
            {
                x: emuToPt(6122251),
                y: emuToPt(3194873),
                width: emuToPt(2845915),
                height: emuToPt(1897277)
            }
        ],
        lines: [
            // 区切り線
            {
                x: emuToPt(635000),
                y: emuToPt(550050),
                width: emuToPt(7874100),
                height: 0
            }
        ]
    };
}

/**
 * プレゼンテーションを新規作成
 */
async function createPresentation(title, authToken) {
    console.log('プレゼンテーション作成開始:', title);

    const response = await fetch(`${SLIDES_API_BASE}/presentations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: `撮影地情報 - ${title}`
        })
    });

    console.log('Slides API応答:', response.status, response.statusText);

    if (!response.ok) {
        let errorDetail = response.statusText || `HTTP ${response.status}`;
        try {
            const errorBody = await response.json();
            console.error('Slides APIエラー詳細:', errorBody);
            errorDetail = errorBody.error?.message || JSON.stringify(errorBody);
        } catch (e) {
            const textBody = await response.text();
            console.error('Slides APIエラー(text):', textBody);
            if (textBody) errorDetail = textBody;
        }
        throw new Error(`プレゼンテーション作成失敗: ${errorDetail}`);
    }

    const result = await response.json();
    console.log('プレゼンテーション作成成功:', result.presentationId);
    return result;
}

/**
 * バッチ更新
 */
async function batchUpdate(presentationId, requests, authToken) {
    console.log('バッチ更新:', presentationId, 'リクエスト数:', requests.length);

    const response = await fetch(
        `${SLIDES_API_BASE}/presentations/${presentationId}:batchUpdate`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        }
    );

    if (!response.ok) {
        let errorDetail;
        try {
            const error = await response.json();
            console.error('バッチ更新エラー:', error);
            errorDetail = error.error?.message || JSON.stringify(error);
        } catch (e) {
            errorDetail = await response.text();
        }
        throw new Error(`バッチ更新失敗: ${errorDetail}`);
    }

    return await response.json();
}

/**
 * ユニークIDを生成
 */
function generateId() {
    return 'slide_' + Math.random().toString(36).substr(2, 9);
}
