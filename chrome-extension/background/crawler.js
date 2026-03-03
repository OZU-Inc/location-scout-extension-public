/**
 * Location Scout v2 - 複数ページクローラー
 * 関連ページを自動検出してコンテンツを収集
 */

// クロール対象キーワード（優先度順）
const CRAWL_KEYWORDS = [
    // アクセス情報
    { pattern: /アクセス|access|交通|最寄/i, priority: 10 },
    // 料金情報
    { pattern: /料金|price|価格|fee|利用料/i, priority: 9 },
    // ギャラリー・写真
    { pattern: /ギャラリー|gallery|写真|photo|フォト/i, priority: 8 },
    // 設備・施設情報
    { pattern: /設備|facility|施設|equipment/i, priority: 7 },
    // 概要・詳細
    { pattern: /概要|about|詳細|detail|紹介/i, priority: 6 },
    // フロア・間取り
    { pattern: /フロア|floor|間取り|マップ|map|平面図/i, priority: 5 },
    // 撮影関連
    { pattern: /撮影|studio|ロケ|location/i, priority: 4 },
    // お問い合わせ
    { pattern: /問い合わせ|contact|予約|reserve/i, priority: 3 }
];

// 最大クロールページ数
const MAX_CRAWL_PAGES = 5;

/**
 * 関連ページをクロールしてコンテンツを収集
 * @param {number} tabId - 現在のタブID
 * @param {Array} links - content.jsから取得したリンク一覧
 * @param {Function} progressCallback - 進捗コールバック
 * @returns {Promise<Array>} クロール結果の配列
 */
export async function crawlRelatedPages(tabId, links, progressCallback) {
    console.log(`Starting crawl with ${links.length} candidate links`);

    // リンクをスコアリングしてソート
    const scoredLinks = links.map(link => ({
        ...link,
        score: calculateLinkScore(link)
    })).filter(link => link.score > 0)
       .sort((a, b) => b.score - a.score)
       .slice(0, MAX_CRAWL_PAGES);

    console.log(`Crawling ${scoredLinks.length} pages:`, scoredLinks.map(l => l.url));

    const results = [];

    for (let i = 0; i < scoredLinks.length; i++) {
        const link = scoredLinks[i];

        if (progressCallback) {
            progressCallback(`関連ページ ${i + 1}/${scoredLinks.length} をクロール中: ${link.text}`);
        }

        try {
            const pageContent = await fetchPageContent(link.url);
            results.push({
                url: link.url,
                title: link.text,
                type: detectPageType(link),
                content: pageContent,
                success: true
            });
            console.log(`Crawled: ${link.url}`);

            // サーバー負荷軽減のため少し待機
            await sleep(500);

        } catch (error) {
            console.error(`Failed to crawl ${link.url}:`, error);
            results.push({
                url: link.url,
                title: link.text,
                success: false,
                error: error.message
            });
        }
    }

    return results;
}

/**
 * リンクのスコアを計算
 * @param {Object} link - リンク情報
 * @returns {number} スコア
 */
function calculateLinkScore(link) {
    const text = (link.text + ' ' + link.url).toLowerCase();
    let score = 0;

    for (const keyword of CRAWL_KEYWORDS) {
        if (keyword.pattern.test(text)) {
            score += keyword.priority;
        }
    }

    return score;
}

/**
 * ページタイプを検出
 * @param {Object} link - リンク情報
 * @returns {string} ページタイプ
 */
function detectPageType(link) {
    const text = (link.text + ' ' + link.url).toLowerCase();

    if (/アクセス|access|交通/.test(text)) return 'access';
    if (/料金|price|fee/.test(text)) return 'price';
    if (/ギャラリー|gallery|写真|photo/.test(text)) return 'gallery';
    if (/設備|facility/.test(text)) return 'facility';
    if (/概要|about/.test(text)) return 'about';
    if (/フロア|floor|間取り/.test(text)) return 'floor';

    return 'other';
}

/**
 * ページコンテンツを取得（fetch経由）
 * @param {string} url - ページURL
 * @returns {Promise<Object>} ページコンテンツ
 */
async function fetchPageContent(url) {
    const response = await fetch(url, {
        credentials: 'omit',
        headers: {
            'Accept': 'text/html,application/xhtml+xml'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return parseHtmlContent(html, url);
}

/**
 * HTMLをパースしてコンテンツを抽出（正規表現ベース - Service Worker対応）
 * @param {string} html - HTML文字列
 * @param {string} url - ページURL
 * @returns {Object} 抽出したコンテンツ
 */
function parseHtmlContent(html, url) {
    // Service WorkerではDOMParserが使用できないため、正規表現でパース

    // タイトル抽出
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';

    // テキスト抽出（主要なテキスト要素から）
    const texts = [];
    const textPatterns = [
        /<p[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/p>/gi,
        /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        /<li[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/li>/gi,
        /<td[^>]*>([^<]+)<\/td>/gi,
        /<address[^>]*>([^<]+(?:<[^>]+>[^<]*)*)<\/address>/gi,
        /<dd[^>]*>([^<]+)<\/dd>/gi
    ];

    for (const pattern of textPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const text = stripHtmlTags(match[1]).trim();
            if (text && text.length > 3) {
                texts.push(text);
            }
        }
    }

    // 画像抽出
    const images = [];
    const imgPattern = /<img[^>]+>/gi;
    let imgMatch;
    while ((imgMatch = imgPattern.exec(html)) !== null) {
        const imgTag = imgMatch[0];

        // src属性を抽出（src, data-src, data-lazy-srcなど）
        const srcMatch = imgTag.match(/(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/i);
        const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
        const widthMatch = imgTag.match(/width=["']?(\d+)/i);
        const heightMatch = imgTag.match(/height=["']?(\d+)/i);

        if (srcMatch && srcMatch[1] && !srcMatch[1].startsWith('data:')) {
            try {
                const absoluteUrl = new URL(srcMatch[1], url).href;
                images.push({
                    src: absoluteUrl,
                    alt: altMatch ? decodeHtmlEntities(altMatch[1]) : '',
                    width: widthMatch ? parseInt(widthMatch[1]) : 0,
                    height: heightMatch ? parseInt(heightMatch[1]) : 0,
                    source: 'crawl'
                });
            } catch (e) {
                // URL変換失敗は無視
            }
        }
    }

    // background-image抽出
    const bgPattern = /background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
    let bgMatch;
    while ((bgMatch = bgPattern.exec(html)) !== null) {
        if (bgMatch[1] && !bgMatch[1].startsWith('data:')) {
            try {
                const absoluteUrl = new URL(bgMatch[1], url).href;
                images.push({
                    src: absoluteUrl,
                    alt: '',
                    width: 0,
                    height: 0,
                    source: 'crawl-bg'
                });
            } catch (e) {
                // URL変換失敗は無視
            }
        }
    }

    // 構造化データ抽出
    const structuredData = [];
    const jsonLdPattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonMatch;
    while ((jsonMatch = jsonLdPattern.exec(html)) !== null) {
        try {
            structuredData.push(JSON.parse(jsonMatch[1]));
        } catch (e) {
            // パースエラーは無視
        }
    }

    return {
        title,
        url,
        text: texts.join('\n'),
        images: images.slice(0, 20),
        structuredData,
        rawHtml: html.substring(0, 50000) // 長すぎる場合は切り詰め
    };
}

/**
 * HTMLタグを除去
 */
function stripHtmlTags(str) {
    return str.replace(/<[^>]*>/g, '');
}

/**
 * HTMLエンティティをデコード
 */
function decodeHtmlEntities(str) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' '
    };
    return str.replace(/&[^;]+;/g, match => entities[match] || match);
}

/**
 * 全ページのコンテンツを統合
 * @param {Object} mainContent - メインページのコンテンツ
 * @param {Array} crawledPages - クロールしたページの配列
 * @returns {Object} 統合されたコンテンツ
 */
export function mergeContents(mainContent, crawledPages) {
    const merged = {
        mainPage: mainContent,
        additionalPages: [],
        allText: mainContent.text ? mainContent.text.map(t => t.text).join('\n') : '',
        allImages: [...(mainContent.images || [])],
        sources: [{
            url: mainContent.url,
            title: mainContent.title,
            type: 'main'
        }]
    };

    for (const page of crawledPages) {
        if (!page.success) continue;

        merged.additionalPages.push({
            url: page.url,
            type: page.type,
            title: page.title,
            content: page.content
        });

        // テキストを追加
        if (page.content?.text) {
            merged.allText += `\n\n=== ${page.title} (${page.type}) ===\n${page.content.text}`;
        }

        // 画像を追加（重複除去）
        if (page.content?.images) {
            const existingUrls = new Set(merged.allImages.map(img => img.src));
            for (const img of page.content.images) {
                if (!existingUrls.has(img.src)) {
                    merged.allImages.push({
                        ...img,
                        sourcePage: page.type
                    });
                    existingUrls.add(img.src);
                }
            }
        }

        // ソース情報を追加
        merged.sources.push({
            url: page.url,
            title: page.title,
            type: page.type
        });
    }

    // 画像を上位のみに制限
    // 注: content.jsからの画像はwidth/heightが0の場合があるため、
    // サイズフィルターは適用せず、優先度でソートして上位を取得
    console.log(`mergeContents: マージ前画像数 ${merged.allImages.length}`);

    merged.allImages = merged.allImages
        .filter(img => {
            // 基本的なバリデーション: srcが存在し、有効なURLであること
            if (!img.src) return false;
            // 小さすぎるアイコン等を除外（サイズ情報がある場合のみ）
            if (img.width > 0 && img.height > 0 && img.width < 50 && img.height < 50) {
                return false;
            }
            return true;
        })
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 40);

    console.log(`mergeContents: マージ後画像数 ${merged.allImages.length}`);

    return merged;
}

/**
 * スリープ関数
 * @param {number} ms - ミリ秒
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
