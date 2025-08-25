document.addEventListener('DOMContentLoaded', async () => {
    const elements = {
        pageTitle: document.getElementById('page-title'),
        generateBtn: document.getElementById('generate-btn'),
        settingsBtn: document.getElementById('settings-btn'),
        progressArea: document.getElementById('progress-area'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        resultArea: document.getElementById('result-area'),
        slideLink: document.getElementById('slide-link'),
        errorArea: document.getElementById('error-area'),
        errorText: document.getElementById('error-text'),
        retryBtn: document.getElementById('retry-btn'),
        settingsModal: document.getElementById('settings-modal'),
        apiKeyInput: document.getElementById('api-key'),
        slideTemplateIdInput: document.getElementById('slide-template-id'),
        spreadsheetIdInput: document.getElementById('spreadsheet-id'),
        saveToSheetsCheckbox: document.getElementById('save-to-sheets'),
        userNameInput: document.getElementById('user-name'),
        teamSharingCheckbox: document.getElementById('team-sharing'),
        teamSettings: document.getElementById('team-settings'),
        masterDbSettings: document.getElementById('master-db-settings'),
        sharedFolderIdInput: document.getElementById('shared-folder-id'),
        masterSpreadsheetIdInput: document.getElementById('master-spreadsheet-id'),
        saveSettingsBtn: document.getElementById('save-settings'),
        cancelSettingsBtn: document.getElementById('cancel-settings'),
        testBtn: document.getElementById('test-button'),
        helpLink: document.getElementById('help-link'),
        feedbackLink: document.getElementById('feedback-link')
    };

    let currentTab = null;
    let settings = {
        apiKey: '',
        template: 'filming_location',
        slideTemplateId: '',
        spreadsheetId: '',
        saveToSheets: true,
        userName: '',
        teamSharing: false,
        sharedFolderId: '',
        masterSpreadsheetId: ''
    };

    async function init() {
        try {
            console.log('Initializing popup...');
            
            // Service Worker ステータス確認
            const swStatus = await chrome.storage.local.get(['serviceWorkerStatus', 'lastStartTime', 'error']);
            console.log('Service Worker Status:', swStatus);
            
            if (swStatus.serviceWorkerStatus === 'error') {
                console.error('Service Worker Error:', swStatus.error);
            }
            console.log('Elements found:', {
                settingsBtn: !!elements.settingsBtn,
                settingsModal: !!elements.settingsModal,
                generateBtn: !!elements.generateBtn,
                saveSettingsBtn: !!elements.saveSettingsBtn,
                testBtn: !!elements.testBtn,
                apiKeyInput: !!elements.apiKeyInput,
                userNameInput: !!elements.userNameInput,
                spreadsheetIdInput: !!elements.spreadsheetIdInput
            });
            
            // 要素が見つからない場合の詳細ログ
            if (!elements.saveSettingsBtn) {
                console.error('Save settings button not found! Looking for element with id "save-settings"');
                const btn = document.getElementById('save-settings');
                console.log('Direct getElementById result:', btn);
            }
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tab;
            elements.pageTitle.textContent = tab.title || 'タイトルなし';

            const stored = await chrome.storage.local.get([
                'spreadsheetId', 'saveToSheets', 'userName', 
                'teamSharing', 'sharedFolderId', 'masterSpreadsheetId'
            ]);
            // APIキーの取得（平文・暗号化両対応）
            const storedApiKey = await chrome.storage.local.get(['apiKey']);
            console.log('Stored API key found:', !!storedApiKey.apiKey);
            
            if (storedApiKey.apiKey) {
                // まず平文として扱う
                if (typeof storedApiKey.apiKey === 'string' && storedApiKey.apiKey.startsWith('sk-')) {
                    console.log('Plain text API key detected');
                    settings.apiKey = storedApiKey.apiKey;
                } else {
                    // 暗号化されている可能性がある場合
                    try {
                        const response = await chrome.runtime.sendMessage({
                            action: 'decryptApiKey',
                            encryptedKey: storedApiKey.apiKey
                        });
                        if (response.success) {
                            console.log('Encrypted API key decrypted successfully');
                            settings.apiKey = response.decryptedKey;
                        } else {
                            console.log('Decryption failed, trying as plain text');
                            settings.apiKey = storedApiKey.apiKey;
                        }
                    } catch (error) {
                        console.log('Legacy API key format detected');
                        settings.apiKey = storedApiKey.apiKey;
                    }
                }
            }
            if (stored.slideTemplateId) settings.slideTemplateId = stored.slideTemplateId;
            if (stored.spreadsheetId) settings.spreadsheetId = stored.spreadsheetId;
            if (stored.saveToSheets !== undefined) settings.saveToSheets = stored.saveToSheets;
            if (stored.userName) settings.userName = stored.userName;
            if (stored.teamSharing !== undefined) settings.teamSharing = stored.teamSharing;
            if (stored.sharedFolderId) settings.sharedFolderId = stored.sharedFolderId;
            if (stored.masterSpreadsheetId) settings.masterSpreadsheetId = stored.masterSpreadsheetId;

            elements.apiKeyInput.value = settings.apiKey ? '••••••••' : '';
            elements.slideTemplateIdInput.value = settings.slideTemplateId || '';
            elements.spreadsheetIdInput.value = settings.spreadsheetId || '';
            elements.saveToSheetsCheckbox.checked = settings.saveToSheets;
            elements.userNameInput.value = settings.userName || '';
            elements.teamSharingCheckbox.checked = settings.teamSharing;
            elements.sharedFolderIdInput.value = settings.sharedFolderId || '';
            elements.masterSpreadsheetIdInput.value = settings.masterSpreadsheetId || '';
            
            toggleTeamSharingSection();

            console.log('Final API key status:', !!settings.apiKey);
            console.log('API key starts with sk-:', settings.apiKey?.startsWith('sk-'));
            
            if (!settings.apiKey || settings.apiKey.length === 0) {
                console.log('No API key found - disabling generate button');
                elements.generateBtn.disabled = true;
                elements.generateBtn.textContent = '⚠️ API Key未設定';
            } else {
                console.log('API key found - enabling generate button');
                elements.generateBtn.disabled = false;
                elements.generateBtn.innerHTML = '<span class="btn-icon">📊</span>スライドを生成';
            }
        } catch (error) {
            console.error('初期化エラー:', error);
        }
    }

    function showProgress(text = '処理中...') {
        hideAllAreas();
        elements.progressArea.classList.remove('hidden');
        elements.progressText.textContent = text;
        elements.progressFill.style.width = '0%';
    }

    function updateProgress(percent, text) {
        elements.progressFill.style.width = `${percent}%`;
        if (text) elements.progressText.textContent = text;
    }

    function updateProcessingStage(stage) {
        const stages = {
            'extracting': { text: '1. ページコンテンツ抽出', percent: 20 },
            'analyzing': { text: '2. GPT-4解析', percent: 40 },
            'authenticating': { text: '3. Google認証', percent: 60 },
            'creating_slide': { text: '4. スライド生成', percent: 80 },
            'saving_spreadsheet': { text: '5. スプレッドシート保存', percent: 100 }
        };
        
        if (stages[stage]) {
            updateProgress(stages[stage].percent, stages[stage].text);
        }
    }

    function showResult(slideUrl) {
        hideAllAreas();
        elements.resultArea.classList.remove('hidden');
        elements.slideLink.href = slideUrl;
    }

    function showError(message) {
        hideAllAreas();
        elements.errorArea.classList.remove('hidden');
        elements.errorText.textContent = message;
    }

    function hideAllAreas() {
        elements.progressArea.classList.add('hidden');
        elements.resultArea.classList.add('hidden');
        elements.errorArea.classList.add('hidden');
    }

    function showSettings() {
        console.log('showSettings called');
        console.log('settingsModal element:', elements.settingsModal);
        if (elements.settingsModal) {
            elements.settingsModal.classList.remove('hidden');
            console.log('Modal classes after show:', elements.settingsModal.classList.toString());
        } else {
            console.error('Settings modal element not found!');
        }
    }

    function hideSettings() {
        elements.settingsModal.classList.add('hidden');
    }

    // 新しいシンプルな保存関数
    async function saveSettingsNew() {
        console.log('🔥 NEW SAVE FUNCTION CALLED');
        
        try {
            // 直接DOMから値を取得
            const apiKey = document.getElementById('api-key')?.value || '';
            const userName = document.getElementById('user-name')?.value || '';
            const spreadsheetId = document.getElementById('spreadsheet-id')?.value || '';
            
            console.log('Values from DOM:', { apiKey: apiKey.length > 0, userName, spreadsheetId });
            
            // 最小限の保存処理
            if (apiKey && apiKey.length > 0) {
                await chrome.storage.local.set({ 
                    apiKey: apiKey,
                    userName: userName,
                    spreadsheetId: spreadsheetId 
                });
                
                // settingsオブジェクトも更新
                settings.apiKey = apiKey;
                settings.userName = userName;
                settings.spreadsheetId = spreadsheetId;
                
                // 生成ボタンを有効化
                elements.generateBtn.disabled = false;
                elements.generateBtn.innerHTML = '<span class="btn-icon">📊</span>スライドを生成';
                
                console.log('✅ Settings saved successfully');
                alert('設定が保存されました！');
                hideSettings();
            } else {
                alert('APIキーを入力してください');
            }
        } catch (error) {
            console.error('❌ Save error:', error);
            alert('保存エラー: ' + error.message);
        }
    }

    async function saveSettings() {
        console.log('=== saveSettings function called ===');
        
        // 入力値の確認
        const apiKeyValue = elements.apiKeyInput?.value || '';
        const userNameValue = elements.userNameInput?.value || '';
        const spreadsheetIdValue = elements.spreadsheetIdInput?.value || '';
        
        console.log('Input values:', {
            apiKeyLength: apiKeyValue.length,
            userName: userNameValue,
            spreadsheetId: spreadsheetIdValue
        });
        
        try {
            console.log('API key value length:', apiKeyValue ? apiKeyValue.length : 0);
            
            if (apiKeyValue && !apiKeyValue.includes('•')) {
                settings.apiKey = apiKeyValue;
                console.log('Encrypting API key...');
                // APIキーの暗号化保存
                try {
                    const response = await chrome.runtime.sendMessage({
                        action: 'encryptApiKey',
                        apiKey: apiKeyValue
                    });
                    console.log('Encryption response:', response);
                    if (response.success) {
                        await chrome.storage.local.set({ apiKey: response.encryptedKey });
                        console.log('API key saved encrypted');
                    } else {
                        // フォールバック: 平文で保存
                        await chrome.storage.local.set({ apiKey: apiKeyValue });
                        console.log('API key saved as fallback');
                    }
                } catch (error) {
                    console.error('API key encryption failed:', error);
                    await chrome.storage.local.set({ apiKey: apiKeyValue });
                    console.log('API key saved after error');
                }
            }
        
            settings.slideTemplateId = elements.slideTemplateIdInput.value;
            settings.spreadsheetId = elements.spreadsheetIdInput.value;
            settings.saveToSheets = elements.saveToSheetsCheckbox.checked;
            settings.userName = elements.userNameInput.value;
            settings.teamSharing = elements.teamSharingCheckbox.checked;
            settings.sharedFolderId = elements.sharedFolderIdInput.value;
            settings.masterSpreadsheetId = elements.masterSpreadsheetIdInput.value;

            console.log('Saving other settings...');
            await chrome.storage.local.set({
                slideTemplateId: settings.slideTemplateId,
                spreadsheetId: settings.spreadsheetId,
                saveToSheets: settings.saveToSheets,
                userName: settings.userName,
                teamSharing: settings.teamSharing,
                sharedFolderId: settings.sharedFolderId,
                masterSpreadsheetId: settings.masterSpreadsheetId
            });
            console.log('Settings saved successfully');

            if (settings.apiKey) {
                elements.generateBtn.disabled = false;
                elements.generateBtn.innerHTML = '<span class="btn-icon">📊</span>スライドを生成';
            }

            hideSettings();
            console.log('Settings modal hidden');
        } catch (error) {
            console.error('Save settings error:', error);
            alert('設定の保存に失敗しました: ' + error.message);
        }
    }

    async function generateSlide() {
        if (!settings.apiKey) {
            showError('APIキーが設定されていません。設定画面から入力してください。');
            return;
        }

        try {
            showProgress('処理開始中...');
            updateProgress(10, '処理開始中...');

            console.log('Sending message to background script...');
            
            // バックグラウンドからの進捗をストレージ経由で監視
            const progressInterval = setInterval(async () => {
                try {
                    const result = await chrome.storage.local.get(['currentProcessingStage', 'lastUpdate']);
                    if (result.currentProcessingStage && result.lastUpdate && 
                        Date.now() - result.lastUpdate < 10000) { // 10秒以内の更新のみ有効
                        updateProcessingStage(result.currentProcessingStage);
                    }
                } catch (error) {
                    console.log('進捗監視エラー:', error);
                }
            }, 500); // 500msごとにチェック
            
            let response;
            try {
                response = await Promise.race([
                    chrome.runtime.sendMessage({
                        action: 'generateSlide',
                        tabId: currentTab.id,
                        url: currentTab.url,
                        title: currentTab.title,
                        settings: settings
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('処理がタイムアウトしました（30秒）')), 30000)
                    )
                ]);
                
                console.log('Response received:', response);
            } finally {
                // インターバルをクリア
                clearInterval(progressInterval);
            }
            
            if (response.success) {
                if (response.needsSetup) {
                    // セットアップが必要な場合
                    updateProgress(80, 'Google OAuth設定が必要です');
                    setTimeout(() => {
                        showError('Google OAuth設定が必要です。\n\n1. Google Cloud Consoleでプロジェクト作成\n2. OAuth 2.0クライアントID取得\n3. manifest.jsonのclient_id更新\n\nGPT解析は完了しました（コンソール確認）');
                        
                        if (response.locationData) {
                            console.log('🤖 取得された場所情報:', response.locationData);
                        }
                    }, 500);
                } else {
                    updateProgress(100, '完了！');
                    setTimeout(() => {
                        showResult(response.slideUrl);
                        
                        // 保存結果の表示
                        let statusText = '';
                        if (response.teamSharing && response.masterSaved) {
                            statusText = 'チーム共有DBに保存されました';
                        } else if (response.teamSharing && !response.masterSaved) {
                            statusText = 'チーム共有DB: 重複のためスキップ';
                        }
                        if (response.spreadsheetSaved) {
                            statusText += statusText ? ' / 個人DBにも保存' : '個人DBに保存されました';
                        }
                        if (statusText) {
                            elements.progressText.textContent = statusText;
                        }
                    }, 500);
                }
            } else {
                throw new Error(response.error || '不明なエラーが発生しました');
            }
        } catch (error) {
            console.error('スライド生成エラー:', error);
            clearInterval(progressInterval); // エラー時にもインターバルをクリア
            showError(error.message);
        }
    }

    // イベントリスナーの追加
    console.log('Adding event listeners...');
    
    elements.generateBtn.addEventListener('click', generateSlide);
    elements.settingsBtn.addEventListener('click', (e) => {
        console.log('Settings button clicked');
        e.preventDefault();
        showSettings();
    });
    elements.retryBtn.addEventListener('click', generateSlide);
    
    // 保存ボタンのイベントリスナー追加を確認
    if (elements.saveSettingsBtn) {
        console.log('Adding event listener to save settings button');
        elements.saveSettingsBtn.addEventListener('click', (e) => {
            console.log('Save settings button clicked - calling NEW function');
            e.preventDefault();
            e.stopPropagation();
            saveSettingsNew();  // 新しい関数を呼び出し
        });
    } else {
        console.error('Cannot add event listener - save settings button not found');
    }
    
    if (elements.cancelSettingsBtn) {
        elements.cancelSettingsBtn.addEventListener('click', hideSettings);
    } else {
        console.error('Cancel settings button not found');
    }
    
    // テストボタンの追加
    if (elements.testBtn) {
        console.log('Adding event listener to test button');
        elements.testBtn.addEventListener('click', (e) => {
            console.log('🧪 TEST BUTTON CLICKED - This proves button clicks work!');
            alert('テストボタンが動作しました！\nConsoleログを確認してください。');
            e.preventDefault();
            e.stopPropagation();
        });
    } else {
        console.error('Test button not found');
    }
    
    elements.helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/yourusername/location-scout-extension/wiki' });
    });
    
    elements.feedbackLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/yourusername/location-scout-extension/issues' });
    });

    if (elements.settingsModal) {
        elements.settingsModal.addEventListener('click', (e) => {
            // モーダルの背景をクリックした場合のみ閉じる（ボタンクリックは除外）
            if (e.target === elements.settingsModal) {
                console.log('Modal background clicked - hiding settings');
                hideSettings();
            }
        });
    }

    function toggleTeamSharingSection() {
        if (elements.teamSharingCheckbox.checked) {
            elements.teamSettings.style.display = 'block';
            elements.masterDbSettings.style.display = 'block';
        } else {
            elements.teamSettings.style.display = 'none';
            elements.masterDbSettings.style.display = 'none';
        }
    }

    elements.teamSharingCheckbox.addEventListener('change', toggleTeamSharingSection);

    // DOM要素の再取得を試行（遅延ロードの場合）
    setTimeout(() => {
        if (!elements.saveSettingsBtn) {
            console.log('Retrying to find save settings button...');
            elements.saveSettingsBtn = document.getElementById('save-settings');
            if (elements.saveSettingsBtn) {
                console.log('Save button found on retry - adding event listener');
                elements.saveSettingsBtn.addEventListener('click', (e) => {
                    console.log('Save settings button clicked (retry listener)');
                    e.preventDefault();
                    e.stopPropagation();
                    saveSettings();
                });
            }
        }
    }, 100);

    await init();
    
    // ポップアップ表示時に毎回APIキーをチェック
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            console.log('Popup became visible - rechecking API key');
            const storedApiKey = await chrome.storage.local.get(['apiKey']);
            if (storedApiKey.apiKey && storedApiKey.apiKey.startsWith('sk-')) {
                settings.apiKey = storedApiKey.apiKey;
                elements.generateBtn.disabled = false;
                elements.generateBtn.innerHTML = '<span class="btn-icon">📊</span>スライドを生成';
                console.log('API key re-loaded and generate button enabled');
            }
        }
    });
});