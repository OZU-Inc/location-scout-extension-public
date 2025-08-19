export async function analyzeWithGPT(pageContent, apiKey) {
    const systemPrompt = `あなたは場所・施設情報を抽出する専門家です。
与えられたWebページの内容から、ロケハン（ロケーションハンティング）に必要な情報を構造化して抽出してください。

特に以下の情報を重点的に抽出してください：
- 電車でのアクセス（最寄り駅、路線、所要時間）
- 車でのアクセス（高速道路IC、一般道からのルート）
- 駐車場情報（有無、台数、料金体系）

以下の形式でJSONを返してください：
{
    "locationName": "場所・施設の正式名称",
    "address": "住所（郵便番号含む）",
    "trainAccess": "電車でのアクセス情報（最寄り駅、路線名、駅からの所要時間など）",
    "carAccess": "車でのアクセス情報（最寄りIC、一般道からのルート、所要時間など）",
    "parkingInfo": "駐車場の有無と詳細（台数、料金、営業時間など）",
    "businessHours": "営業時間・開館時間",
    "closedDays": "定休日・休館日",
    "contact": {
        "phone": "電話番号",
        "email": "メールアドレス",
        "website": "公式サイトURL"
    },
    "features": ["特徴1", "特徴2", "特徴3"],
    "photoSpots": ["撮影に適した場所1", "撮影に適した場所2"],
    "facilities": ["設備1", "設備2"],
    "notes": "注意事項・撮影に関する制限など",
    "summary": "100文字程度の場所の概要"
}

駐車場情報は必ず以下の形式で記載：
- 「有り - 無料」
- 「有り - 30分200円、最大1,500円」
- 「無し」
- 「記載無し」

**重要**: 情報が見つからない項目やWebページに記載されていない項目は、null や空文字ではなく「記載無し」という文字列を設定してください。空配列の場合は [] のままで構いません。`;

    const userPrompt = `以下のWebページから場所情報を抽出してください：

タイトル: ${pageContent.title}
URL: ${pageContent.url}

メタ情報:
${JSON.stringify(pageContent.meta, null, 2)}

本文テキスト（最初の3000文字）:
${pageContent.text.substring(0, 3000)}

画像情報:
${pageContent.images.map(img => `- ${img.alt || 'No alt text'}`).join('\n')}

${pageContent.address ? `検出された住所: ${pageContent.address}` : ''}
${pageContent.phone ? `検出された電話番号: ${pageContent.phone}` : ''}
${pageContent.hours ? `検出された営業時間: ${pageContent.hours}` : ''}`;

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
        const locationData = JSON.parse(data.choices[0].message.content);
        
        locationData.sourceUrl = pageContent.url;
        locationData.extractedAt = new Date().toISOString();
        
        if (pageContent.images && pageContent.images.length > 0) {
            locationData.images = pageContent.images.slice(0, 4).map(img => img.src);
        }

        return locationData;

    } catch (error) {
        console.error('GPT解析エラー:', error);
        throw new Error(`GPT解析に失敗しました: ${error.message}`);
    }
}