/**
 * Location Scout v2 - Popup Script
 * ポップアップUIの制御とバックグラウンドスクリプトとの通信
 */

// DOM要素
const elements = {
    // メイン画面
    mainView: document.getElementById('mainView'),
    settingsView: document.getElementById('settingsView'),
    currentUrl: document.getElementById('currentUrl'),
    enableCrawl: document.getElementById('enableCrawl'),
    saveImages: document.getElementById('saveImages'),
    startBtn: document.getElementById('startBtn'),
    settingsBtn: document.getElementById('settingsBtn'),

    // 進捗表示
    progressSection: document.getElementById('progressSection'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressDetail: document.getElementById('progressDetail'),

    // 結果表示
    resultSection: document.getElementById('resultSection'),
    resultContent: document.getElementById('resultContent'),
    errorList: document.getElementById('errorList'),
    errorItems: document.getElementById('errorItems'),

    // 設定画面
    backBtn: document.getElementById('backBtn'),
    apiKey: document.getElementById('apiKey'),
    parentFolderId: document.getElementById('parentFolderId'),
    selectFolderBtn: document.getElementById('selectFolderBtn'),
    spreadsheetId: document.getElementById('spreadsheetId'),
    saveToSheets: document.getElementById('saveToSheets'),
    slideMode: document.getElementById('slideMode'),
    masterSlideId: document.getElementById('masterSlideId'),
    masterSlideGroup: document.getElementById('masterSlideGroup'),
    authStatus: document.getElementById('authStatus'),
    authBtn: document.getElementById('authBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn')
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await updateCurrentUrl();
    setupEventListeners();
    startProgressPolling();
});

// 設定読み込み
async function loadSettings() {
    const settings = await chrome.storage.local.get([
        'apiKey',
        'parentFolderId',
        'spreadsheetId',
        'saveToSheets',
        'slideMode',
        'masterSlideId',
        'enableCrawl',
        'saveImages',
        'isAuthenticated'
    ]);

    if (settings.apiKey) elements.apiKey.value = settings.apiKey;
    if (settings.parentFolderId) elements.parentFolderId.value = settings.parentFolderId;
    if (settings.spreadsheetId) elements.spreadsheetId.value = settings.spreadsheetId;
    elements.saveToSheets.checked = settings.saveToSheets !== false;
    if (settings.slideMode) elements.slideMode.value = settings.slideMode;
    if (settings.masterSlideId) elements.masterSlideId.value = settings.masterSlideId;
    elements.enableCrawl.checked = settings.enableCrawl !== false;
    elements.saveImages.checked = settings.saveImages !== false;

    updateSlideModeVisibility();
    updateAuthStatus(settings.isAuthenticated);
}

// 現在のURL取得
async function updateCurrentUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            elements.currentUrl.textContent = tab.url;
        } else {
            elements.currentUrl.textContent = 'URLを取得できません';
        }
    } catch (error) {
        elements.currentUrl.textContent = 'エラー: ' + error.message;
    }
}

// イベントリスナー設定
function setupEventListeners() {
    // 設定画面切り替え
    elements.settingsBtn.addEventListener('click', () => {
        elements.mainView.classList.add('hidden');
        elements.settingsView.classList.remove('hidden');
    });

    elements.backBtn.addEventListener('click', () => {
        elements.settingsView.classList.add('hidden');
        elements.mainView.classList.remove('hidden');
    });

    // スライドモード切り替え
    elements.slideMode.addEventListener('change', updateSlideModeVisibility);

    // 認証ボタン
    elements.authBtn.addEventListener('click', handleAuth);

    // 設定保存
    elements.saveSettingsBtn.addEventListener('click', saveSettings);

    // 情報収集開始
    elements.startBtn.addEventListener('click', startCollection);

    // フォルダ選択
    elements.selectFolderBtn.addEventListener('click', selectFolder);
}

// スライドモード表示切り替え
function updateSlideModeVisibility() {
    if (elements.slideMode.value === 'append') {
        elements.masterSlideGroup.classList.remove('hidden');
    } else {
        elements.masterSlideGroup.classList.add('hidden');
    }
}

// 認証ステータス更新
function updateAuthStatus(isAuthenticated) {
    if (isAuthenticated) {
        elements.authStatus.textContent = '認証済み';
        elements.authStatus.classList.add('authenticated');
        elements.authBtn.textContent = '再認証';
    } else {
        elements.authStatus.textContent = '未認証';
        elements.authStatus.classList.remove('authenticated');
        elements.authBtn.textContent = 'Googleアカウントでログイン';
    }
}

// Google認証
async function handleAuth() {
    try {
        elements.authBtn.disabled = true;
        elements.authBtn.textContent = '認証中...';

        const response = await chrome.runtime.sendMessage({ action: 'authenticate' });

        if (response.success) {
            updateAuthStatus(true);
            await chrome.storage.local.set({ isAuthenticated: true });
        } else {
            throw new Error(response.error || '認証に失敗しました');
        }
    } catch (error) {
        alert('認証エラー: ' + error.message);
    } finally {
        elements.authBtn.disabled = false;
        updateAuthStatus(await chrome.storage.local.get('isAuthenticated').then(r => r.isAuthenticated));
    }
}

// 設定保存
async function saveSettings() {
    const settings = {
        apiKey: elements.apiKey.value,
        parentFolderId: elements.parentFolderId.value,
        spreadsheetId: elements.spreadsheetId.value,
        saveToSheets: elements.saveToSheets.checked,
        slideMode: elements.slideMode.value,
        masterSlideId: elements.masterSlideId.value
    };

    await chrome.storage.local.set(settings);

    // 保存完了通知
    elements.saveSettingsBtn.textContent = '保存しました!';
    setTimeout(() => {
        elements.saveSettingsBtn.textContent = '設定を保存';
    }, 1500);
}

// フォルダ選択
async function selectFolder() {
    try {
        elements.selectFolderBtn.disabled = true;
        elements.selectFolderBtn.textContent = '読み込み中...';

        const response = await chrome.runtime.sendMessage({ action: 'selectFolder' });

        if (response.success && response.folders) {
            // フォルダ選択ダイアログを表示（簡易版）
            const folderList = response.folders.map(f => `${f.name} (${f.id})`).join('\n');
            const selected = prompt(`フォルダを選択してください:\n\n${folderList}\n\nフォルダIDを入力:`);

            if (selected) {
                elements.parentFolderId.value = selected;
            }
        } else {
            throw new Error(response.error || 'フォルダの取得に失敗しました');
        }
    } catch (error) {
        alert('エラー: ' + error.message);
    } finally {
        elements.selectFolderBtn.disabled = false;
        elements.selectFolderBtn.textContent = 'フォルダを選択';
    }
}

// 情報収集開始
async function startCollection() {
    try {
        // UI更新
        elements.startBtn.disabled = true;
        elements.startBtn.innerHTML = '<div class="spinner"></div> 処理中...';
        elements.progressSection.classList.remove('hidden');
        elements.resultSection.classList.add('hidden');
        elements.errorList.classList.add('hidden');

        // 設定取得
        const settings = await chrome.storage.local.get([
            'apiKey',
            'parentFolderId',
            'spreadsheetId',
            'saveToSheets',
            'slideMode',
            'masterSlideId'
        ]);

        console.log('Settings loaded:', {
            hasApiKey: !!settings.apiKey,
            parentFolderId: settings.parentFolderId,
            spreadsheetId: settings.spreadsheetId
        });

        // バリデーション
        if (!settings.apiKey) {
            throw new Error('APIキーが設定されていません。設定画面でOpenAI APIキーを入力してください。');
        }

        if (!settings.parentFolderId) {
            throw new Error('保存先フォルダが設定されていません。設定画面でGoogle DriveのフォルダIDを入力してください。');
        }

        // 処理開始
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab || !tab.id) {
            throw new Error('アクティブなタブが見つかりません。');
        }

        console.log('Starting collection for:', tab.url);

        let response;
        try {
            response = await chrome.runtime.sendMessage({
                action: 'startCollection',
                url: tab.url,
                tabId: tab.id,
                settings: {
                    ...settings,
                    enableCrawl: elements.enableCrawl.checked,
                    saveImages: elements.saveImages.checked,
                    maxImages: 40  // 上位40枚まで保存
                }
            });
        } catch (sendError) {
            console.error('sendMessage error:', sendError);
            throw new Error(`バックグラウンド処理との通信エラー: ${sendError.message}`);
        }

        console.log('Response received:', response);

        if (!response) {
            throw new Error('バックグラウンドからの応答がありません。拡張機能を再読み込みしてください。');
        }

        if (response.success) {
            showResult(response);
        } else {
            // 詳細なエラー情報を構築
            let errorMsg = response.error || '不明なエラー';
            if (response.errors && response.errors.length > 0) {
                errorMsg += '\n\n詳細:\n' + response.errors.join('\n');
            }
            throw new Error(errorMsg);
        }

    } catch (error) {
        console.error('Collection error:', error);
        showError(error.message);
    } finally {
        elements.startBtn.disabled = false;
        elements.startBtn.innerHTML = `
            <span class="btn-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            </span>
            情報を収集
        `;
    }
}

// 進捗ポーリング
function startProgressPolling() {
    setInterval(async () => {
        const progress = await chrome.storage.local.get([
            'currentProcessingStage',
            'progressPercent',
            'progressDetail',
            'lastUpdate'
        ]);

        if (progress.currentProcessingStage && progress.lastUpdate) {
            // 10秒以上更新がなければ古いデータとみなす
            if (Date.now() - progress.lastUpdate < 10000) {
                updateProgress(progress);
            }
        }
    }, 500);
}

// 進捗更新
function updateProgress(progress) {
    const stageMessages = {
        'starting': { text: '処理を開始しています...', percent: 5 },
        'extracting': { text: 'ページ情報を抽出中...', percent: 10 },
        'crawling': { text: '関連ページをクロール中...', percent: 20 },
        'downloading_images': { text: '画像をダウンロード中...', percent: 40 },
        'analyzing': { text: 'AIで情報を解析中...', percent: 60 },
        'creating_folder': { text: 'フォルダを作成中...', percent: 70 },
        'saving_images': { text: '画像を保存中...', percent: 75 },
        'saving_document': { text: 'ドキュメントを保存中...', percent: 80 },
        'creating_slide': { text: 'スライドを作成中...', percent: 85 },
        'saving_spreadsheet': { text: 'スプレッドシートに保存中...', percent: 95 },
        'completed': { text: '完了しました!', percent: 100 },
        'error': { text: 'エラーが発生しました', percent: 0 }
    };

    const stage = stageMessages[progress.currentProcessingStage] || { text: '処理中...', percent: 0 };

    elements.progressFill.style.width = (progress.progressPercent || stage.percent) + '%';
    elements.progressText.textContent = stage.text;
    elements.progressDetail.textContent = progress.progressDetail || '';
}

// 結果表示
function showResult(response) {
    elements.progressSection.classList.add('hidden');
    elements.resultSection.classList.remove('hidden');

    let html = '<div class="result-links">';

    if (response.folderUrl) {
        html += `<p><a href="${response.folderUrl}" target="_blank">保存フォルダを開く</a></p>`;
    }
    if (response.slideUrl) {
        html += `<p><a href="${response.slideUrl}" target="_blank">スライドを開く</a></p>`;
    }
    if (response.spreadsheetUrl) {
        html += `<p><a href="${response.spreadsheetUrl}" target="_blank">スプレッドシートを開く</a></p>`;
    }

    html += '</div>';

    if (response.summary) {
        html += `<p class="summary">${response.summary}</p>`;
    }

    elements.resultContent.innerHTML = html;

    // エラー表示
    if (response.errors && response.errors.length > 0) {
        elements.errorList.classList.remove('hidden');
        elements.errorItems.innerHTML = response.errors.map(e => `<li>${e}</li>`).join('');
    }
}

// エラー表示
function showError(message) {
    elements.progressSection.classList.add('hidden');
    elements.resultSection.classList.remove('hidden');
    elements.resultSection.style.background = '#ffebee';
    elements.resultSection.querySelector('h3').textContent = 'エラー';
    elements.resultSection.querySelector('h3').style.color = '#c62828';

    // 改行を<br>に変換して詳細表示
    const formattedMessage = message.replace(/\n/g, '<br>');
    elements.resultContent.innerHTML = `
        <div style="color: #c62828; font-size: 13px; line-height: 1.6;">
            ${formattedMessage}
        </div>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ffcdd2; font-size: 11px; color: #666;">
            <p>デバッグ情報を確認するには:</p>
            <p>1. chrome://extensions を開く</p>
            <p>2. この拡張機能の「Service Worker」をクリック</p>
            <p>3. Consoleタブでエラー詳細を確認</p>
        </div>
    `;
}
