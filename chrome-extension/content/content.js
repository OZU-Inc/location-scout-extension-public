/**
 * Webページのコンテンツを抽出する関数
 * 目的: 現在表示されているページから場所情報を含む可能性のあるテキスト・画像・メタデータを収集
 * GPT分析用のデータを準備する
 */
function extractPageContent() {
    // 抽出するコンテンツの構造を定義
    const content = {
        title: document.title,           // ページタイトル
        url: window.location.href,       // 現在のURL
        meta: {},                        // メタタグ情報（SEO、OGP等）
        text: '',                        // 本文テキスト
        images: []                       // 画像URL一覧
    };

    // メタタグ情報の収集（場所情報やOGPデータを含む可能性）
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        const metaContent = tag.getAttribute('content');
        if (name && metaContent) {
            content.meta[name] = metaContent;  // meta[name] = content形式で保存
        }
    });

    // テキスト要素から場所情報を含む可能性のある要素を選択的に抽出
    // より多くのHTML要素タイプを含めて、複雑なHTML構造にも対応
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, address, time, div, span, section, article, dd, dt, label, figcaption');
    const textContent = [];
    const processedTexts = new Set(); // 重複除去用
    
    textElements.forEach(element => {
        const text = element.textContent.trim();
        // 5文字以上のテキストのみを対象（住所や駅名も取得できるよう閾値を下げる）
        if (text && text.length > 5 && !processedTexts.has(text)) {
            // 住所パターンや交通情報パターンを優先的に抽出
            if (text.match(/[都道府県市区町村]/g) || 
                text.match(/\d+[-−]\d+/g) || // 番地
                text.match(/[駅線]/g) || // 駅・路線
                text.match(/徒歩|車で|分/g) || // アクセス情報
                text.match(/〒\d{3}-?\d{4}/g) || // 郵便番号
                text.match(/TEL|電話|☎/g)) { // 電話番号
                textContent.push(text);
                processedTexts.add(text);
            } else if (text.length > 10) { // その他の一般的なテキストは10文字以上
                textContent.push(text);
                processedTexts.add(text);
            }
        }
    });
    content.text = textContent.join('\n');  // 改行区切りで結合

    // 画像情報の収集（ロケ地の外観写真等）
    const images = document.querySelectorAll('img');
    const imageUrls = [];
    images.forEach((img, index) => {
        // 最初の10枚まで、100x100px以上の画像のみ対象（小さなアイコン等除外）
        if (index < 10 && img.src && img.width > 100 && img.height > 100) {
            imageUrls.push({
                src: img.src,           // 画像URL
                alt: img.alt || '',     // alt属性（画像の説明）
                width: img.width,       // 幅
                height: img.height      // 高さ
            });
        }
    });
    content.images = imageUrls;

    // 住所情報の特別抽出（構造化データやclass名から）
    const addressSelectors = [
        '[itemprop="address"]',
        '.address',
        '.location',
        'address',
        '[class*="address"]',
        '[class*="location"]',
        '[class*="place"]',
        '[id*="address"]',
        '[id*="location"]'
    ];
    
    // 住所パターンを含むすべての要素を検索
    const allElements = document.querySelectorAll('*');
    let addressFound = false;
    
    for (const element of allElements) {
        const text = element.textContent.trim();
        // 郵便番号パターンまたは住所っぽいパターンを検出
        if (text.match(/〒\d{3}-?\d{4}/) || 
            (text.match(/[都道府県]/) && text.match(/[市区町村]/) && text.match(/\d/))) {
            content.address = text;
            addressFound = true;
            break;
        }
    }
    
    // パターンマッチで見つからない場合は、セレクタで探す
    if (!addressFound) {
        for (const selector of addressSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                content.address = elements[0].textContent.trim();
                break;
            }
        }
    }

    // 電話番号の特別抽出（より多くのパターンに対応）
    const phoneSelectors = [
        '[href^="tel:"]',
        '[itemprop="telephone"]',
        '[class*="phone"]',
        '[class*="tel"]',
        '[id*="phone"]',
        '[id*="tel"]'
    ];
    
    let phoneFound = false;
    
    // 電話番号パターンを含むすべての要素を検索
    for (const element of allElements) {
        const text = element.textContent.trim();
        // 電話番号パターンを検出
        if (text.match(/\d{2,4}-\d{2,4}-\d{3,4}/) || 
            text.match(/\d{10,11}/) ||
            text.match(/TEL|電話|☎/)) {
            // 電話番号っぽい数字を抽出
            const phoneMatch = text.match(/[\d-]+/);
            if (phoneMatch && phoneMatch[0].length >= 10) {
                content.phone = phoneMatch[0];
                phoneFound = true;
                break;
            }
        }
    }
    
    if (!phoneFound) {
        for (const selector of phoneSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                content.phone = elements[0].textContent.trim();
                break;
            }
        }
    }


    return content;  // 抽出完了したコンテンツを返却
}

/**
 * バックグラウンドスクリプトからのメッセージ受信リスナー
 * 'extractContent' アクションで呼び出され、ページコンテンツを抽出して返す
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Content script received message:', request.action);
    
    if (request.action === 'extractContent') {
        try {
            const content = extractPageContent();  // ページコンテンツ抽出実行
            console.log('📤 Content script sending response:', content);
            sendResponse(content);                 // 結果をバックグラウンドスクリプトに返送
        } catch (error) {
            console.error('❌ Content extraction error:', error);
            sendResponse({ error: error.message });
        }
        return true;  // 非同期レスポンス有効化
    }
    return false;
});