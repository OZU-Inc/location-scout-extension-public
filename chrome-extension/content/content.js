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
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, address, time');
    const textContent = [];
    textElements.forEach(element => {
        const text = element.textContent.trim();
        // 10文字以上のテキストのみを対象（ノイズ除去）
        if (text && text.length > 10) {
            textContent.push(text);
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
    const addressElements = document.querySelectorAll('[itemprop="address"], .address, .location, address');
    if (addressElements.length > 0) {
        content.address = addressElements[0].textContent.trim();
    }

    // 電話番号の特別抽出
    const phoneElements = document.querySelectorAll('[href^="tel:"], [itemprop="telephone"]');
    if (phoneElements.length > 0) {
        content.phone = phoneElements[0].textContent.trim();
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