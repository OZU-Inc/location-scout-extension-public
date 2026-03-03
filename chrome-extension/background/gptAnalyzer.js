/**
 * Location Scout v2 - GPT解析モジュール
 * GPT-5-miniを使用したテキスト解析・画像分類
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL_NAME = 'gpt-4o-mini';  // Vision対応・安価なモデル

/**
 * テキストコンテンツから場所情報を抽出
 * @param {Object} mergedContent - 統合されたページコンテンツ
 * @param {string} apiKey - OpenAI APIキー
 * @returns {Promise<Object>} 抽出された場所情報
 */
export async function analyzeLocationData(mergedContent, apiKey) {
    const systemPrompt = `あなたはロケ地・撮影スタジオ情報を抽出する専門家です。
与えられたWebページの内容から、撮影ロケハンに必要な情報を構造化して抽出してください。

【スプレッドシート用項目】以下の情報を正確に抽出してください：
1. スタジオ名/場所名
2. サイトURL
3. 広さ（㎡、坪など、サイトの表記そのまま）
4. 電車アクセス（複数ある場合は改行区切り）
5. 車アクセス（複数ある場合は改行区切り）
6. 駐車場情報（有無、台数、料金）
7. 金額（ムービー）- ムービー撮影の料金
8. 金額（スチール）- スチール撮影の料金
9. 金額 - 上記が分かれていない場合の統合料金
10. 住所
11. 電話番号（ハイフン区切り）
12. メールアドレスまたはお問い合わせフォームURL

【スライド用項目】
- 場所名
- 住所
- 電車アクセス
- 車アクセス
- 駐車場情報
- 電話番号
- ソース情報（ページタイトル、セクション名、URL）

以下のJSON形式で返してください：
{
    "locationName": "場所・施設の正式名称",
    "address": "住所（郵便番号含む）",
    "size": "広さ（サイト表記のまま）",
    "trainAccess": "電車でのアクセス情報（複数は改行区切り）",
    "carAccess": "車でのアクセス情報（複数は改行区切り）",
    "parkingInfo": "駐車場情報",
    "priceMovie": "ムービー撮影料金",
    "priceStill": "スチール撮影料金",
    "priceGeneral": "統合料金（分かれていない場合）",
    "phoneNumber": "電話番号",
    "email": "メールアドレス",
    "contactForm": "お問い合わせフォームURL",
    "sourceInfo": {
        "pageTitle": "メインページのタイトル",
        "pageUrl": "メインページのURL",
        "additionalSources": ["追加で参照したページURL一覧"]
    }
}

**重要**:
1. 情報が見つからない項目は「記載無し」と記載
2. 料金はムービー/スチールで分かれている場合は別々に、分かれていない場合はpriceGeneralに記載
3. 複数ページの情報を統合している場合、すべてのソースURLを記載
4. 広さは「50㎡」「30坪」など、サイトの表記をそのまま記載`;

    const userPrompt = buildAnalysisPrompt(mergedContent);

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const locationData = JSON.parse(data.choices[0].message.content);

        // メタ情報を追加
        locationData.sourceUrl = mergedContent.mainPage?.url || '';
        locationData.extractedAt = new Date().toISOString();

        return locationData;

    } catch (error) {
        console.error('GPT解析エラー:', error);
        throw new Error(`GPT解析に失敗しました: ${error.message}`);
    }
}

/**
 * 画像を分類・フィルタリング（バッチ処理）
 * AIで「ロケ地写真として適切か」を判定し、分類名を付与
 * @param {Array} images - 画像情報の配列（base64付き）
 * @param {string} apiKey - OpenAI APIキー
 * @returns {Promise<Array>} 分類・フィルタリングされた画像情報
 */
export async function classifyImages(images, apiKey) {
    console.log(`=== AI画像分類・フィルタリング開始: ${images.length}枚 ===`);

    if (images.length === 0) {
        return [];
    }

    // バッチサイズ（GPT-4o-miniは複数画像を一度に処理可能）
    const BATCH_SIZE = 10;
    const allResults = [];

    for (let batchStart = 0; batchStart < images.length; batchStart += BATCH_SIZE) {
        const batch = images.slice(batchStart, batchStart + BATCH_SIZE);
        console.log(`バッチ処理: ${batchStart + 1}〜${batchStart + batch.length}枚目`);

        try {
            const batchResults = await classifyImageBatch(batch, apiKey);
            allResults.push(...batchResults);
        } catch (error) {
            console.error(`バッチ処理エラー:`, error);
            // エラー時は各画像をunknown/validとして追加（保守的に保存）
            for (const img of batch) {
                allResults.push({
                    ...img,
                    classification: 'その他',
                    isValid: true,
                    aiReason: 'バッチ処理エラーのため判定スキップ'
                });
            }
        }
    }

    // Valid判定された画像のみを返す
    const validImages = allResults.filter(img => img.isValid);
    const invalidImages = allResults.filter(img => !img.isValid);

    console.log(`=== AI判定結果 ===`);
    console.log(`  Valid（保存対象）: ${validImages.length}枚`);
    console.log(`  Invalid（除外）: ${invalidImages.length}枚`);

    if (invalidImages.length > 0) {
        console.log(`除外された画像:`);
        invalidImages.forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.classification}: ${img.aiReason || ''}`);
        });
    }

    return validImages;
}

/**
 * 画像バッチをAIで分類・フィルタリング
 * @param {Array} images - 画像バッチ（base64付き）
 * @param {string} apiKey - OpenAI APIキー
 * @returns {Promise<Array>} 分類結果
 */
async function classifyImageBatch(images, apiKey) {
    const prompt = `あなたはロケーションスカウト（撮影地選定）の専門家です。
以下の画像を分析し、各画像が「撮影ロケ地の写真として適切か」を判定してください。

【Valid（適切）として判定するもの】
- 実際の場所・空間・建物の写真
- 内観写真（リビング、キッチン、オフィス、スタジオなど）
- 外観写真（建物、庭、駐車場など）
- 撮影ロケハンで参考になる風景や空間

【Invalid（不適切）として除外するもの】
- イラスト、漫画、アニメ調の画像
- アイコン、ロゴ、シンボルマーク
- 地図、間取り図、フロアマップ
- 文字が主体のバナー広告
- 人物のバストアップ、ポートレート写真
- UI部品、ボタン、SNSアイコン
- 装飾的なグラフィック

各画像について、以下のJSON形式で回答してください:
{
  "results": [
    {
      "index": 0,
      "isValid": true,
      "classification": "リビング",
      "reason": "住宅の内観写真"
    },
    {
      "index": 1,
      "isValid": false,
      "classification": "イラスト",
      "reason": "漫画調のイラスト画像"
    }
  ]
}

【分類名の候補】
Valid時: キッチン, リビング, ベッドルーム, お風呂, トイレ, 玄関, 廊下, 和室, 洋室, バルコニー, 庭, 会議室, エレベーターホール, ロビー, 食堂, オフィス, 受付, 屋上, 白ホリゾント, 黒ホリゾント, 控室, メイクルーム, 外観, 駐車場, その他
Invalid時: イラスト, アイコン, ロゴ, 地図, バナー, 人物, UI部品, グラフィック`;

    // 画像をメッセージコンテンツとして構築
    const content = [{ type: 'text', text: prompt }];

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        // base64がある場合はそれを使用、なければURLを使用
        const imageData = img.base64 || img.src;

        if (imageData) {
            content.push({
                type: 'image_url',
                image_url: {
                    url: imageData.startsWith('data:') ? imageData : img.src,
                    detail: 'low'  // コスト削減のため低解像度
                }
            });
            content.push({
                type: 'text',
                text: `[画像${i}] キャプション: "${img.caption || img.alt || 'なし'}"`
            });
        }
    }

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [{ role: 'user', content }],
                max_tokens: 1000,
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const aiResponse = JSON.parse(data.choices[0].message.content);

        // 結果をマージ
        const results = [];
        for (let i = 0; i < images.length; i++) {
            const aiResult = aiResponse.results?.find(r => r.index === i) || {
                isValid: true,
                classification: 'その他',
                reason: 'AI判定なし'
            };

            results.push({
                ...images[i],
                classification: aiResult.classification || 'その他',
                isValid: aiResult.isValid !== false,  // 明示的にfalseでない限りtrue
                aiReason: aiResult.reason || ''
            });
        }

        return results;

    } catch (error) {
        console.error('AI画像分類エラー:', error);

        // フォールバック: 従来の1枚ずつの処理
        console.log('フォールバック: 従来方式で1枚ずつ処理');
        const results = [];
        for (const img of images) {
            const classification = await classifyWithVisionSingle(img.src, apiKey);
            results.push({
                ...img,
                classification: classification.classification,
                isValid: classification.isValid,
                aiReason: classification.reason
            });
        }
        return results;
    }
}

/**
 * 単一画像をVision APIで分類（フォールバック用）
 */
async function classifyWithVisionSingle(imageUrl, apiKey) {
    try {
        const result = await classifyWithVision(imageUrl, apiKey);
        const excludeCategories = ['イラスト', 'アイコン', 'ロゴ', 'バナー', '図解', '地図', '間取り図', 'フロアマップ', '人物', 'UI部品', 'グラフィック'];
        return {
            classification: result,
            isValid: !excludeCategories.includes(result),
            reason: excludeCategories.includes(result) ? `${result}のため除外` : ''
        };
    } catch (e) {
        return { classification: 'その他', isValid: true, reason: 'エラーのため保守的に保存' };
    }
}

/**
 * テキスト情報から画像を分類
 * @param {string} alt - alt属性
 * @param {string} surroundingText - 周辺テキスト
 * @param {string} caption - キャプション
 * @returns {string} 分類名
 */
function classifyFromText(alt = '', surroundingText = '', caption = '') {
    const text = `${alt} ${surroundingText} ${caption}`.toLowerCase();

    // 住居系
    if (/キッチン|kitchen|台所|調理/.test(text)) return 'キッチン';
    if (/リビング|living|居間/.test(text)) return 'リビング';
    if (/ベッドルーム|bedroom|寝室/.test(text)) return 'ベッドルーム';
    if (/バスルーム|bathroom|浴室|お風呂|風呂/.test(text)) return 'お風呂';
    if (/トイレ|toilet|化粧室|手洗/.test(text)) return 'トイレ';
    if (/玄関|エントランス|entrance/.test(text)) return '玄関';
    if (/廊下|corridor|hallway/.test(text)) return '廊下';
    if (/和室|tatami/.test(text)) return '和室';
    if (/洋室|western/.test(text)) return '洋室';
    if (/バルコニー|ベランダ|balcony/.test(text)) return 'バルコニー';
    if (/庭|ガーデン|garden/.test(text)) return '庭';

    // オフィス・商業施設系
    if (/会議室|meeting|conference/.test(text)) return '会議室';
    if (/エレベーター|elevator|lift/.test(text)) return 'エレベーターホール';
    if (/ロビー|lobby|エントランス/.test(text)) return 'ロビー';
    if (/食堂|カフェテリア|cafeteria|社食/.test(text)) return '食堂';
    if (/オフィス|office|執務/.test(text)) return 'オフィス';
    if (/受付|reception/.test(text)) return '受付';
    if (/廊下|通路|corridor/.test(text)) return '廊下';
    if (/屋上|rooftop/.test(text)) return '屋上';

    // スタジオ系
    if (/白ホリ|ホリゾント|cyclorama/.test(text)) return '白ホリゾント';
    if (/黒ホリ/.test(text)) return '黒ホリゾント';
    if (/控室|楽屋|green\s?room/.test(text)) return '控室';
    if (/メイク|makeup/.test(text)) return 'メイクルーム';

    // 外観
    if (/外観|exterior|建物|ビル|building|facade/.test(text)) return '外観';
    if (/駐車場|parking/.test(text)) return '駐車場';

    return 'unknown';
}

/**
 * Vision APIで画像を分類
 * @param {string} imageUrl - 画像URL
 * @param {string} apiKey - OpenAI APIキー
 * @returns {Promise<string>} 分類名
 */
async function classifyWithVision(imageUrl, apiKey) {
    const prompt = `この画像を分類してください。以下のいずれかで答えてください：

【場所・部屋】
キッチン、リビング、ベッドルーム、お風呂、トイレ、玄関、廊下、和室、洋室、バルコニー、庭、
会議室、エレベーターホール、ロビー、食堂、オフィス、受付、屋上、
白ホリゾント、黒ホリゾント、控室、メイクルーム、外観、駐車場、その他

【除外対象（写真ではないもの）】
イラスト、アイコン、ロゴ、バナー、図解、地図、間取り図、フロアマップ

重要: 実際の場所・空間の写真なら場所名を、イラストやアイコン等なら除外対象のカテゴリを返してください。
回答は分類名のみを返してください。`;

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            {
                                type: 'image_url',
                                image_url: { url: imageUrl, detail: 'low' }
                            }
                        ]
                    }
                ],
                max_tokens: 50,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            throw new Error(`Vision API error: ${response.statusText}`);
        }

        const data = await response.json();
        const classification = data.choices[0].message.content.trim();

        // 有効な分類名かチェック
        const validClassifications = [
            'キッチン', 'リビング', 'ベッドルーム', 'お風呂', 'トイレ', '玄関', '廊下',
            '和室', '洋室', 'バルコニー', '庭', '会議室', 'エレベーターホール', 'ロビー',
            '食堂', 'オフィス', '受付', '屋上', '白ホリゾント', '黒ホリゾント', '控室',
            'メイクルーム', '外観', '駐車場', 'その他'
        ];

        // 除外対象カテゴリ
        const excludeClassifications = [
            'イラスト', 'アイコン', 'ロゴ', 'バナー', '図解', '地図', '間取り図', 'フロアマップ'
        ];

        if (excludeClassifications.includes(classification)) {
            return classification; // 除外対象として返す
        }

        return validClassifications.includes(classification) ? classification : 'その他';

    } catch (error) {
        console.error('Vision classification error:', error);
        return 'unknown';
    }
}

/**
 * 解析用プロンプトを構築
 * @param {Object} mergedContent - 統合コンテンツ
 * @returns {string} プロンプト
 */
function buildAnalysisPrompt(mergedContent) {
    let prompt = `以下のWebページから場所情報を抽出してください：

【メインページ】
タイトル: ${mergedContent.mainPage?.title || '不明'}
URL: ${mergedContent.mainPage?.url || '不明'}

本文テキスト:
${mergedContent.allText?.substring(0, 10000) || ''}
`;

    // 追加ページ情報
    if (mergedContent.additionalPages?.length > 0) {
        prompt += '\n【追加ページ】\n';
        for (const page of mergedContent.additionalPages) {
            prompt += `\n--- ${page.title} (${page.type}) ---\n`;
            prompt += `URL: ${page.url}\n`;
            prompt += `${page.content?.text?.substring(0, 3000) || ''}\n`;
        }
    }

    // 構造化データがあれば追加
    if (mergedContent.mainPage?.structuredData?.length > 0) {
        prompt += '\n【構造化データ】\n';
        prompt += JSON.stringify(mergedContent.mainPage.structuredData, null, 2);
    }

    return prompt;
}
