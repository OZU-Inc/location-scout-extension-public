/**
 * Service Worker 簡易テスト版
 * モジュールインポートエラーの場合、このファイルで動作確認してください
 * manifest.json の service_worker を "background/background_simple.js" に変更して使用
 */

// Service Worker起動確認
console.log('🔥 Service Worker (Simple Version) Starting...');
console.log('Location Scout Extension - Simple Background Service Worker Activated');

// 拡張機能インストール/更新時のイベント
chrome.runtime.onInstalled.addListener((details) => {
    console.log('🎉 Location Scout Extension installed/updated (Simple Version)');
    console.log('Installation reason:', details.reason);
    console.log('Version:', chrome.runtime.getManifest().version);
    
    // 初期設定
    chrome.storage.local.set({ 
        serviceWorkerStatus: 'active',
        installedAt: new Date().toISOString(),
        version: 'simple'
    });
});

// メッセージリスナー（基本的な応答のみ）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Message received:', request.action);
    
    if (request.action === 'testConnection') {
        sendResponse({ 
            success: true, 
            message: 'Service Worker is running!',
            timestamp: new Date().toISOString()
        });
        return true;
    }
    
    if (request.action === 'generateSlide') {
        sendResponse({ 
            success: false, 
            error: 'Simple version - Full functionality not available. Please check module imports in background.js'
        });
        return true;
    }
    
    sendResponse({ 
        success: false, 
        error: 'Unknown action: ' + request.action 
    });
    return true;
});

// アイコンクリック時のテスト（ポップアップがない場合）
chrome.action.onClicked.addListener((tab) => {
    console.log('🖱️ Extension icon clicked on tab:', tab.url);
});

// Service Worker の起動完了を確認
console.log('🚀 Simple Service Worker fully loaded and ready');
console.log('Extension ID:', chrome.runtime.id);
console.log('To switch to full version: Change manifest.json service_worker to "background/background.js"');