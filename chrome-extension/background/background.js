/**
 * Location Scout v2 - バックグラウンドスクリプト
 * メイン処理統括、各モジュールの連携制御
 *
 * 処理フロー:
 * 1. ページコンテンツ抽出
 * 2. 関連ページクロール
 * 3. 画像ダウンロード・分類
 * 4. GPT解析
 * 5. フォルダ作成・ファイル保存
 * 6. スライド生成
 * 7. スプレッドシート保存
 */

// モジュールインポート
import { getAuthToken, isAuthenticated, refreshToken } from './auth.js';
import { createLocationFolder, saveImages, listFolders } from './driveManager.js';
import { crawlRelatedPages, mergeContents } from './crawler.js';
import { analyzeLocationData, classifyImages } from './gptAnalyzer.js';
import { createSlide } from './slideGenerator.js';
import { saveToSpreadsheet } from './sheetsManager.js';

console.log('Location Scout v2 - Service Worker Starting...');

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request.action);

    switch (request.action) {
        case 'startCollection':
            handleStartCollection(request, sendResponse);
            return true;
        case 'authenticate':
            handleAuthenticate(sendResponse);
            return true;
        case 'selectFolder':
            handleSelectFolder(sendResponse);
            return true;
    }
    return false;
});

/**
 * 情報収集メイン処理
 */
async function handleStartCollection(request, sendResponse) {
    const errors = [];
    const result = {
        success: false,
        folderUrl: null,
        slideUrl: null,
        spreadsheetUrl: null,
        errors: [],
        summary: ''
    };

    console.log('=== handleStartCollection START ===');
    console.log('Request:', JSON.stringify(request, null, 2));

    try {
        const { tabId, settings } = request;

        if (!tabId) {
            throw new Error('tabIdが指定されていません');
        }

        if (!settings) {
            throw new Error('settingsが指定されていません');
        }

        console.log('TabId:', tabId);
        console.log('Settings:', JSON.stringify({
            hasApiKey: !!settings.apiKey,
            parentFolderId: settings.parentFolderId,
            enableCrawl: settings.enableCrawl,
            saveImages: settings.saveImages
        }, null, 2));

        // Step 1: ページコンテンツ抽出
        await updateProgress('extracting', 10, 'ページ情報を抽出中...');

        let mainContent;
        try {
            mainContent = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
            if (!mainContent || mainContent.error) {
                throw new Error(mainContent?.error || 'コンテンツ抽出失敗');
            }
        } catch (e) {
            // content scriptを注入して再試行
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content/content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 200));
            mainContent = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        }

        console.log('Main content extracted:', mainContent.title);
        console.log('抽出された画像数:', mainContent.images?.length || 0);
        if (mainContent.images?.length > 0) {
            console.log('画像サンプル:', mainContent.images.slice(0, 3).map(img => ({
                src: img.src?.substring(0, 60),
                source: img.source
            })));
        }

        // Step 2: 関連ページクロール
        let mergedContent = { mainPage: mainContent, allImages: mainContent.images || [] };
        console.log('初期allImages数:', mergedContent.allImages.length);

        if (settings.enableCrawl && mainContent.links?.length > 0) {
            await updateProgress('crawling', 20, '関連ページをクロール中...');

            try {
                const crawledPages = await crawlRelatedPages(
                    tabId,
                    mainContent.links,
                    (detail) => updateProgress('crawling', 25, detail)
                );
                mergedContent = mergeContents(mainContent, crawledPages);
                console.log(`Crawled ${crawledPages.length} additional pages`);
                console.log('マージ後allImages数:', mergedContent.allImages?.length || 0);
            } catch (e) {
                console.error('Crawl error:', e);
                errors.push(`関連ページクロール失敗: ${e.message}`);
            }
        }

        // Step 3: 画像ダウンロード・分類
        await updateProgress('downloading_images', 40, '画像をダウンロード中...');

        let classifiedImages = [];
        const maxImages = settings.maxImages || 40;

        console.log('画像処理チェック:', {
            saveImages: settings.saveImages,
            allImagesCount: mergedContent.allImages?.length || 0,
            maxImages: maxImages
        });

        if (settings.saveImages && mergedContent.allImages?.length > 0) {
            try {
                const imagesToProcess = mergedContent.allImages.slice(0, maxImages);
                console.log(`処理対象画像: ${imagesToProcess.length}枚`);

                // Content Scriptから画像をBase64でダウンロード
                const imageUrls = imagesToProcess.map(img => img.src);
                console.log('画像URL:', imageUrls);

                const downloadResult = await chrome.tabs.sendMessage(tabId, {
                    action: 'downloadImages',
                    urls: imageUrls
                });

                console.log('画像ダウンロード結果:', downloadResult);

                if (downloadResult?.results) {
                    // ダウンロード成功した画像を分類
                    const downloadedImages = [];
                    for (let i = 0; i < downloadResult.results.length; i++) {
                        const result = downloadResult.results[i];
                        if (result.success) {
                            downloadedImages.push({
                                src: result.url,
                                base64: result.base64,
                                ...imagesToProcess[i]
                            });
                        } else {
                            console.warn(`画像 ${i + 1} ダウンロード失敗:`, result.error);
                        }
                    }

                    console.log(`ダウンロード成功: ${downloadedImages.length}枚`);

                    // 画像分類・フィルタリング（GPT-4o-mini Vision）
                    // classifyImagesがAIでValid/Invalid判定し、Valid画像のみを返す
                    if (downloadedImages.length > 0) {
                        await updateProgress('downloading_images', 50, 'AIで画像を選別中...');
                        classifiedImages = await classifyImages(downloadedImages, settings.apiKey);
                        console.log(`AI選別完了: ${classifiedImages.length}枚が保存対象`);
                    }
                }
            } catch (e) {
                console.error('Image processing error:', e);
                errors.push(`画像処理失敗: ${e.message}`);
            }
        }

        // Step 4: GPT解析
        await updateProgress('analyzing', 60, 'AIで情報を解析中...');

        let locationData;
        try {
            locationData = await analyzeLocationData(mergedContent, settings.apiKey);
            console.log('Location data analyzed:', locationData.locationName);
        } catch (e) {
            console.error('GPT analysis error:', e);
            throw new Error(`GPT解析失敗: ${e.message}`);
        }

        // Step 5: Google認証
        await updateProgress('creating_folder', 70, 'Google認証中...');

        let authToken;
        try {
            authToken = await getAuthToken();
        } catch (e) {
            throw new Error(`Google認証失敗: ${e.message}`);
        }

        // Step 6: フォルダ作成
        await updateProgress('creating_folder', 72, 'フォルダを作成中...');

        let folderInfo;
        try {
            folderInfo = await createLocationFolder(
                locationData.locationName,
                settings.parentFolderId,
                authToken
            );
            result.folderUrl = folderInfo.folderUrl;
            console.log('Folder created:', folderInfo.folderId);
        } catch (e) {
            console.error('Folder creation error:', e);
            errors.push(`フォルダ作成失敗: ${e.message}`);
        }

        // Step 7: 画像保存
        let savedImages = [];
        if (settings.saveImages && classifiedImages.length > 0 && folderInfo?.imagesFolderId) {
            await updateProgress('saving_images', 75, '画像を保存中...');

            try {
                const imageResult = await saveImages(
                    classifiedImages,
                    locationData.locationName,
                    folderInfo.imagesFolderId,
                    authToken,
                    (detail) => updateProgress('saving_images', 75, detail)
                );

                savedImages = imageResult.saved || [];

                if (imageResult.errors.length > 0) {
                    for (const err of imageResult.errors) {
                        errors.push(`画像保存失敗 (${err.index + 1}): ${err.error}`);
                    }
                }
                console.log(`Saved ${savedImages.length} images`);
            } catch (e) {
                console.error('Image save error:', e);
                errors.push(`画像保存失敗: ${e.message}`);
            }
        }

        // Step 8: スライド生成
        await updateProgress('creating_slide', 85, 'スライドを作成中...');

        try {
            const slideUrl = await createSlide(locationData, savedImages, authToken, {
                slideMode: settings.slideMode,
                masterSlideId: settings.masterSlideId
            });
            result.slideUrl = slideUrl;
            console.log('Slide created:', slideUrl);
        } catch (e) {
            console.error('Slide creation error (1st attempt):', e);

            // 認証エラーの可能性があるので、トークンをリフレッシュして再試行
            console.log('トークンをリフレッシュして再試行...');
            try {
                const newToken = await refreshToken();
                const slideUrl = await createSlide(locationData, savedImages, newToken, {
                    slideMode: settings.slideMode,
                    masterSlideId: settings.masterSlideId
                });
                result.slideUrl = slideUrl;
                console.log('Slide created (retry success):', slideUrl);
            } catch (retryError) {
                console.error('Slide creation error (retry failed):', retryError);
                errors.push(`スライド生成失敗: ${retryError.message}`);
            }
        }

        // Step 10: スプレッドシート保存
        if (settings.saveToSheets && settings.spreadsheetId) {
            await updateProgress('saving_spreadsheet', 95, 'スプレッドシートに保存中...');

            try {
                const sheetResult = await saveToSpreadsheet(
                    locationData,
                    {
                        slideUrl: result.slideUrl,
                        folderUrl: result.folderUrl
                    },
                    settings.spreadsheetId,
                    authToken
                );
                result.spreadsheetUrl = sheetResult.spreadsheetUrl;
                console.log('Spreadsheet saved');
            } catch (e) {
                console.error('Spreadsheet save error:', e);
                errors.push(`スプレッドシート保存失敗: ${e.message}`);
            }
        }

        // 完了
        await updateProgress('completed', 100, '完了しました!');

        result.success = true;
        result.errors = errors;
        result.summary = `${locationData.locationName}の情報を収集しました`;

        sendResponse(result);

    } catch (error) {
        console.error('=== Collection FATAL ERROR ===');
        console.error('Error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Collected errors so far:', errors);

        await updateProgress('error', 0, error.message);

        result.success = false;
        result.error = error.message;  // メインエラーメッセージを設定
        result.errors = [...errors, error.message];

        console.log('Sending error response:', result);
        sendResponse(result);
    }

    console.log('=== handleStartCollection END ===');
}

/**
 * 認証処理
 */
async function handleAuthenticate(sendResponse) {
    try {
        const token = await getAuthToken(true);
        sendResponse({ success: !!token });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * フォルダ選択
 */
async function handleSelectFolder(sendResponse) {
    try {
        const token = await getAuthToken(true);
        const folders = await listFolders(token);
        sendResponse({ success: true, folders });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}

/**
 * 進捗更新
 */
async function updateProgress(stage, percent, detail = '') {
    await chrome.storage.local.set({
        currentProcessingStage: stage,
        progressPercent: percent,
        progressDetail: detail,
        lastUpdate: Date.now()
    });
    console.log(`Progress: ${stage} (${percent}%) - ${detail}`);
}

// インストール/更新時
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Location Scout v2 installed/updated:', details.reason);
    chrome.storage.local.set({
        serviceWorkerStatus: 'ready',
        installedAt: new Date().toISOString()
    });
});

console.log('Location Scout v2 - Service Worker Ready');
