export async function analyzeWithGPT(pageContent, apiKey) {
    const systemPrompt = `あなたは場所・施設情報を抽出する専門家です。
与えられたWebページの内容から、ロケハン（ロケーションハンティング）に必要な情報を構造化して抽出してください。

【情報抽出のヒント】
多くのWebサイトではアイコンのみで情報を表記することがあります。以下のパターンを認識してください：
- 🚃 🚉 🚊 電車 駅 → これらの記号の近くにある情報は「電車でのアクセス」「最寄り駅」
- 🚗 🚙 車 IC → これらの記号の近くにある情報は「車でのアクセス」
- 📍 住所 所在地 → これらの記号の近くにある情報は「住所」
- 📞 ☎️ TEL 電話 → これらの記号の近くにある情報は「電話番号」
- 🅿️ P 駐車場 パーキング → これらの記号の近くにある情報は「駐車場」
- 文脈から推測：例えば「JR山手線 新宿駅 徒歩5分」という文字列があれば、ラベルがなくても駅情報として認識

特に以下の情報を重点的に抽出してください：
- 電車でのアクセス（すべての最寄り駅、複数路線、各駅からの所要時間）
- 車でのアクセス（すべての高速道路IC、複数ルート）
- 駐車場情報（有無、台数、料金体系）
- 電話番号（代表番号、問い合わせ先）

以下の形式でJSONを返してください：
{
    "locationName": "場所・施設の正式名称",
    "address": "住所（郵便番号含む）",
    "trainAccess": "電車でのアクセス情報（複数の最寄り駅がある場合は改行で区切って全て記載。例：JR新宿駅南口 徒歩5分\\n東京メトロ新宿三丁目駅 徒歩3分\\n都営新宿線新宿駅 徒歩7分）",
    "carAccess": "車でのアクセス情報（複数ルートがある場合は改行で区切って全て記載）",
    "parkingInfo": "駐車場の有無と詳細（台数、料金など）",
    "phoneNumber": "電話番号（ハイフン区切りの形式）",
    "sourceInfo": {
        "pageTitle": "取得元ページのタイトル",
        "pageUrl": "取得元ページのURL",
        "pageDescription": "取得元ページの概要（30-50文字程度）",
        "extractedFrom": "情報を抽出した具体的なセクション名やページ内の場所",
        "dataQuality": "抽出した情報の信頼度（高・中・低）",
        "extractedFields": ["抽出できた情報項目のリスト"]
    }
}

駐車場情報は必ず以下の形式で記載：
- 「有り - 無料」
- 「有り - 30分200円、最大1,500円」
- 「無し」
- 「記載無し」

**重要**: 
1. 情報が見つからない項目やWebページに記載されていない項目は、null や空文字ではなく「記載無し」という文字列を設定してください。
2. sourceInfoは必ず含めてください。情報の出典と信頼性を詳細に記載してください。
3. extractedFromには「アクセス情報セクション」「施設概要ページ」「お問い合わせページ」など、具体的な場所を記載してください。
4. dataQualityは抽出した情報の完全性と信頼性を評価してください（高：公式サイトから完全な情報を取得、中：一部情報不足または非公式サイト、低：断片的な情報のみ）。
5. extractedFieldsには実際に抽出できた情報項目名（"locationName", "address", "trainAccess"など）をリストで記載してください。
6. pageUrlには取得元ページのURLを正確に記載してください。
7. **複数の最寄り駅やアクセス方法がある場合は、見つかった全ての情報を漏れなく記載してください。**
8. **アイコンや記号の近くにある情報も、文脈から適切に判断して抽出してください。**
9. **駅名と思われる文字列（「○○駅」「○○線」など）は積極的にアクセス情報として認識してください。**`;

    // pageContentの検証
    if (!pageContent || typeof pageContent !== 'object') {
        console.error('Invalid pageContent:', pageContent);
        throw new Error('ページコンテンツが正しく取得できませんでした');
    }

    const userPrompt = `以下のWebページから場所情報を抽出してください：

タイトル: ${pageContent.title || '不明'}
URL: ${pageContent.url || '不明'}

メタ情報:
${JSON.stringify(pageContent.meta || {}, null, 2)}

本文テキスト（最初の8000文字）:
${(pageContent.text || '').substring(0, 8000)}

${pageContent.address ? `検出された住所: ${pageContent.address}` : ''}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        // APIレスポンスの検証
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('GPT APIから無効なレスポンスが返されました');
        }
        
        const locationData = JSON.parse(data.choices[0].message.content);
        
        // 必須フィールドの検証
        if (!locationData || typeof locationData !== 'object') {
            throw new Error('GPTから有効な場所データが返されませんでした');
        }
        
        locationData.sourceUrl = pageContent.url || '不明';
        locationData.extractedAt = new Date().toISOString();

        return locationData;

    } catch (error) {
        console.error('GPT解析エラー:', error);
        throw new Error(`GPT解析に失敗しました: ${error.message}`);
    }
}