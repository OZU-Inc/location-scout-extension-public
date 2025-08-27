/**
 * Location Scout Extension - バックグラウンドスクリプト
 * 役割: 拡張機能のメイン処理統括、各モジュールの連携制御
 * 
 * 処理フロー:
 * 1. ページコンテンツ抽出 → 2. GPT-4解析 → 3. Google認証 → 4. スライド生成 → 5. スプレッドシート保存
 */

// 静的インポート（Service Workerでは動的importは使用不可）
// インポートは最初に記述する必要がある
import { analyzeWithGPT } from './gptAnalyzer.js';
import { createCustomFormatSlide, createSlideFromTemplate } from './slideGenerator_custom.js';
import { saveToSpreadsheet, saveToMasterSpreadsheet, createSpreadsheetIfNotExists } from './sheetsManager.js';
import { getAuthToken } from './auth.js';
import { SecureStorage } from './encryption.js';

// Service Worker起動確認
console.log('🔥 Service Worker Starting...');
console.log('Location Scout Extension - Background Service Worker Activated');

// インポート完了確認
console.log('✅ All modules imported successfully');

// Service Worker の起動を記録
chrome.storage.local.set({ 
    serviceWorkerStatus: 'ready',
    lastStartTime: new Date().toISOString(),
    moduleLoadTime: new Date().toISOString()
}).catch(error => {
    console.error('Storage error:', error);
});

/**
 * ポップアップUIからのメッセージ受信・処理振り分け
 * アクション別に対応する処理関数を呼び出し
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Message received:', request.action);
    
    if (request.action === 'generateSlide') {
        handleSlideGeneration(request, sendResponse);    // メイン処理: スライド生成
        return true;  // 非同期レスポンス有効化
    } else if (request.action === 'selectFolder') {
        handleFolderSelection(sendResponse);            // フォルダ選択
        return true;
    } else if (request.action === 'selectMasterSlide') {
        handleMasterSlideSelection(sendResponse);       // マスタースライド選択
        return true;
    } else if (request.action === 'encryptApiKey') {
        handleEncryptApiKey(request, sendResponse);      // APIキー暗号化
        return true;
    } else if (request.action === 'decryptApiKey') {
        handleDecryptApiKey(request, sendResponse);      // APIキー復号化
        return true;
    }
    return false;
});

/**
 * スライド生成メイン処理関数
 * 全体の処理フローを統括し、エラーハンドリングを実装
 * 
 * @param {Object} request - ポップアップUIからのリクエスト（URL、設定等）
 * @param {Function} sendResponse - 結果返却用コールバック関数
 */
async function handleSlideGeneration(request, sendResponse) {
    try {
        console.log('🚀 スライド生成開始:', request.url);
        
        // 進捗の初期化
        await chrome.storage.local.set({ 
            currentProcessingStage: 'starting',
            lastUpdate: Date.now() 
        });
        
        // Step 1: ページコンテンツ取得（content.js経由）
        console.log('📄 Step 1: ページコンテンツを取得中...');
        // ポップアップに進捗通知を送信
        await sendProgressUpdate('extracting');
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // タブが有効か確認
        if (!tab || !tab.id) {
            throw new Error('有効なタブが見つかりません');
        }
        
        console.log('対象タブ:', tab.url);
        
        // システムページ（chrome://、edge://等）をチェック
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
            tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
            throw new Error('このページからは情報を取得できません。通常のWebページで実行してください。');
        }
        
        // content scriptが読み込まれているか確認し、必要なら注入
        let contentResponse;
        try {
            // まずcontent scriptが存在するか確認
            contentResponse = await chrome.tabs.sendMessage(tab.id, { 
                action: 'extractContent' 
            });
        } catch (error) {
            console.log('Content script not loaded, injecting...');
            
            // content scriptが読み込まれていない場合は注入
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content/content.js']
                });
                console.log('Content script injected successfully');
                
                // 少し待ってから再試行
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 再度メッセージを送信
                contentResponse = await chrome.tabs.sendMessage(tab.id, { 
                    action: 'extractContent' 
                });
            } catch (injectError) {
                console.error('Content script injection failed:', injectError);
                // より詳細なエラーメッセージ
                if (injectError.message.includes('Cannot access')) {
                    throw new Error('このページへのアクセスが制限されています。通常のWebページで実行してください。');
                } else {
                    throw new Error('ページ情報の取得に失敗しました。ページを再読み込みしてから、もう一度お試しください。');
                }
            }
        }
        
        console.log('✅ ページコンテンツ抽出完了');
        console.log('📋 取得したコンテンツ:', contentResponse);
        
        // contentResponseの検証
        if (!contentResponse) {
            throw new Error('ページからコンテンツを取得できませんでした。ページを再読み込みしてください。');
        }
        
        // content scriptからのエラーをチェック
        if (contentResponse.error) {
            throw new Error('コンテンツ抽出エラー: ' + contentResponse.error);
        }
        
        // Step 2: GPT-4による情報解析（場所情報の構造化）
        console.log('🤖 Step 2: GPT APIで情報を解析中...');
        await sendProgressUpdate('analyzing');
        
        const locationData = await analyzeWithGPT(
            contentResponse,                    // 抽出したページコンテンツ
            request.settings.apiKey             // ユーザー設定のAPIキー
        );
        console.log('✅ GPT解析完了:', locationData);
        
        // GPT解析結果の検証
        if (!locationData) {
            throw new Error('GPT分析に失敗しました。APIキーを確認してください。');
        }
        
        console.log('🎯 GPT解析が正常に完了しました。次にGoogle認証を開始します...');
        
        // Step 3: Google認証（GPT解析完了後に実行）
        console.log('🔐 Step 3: Google認証を取得中...');
        await sendProgressUpdate('authenticating');
        
        let authToken;
        try {
            authToken = await getAuthToken();
            console.log('✅ Google認証完了');
        } catch (authError) {
            console.error('❌ Google認証エラー:', authError);
            console.log('💡 Google OAuth設定が必要です。manifest.jsonのclient_idを設定してください。');
            
            // 認証なしで続行を試行
            console.log('⚠️ 認証なしで処理を続行します（テスト用）');
            authToken = null;
        }
        
        // Step 4: スライド生成
        console.log('📊 Step 4: スライドを生成中...');
        await sendProgressUpdate('creating_slide');
        
        let slideUrl;
        
        if (!authToken) {
            console.log('⚠️ 認証トークンなし - スライド生成をスキップ');
            slideUrl = '#認証が必要です';
            
            // GPT結果をコンソールに出力（テスト用）
            console.log('🤖 GPT解析結果:', JSON.stringify(locationData, null, 2));
            
        } else {
            try {
                // スライド作成（マスタースライド蓄積モード対応）
                slideUrl = await createCustomFormatSlide(locationData, authToken, {
                    slideMode: request.settings.slideMode || 'new',
                    masterSlideId: request.settings.masterSlideId,
                    slideFolderId: request.settings.slideFolderId
                });
                console.log('✅ スライド生成完了:', slideUrl);
            } catch (slideError) {
                console.error('❌ スライド生成エラー:', slideError);
                slideUrl = '#スライド生成エラー';
            }
        }
        
        // Step 5: スプレッドシート保存
        await sendProgressUpdate('saving_spreadsheet');
        
        // チーム共有機能: マスタースプレッドシートに保存
        let masterSaved = false;
        if (request.settings.teamSharing && request.settings.masterSpreadsheetId) {
            try {
                const masterResult = await saveToMasterSpreadsheet(
                    locationData,
                    slideUrl,
                    authToken,
                    request.settings.masterSpreadsheetId,
                    request.settings.userName
                );
                console.log('マスタースプレッドシートへの保存完了:', masterResult);
                masterSaved = !masterResult.duplicate;
            } catch (masterError) {
                console.error('マスタースプレッドシート保存エラー:', masterError);
            }
        }
        
        // 個人用スプレッドシートに保存（オプション）
        if (request.settings.saveToSheets && request.settings.spreadsheetId) {
            try {
                await saveToSpreadsheet(
                    locationData,
                    slideUrl,
                    authToken,
                    request.settings.spreadsheetId
                );
                console.log('個人用スプレッドシートへの保存完了');
            } catch (sheetError) {
                console.error('個人用スプレッドシート保存エラー:', sheetError);
            }
        }
        
        sendResponse({ 
            success: true, 
            slideUrl: slideUrl,
            spreadsheetSaved: request.settings.saveToSheets,
            masterSaved: masterSaved,
            teamSharing: request.settings.teamSharing,
            needsSetup: !authToken,
            locationData: !authToken ? locationData : undefined
        });
        
    } catch (error) {
        console.error('❌ 全体エラー:', error);
        
        // エラー時は進捗をクリア
        await chrome.storage.local.set({ 
            currentProcessingStage: 'error',
            lastUpdate: Date.now() 
        });
        
        let errorMessage = error.message;
        
        if (error.message.includes('OAuth')) {
            errorMessage = 'Google OAuth設定が必要です。manifest.jsonのclient_idを設定してください。';
        } else if (error.message.includes('API key')) {
            errorMessage = 'OpenAI APIキーが無効です。設定を確認してください。';
        }
        
        sendResponse({ 
            success: false, 
            error: errorMessage,
            needsSetup: true
        });
    }
}

async function handleEncryptApiKey(request, sendResponse) {
    try {
        const encryptedKey = await SecureStorage.encrypt(request.apiKey);
        sendResponse({ success: true, encryptedKey: encryptedKey });
    } catch (error) {
        console.error('Encryption error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleDecryptApiKey(request, sendResponse) {
    try {
        const decryptedKey = await SecureStorage.decrypt(request.encryptedKey);
        sendResponse({ success: true, decryptedKey: decryptedKey });
    } catch (error) {
        console.error('Decryption error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 拡張機能インストール/更新時のイベント
chrome.runtime.onInstalled.addListener((details) => {
    console.log('🎉 Location Scout Extension installed/updated');
    console.log('Installation reason:', details.reason);
    console.log('Version:', chrome.runtime.getManifest().version);
    
    // Service Worker が正常に動作していることを示す
    chrome.storage.local.set({ 
        serviceWorkerStatus: 'active',
        installedAt: new Date().toISOString()
    });
});

// ポップアップに進捗更新を通知する関数
async function sendProgressUpdate(stage) {
    try {
        // ポップアップへの直接通知は制限されているため、storageを使用
        await chrome.storage.local.set({ 
            currentProcessingStage: stage,
            lastUpdate: Date.now() 
        });
        console.log(`進捗更新: ${stage}`);
    } catch (error) {
        console.log('進捗更新通知エラー:', error);
    }
}

/**
 * フォルダ選択処理
 * Google Drive APIを使用してフォルダ一覧を取得し、ユーザーが選択できるようにする
 */
async function handleFolderSelection(sendResponse) {
    try {
        console.log('📁 Starting folder selection...');
        
        // OAuth認証を取得
        const authToken = await getAuthToken();
        if (!authToken) {
            throw new Error('Google Drive認証が必要です');
        }
        
        // Drive APIでフォルダ一覧を取得
        const response = await fetch(
            'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.folder%27&fields=files(id%2Cname)&orderBy=name',
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Drive API error: ${response.status}`);
        }
        
        const data = await response.json();
        const folders = data.files || [];
        
        if (folders.length === 0) {
            throw new Error('フォルダが見つかりませんでした');
        }
        
        // 簡易選択：最初のフォルダを返す（実装では選択UIが必要）
        const selectedFolder = folders[0];
        
        sendResponse({
            success: true,
            folderId: selectedFolder.id,
            folderName: selectedFolder.name,
            availableFolders: folders
        });
        
    } catch (error) {
        console.error('Folder selection error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

/**
 * マスタースライド選択処理
 * Google Slides APIを使用してスライド一覧を取得し、ユーザーが選択できるようにする
 */
async function handleMasterSlideSelection(sendResponse) {
    try {
        console.log('📊 Starting master slide selection...');
        
        // OAuth認証を取得
        const authToken = await getAuthToken();
        if (!authToken) {
            throw new Error('Google Slides認証が必要です');
        }
        
        // Drive APIでGoogle Slidesファイル一覧を取得
        const response = await fetch(
            'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.presentation%27&fields=files(id%2Cname)&orderBy=modifiedTime%20desc',
            {
                headers: { 'Authorization': `Bearer ${authToken}` }
            }
        );
        
        if (!response.ok) {
            throw new Error(`Drive API error: ${response.status}`);
        }
        
        const data = await response.json();
        const slides = data.files || [];
        
        if (slides.length === 0) {
            throw new Error('Google Slidesファイルが見つかりませんでした');
        }
        
        // 簡易選択：最初のスライドを返す（実装では選択UIが必要）
        const selectedSlide = slides[0];
        
        sendResponse({
            success: true,
            slideId: selectedSlide.id,
            slideName: selectedSlide.name,
            availableSlides: slides
        });
        
    } catch (error) {
        console.error('Master slide selection error:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// Service Worker の起動を確認
console.log('🚀 Service Worker fully loaded and ready');
console.log('Extension ID:', chrome.runtime.id);