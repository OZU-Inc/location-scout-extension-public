/**
 * Location Scout v2 - Content Script
 * ページからテキスト情報・画像・リンクを抽出
 */

console.log('Location Scout v2 Content Script loaded');

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received:', request.action);

    switch (request.action) {
        case 'extractContent':
            handleExtractContent(request, sendResponse);
            return true;
        case 'extractLinks':
            handleExtractLinks(sendResponse);
            return true;
        case 'getImages':
            handleGetImages(request, sendResponse);
            return true;
        case 'downloadImage':
            handleDownloadImage(request, sendResponse);
            return true;
        case 'downloadImages':
            handleDownloadImages(request, sendResponse);
            return true;
    }
    return false;
});

/**
 * 画像をBase64でダウンロード（単一）
 */
async function handleDownloadImage(request, sendResponse) {
    try {
        let base64 = null;
        try {
            base64 = await imageUrlToBase64ViaImage(request.url);
        } catch (e) {
            base64 = await imageUrlToBase64ViaFetch(request.url);
        }
        sendResponse({ success: true, base64 });
    } catch (error) {
        console.error('Image download error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * 複数画像をBase64でダウンロード
 */
async function handleDownloadImages(request, sendResponse) {
    const results = [];
    const urls = request.urls || [];

    console.log(`=== 画像ダウンロード開始: ${urls.length}枚 ===`);

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
            console.log(`画像 ${i + 1}/${urls.length} ダウンロード中: ${url.substring(0, 80)}`);

            // まずImage要素で試す（CORS対応サーバー用）
            let base64 = null;
            try {
                base64 = await imageUrlToBase64ViaImage(url);
                console.log(`画像 ${i + 1} Image方式で成功`);
            } catch (imgError) {
                console.log(`Image方式失敗、fetch方式を試行: ${imgError.message}`);
                // fetchで試す（同一オリジンまたはCORS許可の場合）
                try {
                    base64 = await imageUrlToBase64ViaFetch(url);
                    console.log(`画像 ${i + 1} fetch方式で成功`);
                } catch (fetchError) {
                    throw new Error(`両方式とも失敗: ${fetchError.message}`);
                }
            }

            results.push({ url, success: true, base64 });
        } catch (error) {
            console.error(`画像 ${i + 1} ダウンロード失敗:`, error.message);
            results.push({ url, success: false, error: error.message });
        }
    }

    console.log(`=== 画像ダウンロード完了: 成功${results.filter(r => r.success).length}/${urls.length}枚 ===`);
    sendResponse({ results });
}

/**
 * Image要素を使って画像をBase64に変換
 */
function imageUrlToBase64ViaImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        const timeout = setTimeout(() => {
            reject(new Error('タイムアウト'));
        }, 10000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width || 800;
                canvas.height = img.naturalHeight || img.height || 600;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                resolve(dataUrl);
            } catch (e) {
                reject(new Error(`Canvas変換失敗: ${e.message}`));
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('画像読み込みエラー'));
        };

        img.src = url;
    });
}

/**
 * fetch APIを使って画像をBase64に変換
 */
async function imageUrlToBase64ViaFetch(url) {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader失敗'));
        reader.readAsDataURL(blob);
    });
}

/**
 * ページコンテンツの抽出（非同期対応・リトライ付き）
 */
async function handleExtractContent(request, sendResponse) {
    try {
        console.log('=== handleExtractContent 開始 ===');

        // ページの読み込み状態をチェック
        if (document.readyState !== 'complete') {
            console.log('ページ読み込み中、完了を待機...');
            await waitForPageLoad();
        }

        // 遅延読み込み画像のトリガー
        await triggerLazyLoadImages();

        // 画像抽出を実行（リトライ付き）
        let images = await extractImagesWithRetry(40, 3);

        const content = {
            title: document.title,
            url: window.location.href,
            domain: window.location.hostname,
            meta: extractMetaTags(),
            text: extractTextContent(),
            rawHtml: extractRelevantHtml(),
            structuredData: extractStructuredData(),
            images: images,
            links: extractRelatedLinks(),
            detectedAddress: detectAddress(),
            detectedPhone: detectPhone(),
            detectedPrice: detectPrice()
        };

        console.log('=== handleExtractContent 完了 ===');
        console.log(`抽出結果: 画像${images.length}枚, リンク${content.links.length}件`);

        sendResponse(content);
    } catch (error) {
        console.error('Content extraction error:', error);
        sendResponse({ error: error.message });
    }
}

/**
 * ページ読み込み完了を待機
 */
function waitForPageLoad() {
    return new Promise((resolve) => {
        if (document.readyState === 'complete') {
            resolve();
            return;
        }
        window.addEventListener('load', () => resolve(), { once: true });
        // 最大5秒待機
        setTimeout(resolve, 5000);
    });
}

/**
 * 遅延読み込み画像をトリガー
 */
async function triggerLazyLoadImages() {
    console.log('遅延読み込み画像をトリガー中...');

    // スクロールイベントを発火（遅延読み込みのトリガー）
    window.scrollTo(0, document.body.scrollHeight / 2);
    await sleep(300);
    window.scrollTo(0, document.body.scrollHeight);
    await sleep(300);
    window.scrollTo(0, 0);
    await sleep(500);

    // Intersection Observer APIを使用するサイト向けに、
    // 全てのlazyload候補要素を可視状態にする
    const lazyElements = document.querySelectorAll('[data-src], [data-lazy], [data-original], .lazy, .lazyload');
    console.log(`遅延読み込み候補要素: ${lazyElements.length}個`);

    // loading="lazy" 属性を持つ画像を即座に読み込む
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        img.loading = 'eager';
    });

    await sleep(500);
}

/**
 * スリープ関数
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * リトライ付き画像抽出
 */
async function extractImagesWithRetry(maxCount, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`画像抽出 試行 ${attempt}/${maxRetries}`);

        const images = extractImagesComprehensive(maxCount);

        if (images.length > 0) {
            console.log(`画像抽出成功: ${images.length}枚`);
            return images;
        }

        if (attempt < maxRetries) {
            console.log(`画像が見つからない、${1000 * attempt}ms待機して再試行...`);
            await sleep(1000 * attempt);

            // DOM変更を待つ
            await waitForDomChanges(500);
        }
    }

    console.warn('全試行で画像が見つからなかった');
    return [];
}

/**
 * DOM変更を待機
 */
function waitForDomChanges(timeout) {
    return new Promise((resolve) => {
        let resolved = false;

        const observer = new MutationObserver(() => {
            if (!resolved) {
                resolved = true;
                observer.disconnect();
                resolve();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style', 'data-src']
        });

        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                observer.disconnect();
                resolve();
            }
        }, timeout);
    });
}

/**
 * 関連リンクの抽出
 */
function handleExtractLinks(sendResponse) {
    try {
        const links = extractRelatedLinks();
        sendResponse({ links });
    } catch (error) {
        console.error('Link extraction error:', error);
        sendResponse({ error: error.message, links: [] });
    }
}

/**
 * 画像情報の取得（非同期対応）
 */
async function handleGetImages(request, sendResponse) {
    try {
        // 遅延読み込みをトリガー
        await triggerLazyLoadImages();

        // リトライ付きで画像抽出
        const images = await extractImagesWithRetry(request.maxImages || 40, 2);
        sendResponse({ images });
    } catch (error) {
        console.error('Image extraction error:', error);
        sendResponse({ error: error.message, images: [] });
    }
}

/**
 * メタタグ情報の抽出
 */
function extractMetaTags() {
    const meta = {};
    document.querySelectorAll('meta').forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (name && content) {
            meta[name] = content;
        }
    });
    return meta;
}

/**
 * テキストコンテンツの抽出
 */
function extractTextContent() {
    const textElements = document.querySelectorAll(
        'p, h1, h2, h3, h4, h5, h6, li, td, th, address, time, div, span, ' +
        'section, article, dd, dt, label, figcaption, caption'
    );

    const textContent = [];
    const processedTexts = new Set();

    // 重要なキーワードパターン
    const importantPatterns = [
        /[都道府県市区町村]/,
        /\d+[-−]\d+/,                    // 番地
        /[駅線]/,                         // 駅・路線
        /徒歩|車で|分|時間/,              // アクセス情報
        /〒\d{3}-?\d{4}/,                 // 郵便番号
        /TEL|電話|☎|℡/,                  // 電話番号
        /料金|価格|円|¥/,                 // 料金情報
        /㎡|m²|坪|平米/,                  // 広さ
        /駐車場|パーキング|P/,            // 駐車場
        /アクセス|交通|最寄/,             // アクセス
        /ムービー|スチール|撮影/,          // 撮影関連
        /収容|定員|人数/,                  // 収容人数
        /営業|時間|定休/                   // 営業時間
    ];

    textElements.forEach(element => {
        // 非表示要素はスキップ
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return;
        }

        const text = element.textContent.trim();
        if (!text || text.length < 3 || processedTexts.has(text)) {
            return;
        }

        // 重要なパターンを含むか、一定以上の長さがあるテキストを収集
        const isImportant = importantPatterns.some(pattern => pattern.test(text));
        if (isImportant || text.length > 10) {
            // セクション情報も付加
            const section = findParentSection(element);
            textContent.push({
                text: text,
                section: section,
                tagName: element.tagName.toLowerCase()
            });
            processedTexts.add(text);
        }
    });

    return textContent;
}

/**
 * 親セクションを探す
 */
function findParentSection(element) {
    let current = element;
    while (current && current !== document.body) {
        // セクション見出しを探す
        const heading = current.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
            return heading.textContent.trim();
        }

        // IDやクラス名から推測
        const id = current.id;
        const className = current.className;
        if (id && /access|price|info|about|facility|gallery/i.test(id)) {
            return id;
        }
        if (typeof className === 'string' && /access|price|info|about|facility|gallery/i.test(className)) {
            return className.split(' ')[0];
        }

        current = current.parentElement;
    }
    return 'main';
}

/**
 * 関連HTMLの抽出（生データ保存用）
 */
function extractRelevantHtml() {
    // メインコンテンツ領域を探す
    const mainSelectors = [
        'main',
        '[role="main"]',
        '#main',
        '.main',
        '#content',
        '.content',
        'article',
        '.container'
    ];

    for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element.innerHTML;
        }
    }

    // 見つからない場合はbody全体
    return document.body.innerHTML;
}

/**
 * 構造化データの抽出（JSON-LD、microdata）
 */
function extractStructuredData() {
    const data = [];

    // JSON-LD
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
            const json = JSON.parse(script.textContent);
            data.push({ type: 'json-ld', content: json });
        } catch (e) {
            console.log('JSON-LD parse error:', e);
        }
    });

    // Schema.org microdata
    document.querySelectorAll('[itemscope]').forEach(element => {
        const itemType = element.getAttribute('itemtype');
        if (itemType) {
            const props = {};
            element.querySelectorAll('[itemprop]').forEach(prop => {
                const name = prop.getAttribute('itemprop');
                const value = prop.content || prop.textContent.trim();
                props[name] = value;
            });
            data.push({ type: 'microdata', itemType, properties: props });
        }
    });

    return data;
}

/**
 * 包括的な画像抽出（全方式を網羅）
 * - img タグ（src, data-src, data-lazy, data-original, srcset等）
 * - background-image（インライン、CSS）
 * - picture/source
 * - object/embed
 * - SVG内のimage
 */
function extractImagesComprehensive(maxCount = 40) {
    const images = [];
    const processedUrls = new Set();

    console.log('========================================');
    console.log('=== 包括的画像抽出開始 ===');
    console.log(`現在のURL: ${window.location.href}`);
    console.log(`DOM状態: ${document.readyState}`);
    console.log('========================================');

    // 絶対URLに変換
    function toAbsoluteUrl(src) {
        if (!src || typeof src !== 'string') return null;
        src = src.trim();
        if (!src || src === 'about:blank') return null;
        if (src.startsWith('data:')) return null;  // data URLは除外
        if (src.startsWith('blob:')) return null;  // blob URLは除外

        try {
            if (src.startsWith('http://') || src.startsWith('https://')) return src;
            if (src.startsWith('//')) return 'https:' + src;
            if (src.startsWith('/')) return window.location.origin + src;
            return new URL(src, window.location.href).href;
        } catch (e) {
            console.warn('URL変換失敗:', src);
            return null;
        }
    }

    // 画像URLとして有効かチェック
    function isValidImageUrl(url) {
        if (!url) return false;
        // 画像の拡張子またはクエリパラメータで画像と判断できるもの
        const imagePatterns = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;
        const imageInPath = /(image|photo|pic|img|thumb|gallery|upload)/i;
        return imagePatterns.test(url) || imageInPath.test(url) || url.includes('wp-content/uploads');
    }

    // 画像を追加（重複チェック付き）
    function addImage(src, meta = {}) {
        const url = toAbsoluteUrl(src);
        if (!url || processedUrls.has(url)) return false;

        processedUrls.add(url);
        images.push({
            src: url,
            alt: meta.alt || '',
            width: meta.width || 0,
            height: meta.height || 0,
            caption: meta.caption || meta.alt || '',
            source: meta.source || 'unknown',
            priority: meta.priority || 10
        });
        return true;
    }

    // 除外判定: 関連ロケ地・その他エリアの画像を除外
    function shouldExclude(element) {
        if (!element) return false;

        // 除外ワードの定義（統一リスト）
        // ※IDやクラス名用（英語小文字）
        const idClassBlockList = [
            'recommend', 'related', 'other', 'similar',
            'neighbor', 'near', 'popular', 'pickup', 'ranking',
            'footer', 'sidebar', 'widget', 'ad-', 'archive'
        ];
        // ※テキスト用（日本語含む）
        const textBlockList = [
            '類似', '関連', 'おすすめ', '他の', '近く', '近隣', '人気',
            'recommend', 'related', 'other', 'similar', 'popular'
        ];

        // 1. footer/aside/navタグ内は即除外
        if (element.closest('footer, aside, nav')) {
            console.log(`  [除外] footer/aside/nav内`);
            return true;
        }

        // 2. 全ての親要素を遡ってID/クラス名をチェック（最大10階層）
        let ancestor = element.parentElement;
        for (let i = 0; i < 10; i++) {
            if (!ancestor || ancestor.tagName === 'BODY' || ancestor.tagName === 'HTML') break;

            // ID をチェック（最重要: id="recommend" 等）
            const id = (ancestor.id || '').toLowerCase();
            if (id && idClassBlockList.some(word => id.includes(word))) {
                console.log(`  [除外] 親要素ID一致: id="${id}"`);
                return true;
            }

            // クラス名をチェック
            const className = (ancestor.className && typeof ancestor.className === 'string')
                ? ancestor.className.toLowerCase() : '';
            if (className && idClassBlockList.some(word => className.includes(word))) {
                console.log(`  [除外] 親要素クラス一致: class="${className.substring(0, 40)}"`);
                return true;
            }

            // この親要素内のタイトル要素をチェック（.ttlJP, .ttlEN 等）
            const titleSelectors = '.ttlJP, .ttlEN, .ttl, .section-title, .title, h2, h3, h4';
            const titleEls = ancestor.querySelectorAll(titleSelectors);
            for (const titleEl of titleEls) {
                // タイトル要素が現在の画像より「前」にあるかチェック
                // （後ろにあるタイトルは別セクションの可能性）
                if (element.compareDocumentPosition(titleEl) & Node.DOCUMENT_POSITION_PRECEDING) {
                    const titleText = titleEl.textContent.trim().toLowerCase();
                    if (textBlockList.some(word => titleText.includes(word))) {
                        console.log(`  [除外] 親内タイトル一致: "${titleText.substring(0, 30)}"`);
                        return true;
                    }
                }
            }

            ancestor = ancestor.parentElement;
        }

        // 3. 直前の兄弟要素が見出しでないかチェック
        let current = element;
        for (let depth = 0; depth < 5; depth++) {
            if (!current || current.tagName === 'BODY' || current.tagName === 'HTML') break;

            const prev = current.previousElementSibling;
            if (prev) {
                const isHeader = /^H[1-6]$/.test(prev.tagName) ||
                                 prev.classList?.contains('title') ||
                                 prev.classList?.contains('heading') ||
                                 prev.classList?.contains('ttl') ||
                                 prev.classList?.contains('ttlArea');

                if (isHeader) {
                    const text = prev.textContent.trim().toLowerCase();
                    if (textBlockList.some(word => text.includes(word))) {
                        console.log(`  [除外] 直前兄弟見出し: "${text.substring(0, 30)}"`);
                        return true;
                    }
                }
            }

            current = current.parentElement;
        }

        return false;
    }

    // ===== 1. img タグ（全属性をチェック） =====
    console.log('--- [1] img タグ検索 ---');
    const imgTags = document.querySelectorAll('img');
    console.log(`img タグ数: ${imgTags.length}`);

    imgTags.forEach((img, index) => {
        // 除外エリアの画像はスキップ
        if (shouldExclude(img)) {
            return;
        }

        // 複数のソース属性をチェック
        const possibleSources = [
            img.src,
            img.currentSrc,
            img.getAttribute('src'),
            img.dataset.src,
            img.dataset.lazySrc,
            img.dataset.lazy,
            img.dataset.original,
            img.dataset.srcset,
            img.getAttribute('data-src'),
            img.getAttribute('data-lazy-src'),
            img.getAttribute('data-lazy'),
            img.getAttribute('data-original'),
            img.getAttribute('data-image'),
            img.getAttribute('data-bg'),
            img.getAttribute('data-background')
        ];

        // srcsetも処理
        const srcset = img.srcset || img.getAttribute('srcset') || img.dataset.srcset;
        if (srcset) {
            const srcsetUrls = srcset.split(',').map(s => s.trim().split(' ')[0]);
            possibleSources.push(...srcsetUrls);
        }

        let found = false;
        for (const src of possibleSources) {
            if (src && addImage(src, {
                alt: img.alt,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                caption: img.alt || img.title,
                source: 'img',
                priority: (img.naturalWidth || 100) * (img.naturalHeight || 100) > 10000 ? 70 : 30
            })) {
                console.log(`  [img ${index}] 発見: ${src.substring(0, 70)}`);
                found = true;
                break;
            }
        }

        if (!found && possibleSources.some(s => s)) {
            console.log(`  [img ${index}] スキップ (重複または無効): ${(possibleSources.find(s => s) || '').substring(0, 50)}`);
        }
    });

    // ===== 2. background-image（インラインstyle） =====
    console.log('--- [2] インラインstyle background-image検索 ---');
    let inlineCount = 0;

    // style属性を持つすべての要素
    document.querySelectorAll('[style*="background"]').forEach((el) => {
        // 除外エリアの画像はスキップ
        if (shouldExclude(el)) {
            return;
        }

        const style = el.getAttribute('style') || '';

        // background-image: url(...) または background: url(...) を抽出
        const matches = style.matchAll(/background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi);
        for (const match of matches) {
            if (addImage(match[1], {
                source: 'bg-inline',
                priority: 80,
                caption: findElementCaption(el)
            })) {
                console.log(`  [bg-inline] 発見: ${match[1].substring(0, 70)}`);
                inlineCount++;
            }
        }
    });
    console.log(`  インラインbg合計: ${inlineCount}個`);

    // ===== 3. background-image（getComputedStyle） =====
    console.log('--- [3] CSS background-image検索 ---');
    let computedCount = 0;

    // 画像が設定されていそうな要素を広範囲に検索
    const bgCandidates = document.querySelectorAll(
        'div, span, section, article, header, figure, aside, ' +
        'a, li, [class*="img"], [class*="image"], [class*="photo"], [class*="pic"], ' +
        '[class*="thumb"], [class*="gallery"], [class*="slide"], [class*="banner"], ' +
        '[class*="hero"], [class*="bg"], [class*="background"], [class*="cover"]'
    );

    bgCandidates.forEach((el) => {
        // 除外エリアの画像はスキップ
        if (shouldExclude(el)) {
            return;
        }

        try {
            const computed = window.getComputedStyle(el);
            const bgImage = computed.backgroundImage;

            if (bgImage && bgImage !== 'none' && bgImage !== 'initial') {
                // 複数のurl()がある場合も対応
                const matches = bgImage.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/g);
                for (const match of matches) {
                    if (addImage(match[1], {
                        source: 'bg-computed',
                        priority: 60,
                        caption: findElementCaption(el)
                    })) {
                        console.log(`  [bg-computed] 発見: ${match[1].substring(0, 70)}`);
                        computedCount++;
                    }
                }
            }
        } catch (e) {
            // 無視
        }
    });
    console.log(`  ComputedStyle bg合計: ${computedCount}個`);

    // ===== 4. picture/source要素 =====
    console.log('--- [4] picture/source検索 ---');
    let pictureCount = 0;

    document.querySelectorAll('picture').forEach((picture) => {
        // 除外エリアの画像はスキップ
        if (shouldExclude(picture)) {
            return;
        }

        picture.querySelectorAll('source').forEach((source) => {
            const srcset = source.srcset || source.getAttribute('srcset');
            if (srcset) {
                srcset.split(',').forEach(src => {
                    const url = src.trim().split(' ')[0];
                    if (addImage(url, { source: 'picture', priority: 50 })) {
                        console.log(`  [picture] 発見: ${url.substring(0, 70)}`);
                        pictureCount++;
                    }
                });
            }
        });
    });
    console.log(`  picture合計: ${pictureCount}個`);

    // ===== 5. data-* 属性から画像URL検索 =====
    console.log('--- [5] data-*属性検索 ---');
    let dataAttrCount = 0;

    const dataImageAttrs = [
        'data-src', 'data-lazy-src', 'data-lazy', 'data-original',
        'data-image', 'data-bg', 'data-background', 'data-poster',
        'data-thumb', 'data-large', 'data-full', 'data-zoom',
        'data-high-res', 'data-lowsrc', 'data-highsrc'
    ];

    dataImageAttrs.forEach(attr => {
        document.querySelectorAll(`[${attr}]`).forEach(el => {
            // 除外エリアの画像はスキップ
            if (shouldExclude(el)) {
                return;
            }

            const src = el.getAttribute(attr);
            if (src && addImage(src, {
                source: `data-attr:${attr}`,
                priority: 65,
                caption: findElementCaption(el)
            })) {
                console.log(`  [${attr}] 発見: ${src.substring(0, 70)}`);
                dataAttrCount++;
            }
        });
    });
    console.log(`  data-*属性合計: ${dataAttrCount}個`);

    // ===== 6. SVG内のimage要素 =====
    console.log('--- [6] SVG image検索 ---');
    let svgCount = 0;

    document.querySelectorAll('svg image, svg use').forEach(el => {
        // 除外エリアの画像はスキップ
        if (shouldExclude(el)) {
            return;
        }

        const href = el.getAttribute('href') || el.getAttribute('xlink:href');
        if (href && !href.startsWith('#') && addImage(href, { source: 'svg', priority: 20 })) {
            console.log(`  [svg] 発見: ${href.substring(0, 70)}`);
            svgCount++;
        }
    });
    console.log(`  SVG合計: ${svgCount}個`);

    // ===== 7. object/embed/iframe（画像の可能性） =====
    console.log('--- [7] object/embed検索 ---');
    let embedCount = 0;

    document.querySelectorAll('object[data], embed[src]').forEach(el => {
        // 除外エリアの画像はスキップ
        if (shouldExclude(el)) {
            return;
        }

        const src = el.getAttribute('data') || el.getAttribute('src');
        if (src && isValidImageUrl(src) && addImage(src, { source: 'embed', priority: 15 })) {
            console.log(`  [embed] 発見: ${src.substring(0, 70)}`);
            embedCount++;
        }
    });
    console.log(`  embed合計: ${embedCount}個`);

    // ===== 8. link[rel="preload"][as="image"] =====
    console.log('--- [8] preload image検索 ---');
    let preloadCount = 0;

    document.querySelectorAll('link[rel="preload"][as="image"]').forEach(link => {
        // preloadはhead内なので除外チェック不要だが念のため
        if (shouldExclude(link)) {
            return;
        }

        const href = link.href;
        if (href && addImage(href, { source: 'preload', priority: 40 })) {
            console.log(`  [preload] 発見: ${href.substring(0, 70)}`);
            preloadCount++;
        }
    });
    console.log(`  preload合計: ${preloadCount}個`);

    // ===== 結果のまとめ =====
    console.log('========================================');
    console.log(`=== 画像抽出完了: 合計 ${images.length} 枚 ===`);
    console.log('========================================');

    if (images.length === 0) {
        console.warn('警告: 画像が1枚も見つかりませんでした');
        console.log('デバッグ情報:');
        console.log('  - document.images.length:', document.images.length);
        console.log('  - img要素数:', document.querySelectorAll('img').length);
        console.log('  - [style*=background]要素数:', document.querySelectorAll('[style*="background"]').length);
    }

    // 優先度でソート
    images.sort((a, b) => b.priority - a.priority);

    // 最大数で切り詰め
    const result = images.slice(0, maxCount);

    console.log('最終結果:');
    result.forEach((img, i) => {
        console.log(`  ${i + 1}. [${img.source}] ${img.src.substring(0, 60)}`);
    });

    return result;
}

/**
 * 要素のキャプションを探す
 */
function findElementCaption(el) {
    // 親要素から探す
    const parent = el.closest('.grid-item, .item, .card, .slide, .box, figure, article');
    if (parent) {
        const captionEl = parent.querySelector(
            '.caption, .title, .name, .ttlJP, figcaption, h2, h3, h4, p'
        );
        if (captionEl) {
            return captionEl.textContent.trim().substring(0, 50);
        }
    }

    // alt, title属性
    return el.alt || el.title || '';
}

/**
 * 旧関数（後方互換性のため残す）
 */
function extractImages(maxCount = 16) {
    return extractImagesComprehensive(maxCount);
}

/**
 * 画像周辺のテキストを取得
 */
function getSurroundingText(img) {
    const texts = [];

    // 直接の親要素
    if (img.parentElement) {
        const parentText = img.parentElement.textContent.trim();
        if (parentText && parentText.length < 200) {
            texts.push(parentText);
        }
    }

    // figcaption
    const figure = img.closest('figure');
    if (figure) {
        const caption = figure.querySelector('figcaption');
        if (caption) {
            texts.push(caption.textContent.trim());
        }
    }

    // 前後の兄弟要素
    const prev = img.previousElementSibling;
    const next = img.nextElementSibling;
    if (prev && prev.textContent.trim().length < 100) {
        texts.push(prev.textContent.trim());
    }
    if (next && next.textContent.trim().length < 100) {
        texts.push(next.textContent.trim());
    }

    return texts.filter(t => t).join(' ');
}

/**
 * 画像のキャプションを探す
 */
function findImageCaption(img) {
    // figcaption
    const figure = img.closest('figure');
    if (figure) {
        const caption = figure.querySelector('figcaption');
        if (caption) return caption.textContent.trim();
    }

    // 直後のテキスト要素
    const next = img.nextElementSibling;
    if (next && (next.tagName === 'P' || next.tagName === 'SPAN' || next.tagName === 'DIV')) {
        const text = next.textContent.trim();
        if (text.length < 100) return text;
    }

    // data属性
    return img.dataset.caption || img.title || '';
}

/**
 * 関連リンクの抽出（クロール用）
 */
function extractRelatedLinks() {
    const links = [];
    const processedUrls = new Set();
    const currentDomain = window.location.hostname;
    const currentPath = window.location.pathname;

    // 関連ページを示すキーワード
    const relevantKeywords = [
        'アクセス', 'access', '交通',
        '料金', 'price', '価格', 'fee',
        'ギャラリー', 'gallery', '写真', 'photo',
        '設備', 'facility', '施設',
        '概要', 'about', '詳細', 'detail',
        'フロア', 'floor', 'マップ', 'map',
        '撮影', 'studio', 'ロケ'
    ];

    document.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.href;
        if (!href || processedUrls.has(href)) return;

        try {
            const url = new URL(href);

            // 同一ドメインのみ
            if (url.hostname !== currentDomain) return;

            // 同じページ内のアンカーリンクはスキップ
            if (url.pathname === currentPath && url.hash) return;

            // ファイルダウンロードリンクをスキップ
            if (/\.(pdf|doc|xls|zip|jpg|png|gif)$/i.test(url.pathname)) return;

            const linkText = anchor.textContent.trim().toLowerCase();
            const urlLower = href.toLowerCase();

            // 関連キーワードを含むかチェック
            const isRelevant = relevantKeywords.some(keyword =>
                linkText.includes(keyword.toLowerCase()) ||
                urlLower.includes(keyword.toLowerCase())
            );

            if (isRelevant) {
                links.push({
                    url: href,
                    text: anchor.textContent.trim(),
                    title: anchor.title || ''
                });
                processedUrls.add(href);
            }
        } catch (e) {
            // 無効なURLはスキップ
        }
    });

    return links;
}

/**
 * 住所情報の検出
 */
function detectAddress() {
    const patterns = [
        /〒\d{3}-?\d{4}[^\n<]{10,50}/,
        /(?:東京都|北海道|(?:京都|大阪)府|[^\s]{2,3}県)[^\n<]{5,50}/
    ];

    const allText = document.body.textContent;
    for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) return match[0].trim();
    }

    // セレクタで探す
    const addressSelectors = [
        '[itemprop="address"]',
        '.address',
        'address',
        '[class*="address"]'
    ];

    for (const selector of addressSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            return element.textContent.trim();
        }
    }

    return null;
}

/**
 * 電話番号の検出
 */
function detectPhone() {
    const patterns = [
        /\d{2,4}-\d{2,4}-\d{3,4}/,
        /\d{10,11}/
    ];

    // tel:リンクを優先
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) {
        return telLink.href.replace('tel:', '').trim();
    }

    const allText = document.body.textContent;
    for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match && match[0].length >= 10) {
            return match[0];
        }
    }

    return null;
}

/**
 * 料金情報の検出
 */
function detectPrice() {
    const patterns = [
        /(?:料金|価格|fee|price)[^\n<]{0,20}[\d,]+円/i,
        /[\d,]+円[^\n<]{0,10}(?:\/時間|\/h|\/日|\/day)/i,
        /ムービー[^\n<]{0,20}[\d,]+円/i,
        /スチール[^\n<]{0,20}[\d,]+円/i
    ];

    const allText = document.body.textContent;
    const prices = [];

    for (const pattern of patterns) {
        const match = allText.match(pattern);
        if (match) {
            prices.push(match[0].trim());
        }
    }

    return prices.length > 0 ? prices : null;
}
