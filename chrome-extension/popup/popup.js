import { SecureStorage } from '../background/encryption.js';

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
        templateSelect: document.getElementById('template-select'),
        templateUrlInput: document.getElementById('template-url'),
        templateUrlSection: document.getElementById('template-url-section'),
        spreadsheetIdInput: document.getElementById('spreadsheet-id'),
        autoImagesCheckbox: document.getElementById('auto-images'),
        saveToSheetsCheckbox: document.getElementById('save-to-sheets'),
        saveSettingsBtn: document.getElementById('save-settings'),
        cancelSettingsBtn: document.getElementById('cancel-settings'),
        helpLink: document.getElementById('help-link'),
        feedbackLink: document.getElementById('feedback-link')
    };

    let currentTab = null;
    let settings = {
        apiKey: '',
        template: 'filming_location',
        templateUrl: '',
        spreadsheetId: '',
        autoImages: true,
        saveToSheets: true
    };

    async function init() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tab;
            elements.pageTitle.textContent = tab.title || 'タイトルなし';

            const stored = await chrome.storage.local.get([
                'template', 'templateUrl', 'spreadsheetId', 
                'autoImages', 'saveToSheets'
            ]);
            const apiKey = await SecureStorage.secureGet('apiKey');
            if (apiKey) settings.apiKey = apiKey;
            if (stored.template) settings.template = stored.template;
            if (stored.templateUrl) settings.templateUrl = stored.templateUrl;
            if (stored.spreadsheetId) settings.spreadsheetId = stored.spreadsheetId;
            if (stored.autoImages !== undefined) settings.autoImages = stored.autoImages;
            if (stored.saveToSheets !== undefined) settings.saveToSheets = stored.saveToSheets;

            elements.apiKeyInput.value = settings.apiKey ? '••••••••' : '';
            elements.templateSelect.value = settings.template;
            elements.templateUrlInput.value = settings.templateUrl || '';
            elements.spreadsheetIdInput.value = settings.spreadsheetId || '';
            elements.autoImagesCheckbox.checked = settings.autoImages;
            elements.saveToSheetsCheckbox.checked = settings.saveToSheets;
            
            toggleTemplateUrlSection();

            if (!settings.apiKey) {
                elements.generateBtn.disabled = true;
                elements.generateBtn.textContent = '⚠️ API Key未設定';
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
        elements.settingsModal.classList.remove('hidden');
    }

    function hideSettings() {
        elements.settingsModal.classList.add('hidden');
    }

    async function saveSettings() {
        const apiKeyValue = elements.apiKeyInput.value;
        if (apiKeyValue && !apiKeyValue.includes('•')) {
            settings.apiKey = apiKeyValue;
            await SecureStorage.secureStore('apiKey', apiKeyValue);
        }
        
        settings.template = elements.templateSelect.value;
        settings.templateUrl = elements.templateUrlInput.value;
        settings.spreadsheetId = elements.spreadsheetIdInput.value;
        settings.autoImages = elements.autoImagesCheckbox.checked;
        settings.saveToSheets = elements.saveToSheetsCheckbox.checked;

        await chrome.storage.local.set({
            template: settings.template,
            templateUrl: settings.templateUrl,
            spreadsheetId: settings.spreadsheetId,
            autoImages: settings.autoImages,
            saveToSheets: settings.saveToSheets
        });

        if (settings.apiKey) {
            elements.generateBtn.disabled = false;
            elements.generateBtn.innerHTML = '<span class="btn-icon">📊</span>スライドを生成';
        }

        hideSettings();
    }

    async function generateSlide() {
        if (!settings.apiKey) {
            showError('APIキーが設定されていません。設定画面から入力してください。');
            return;
        }

        try {
            showProgress('ページ情報を取得中...');
            updateProgress(20, 'ページ情報を取得中...');

            const response = await chrome.runtime.sendMessage({
                action: 'generateSlide',
                tabId: currentTab.id,
                url: currentTab.url,
                title: currentTab.title,
                settings: settings
            });

            if (response.success) {
                updateProgress(100, '完了！');
                setTimeout(() => {
                    showResult(response.slideUrl);
                    if (response.spreadsheetSaved) {
                        elements.progressText.textContent = 'スプレッドシートにも保存されました';
                    }
                }, 500);
            } else {
                throw new Error(response.error || '不明なエラーが発生しました');
            }
        } catch (error) {
            console.error('スライド生成エラー:', error);
            showError(error.message);
        }
    }

    elements.generateBtn.addEventListener('click', generateSlide);
    elements.settingsBtn.addEventListener('click', showSettings);
    elements.retryBtn.addEventListener('click', generateSlide);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.cancelSettingsBtn.addEventListener('click', hideSettings);
    
    elements.helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/yourusername/location-scout-extension/wiki' });
    });
    
    elements.feedbackLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/yourusername/location-scout-extension/issues' });
    });

    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            hideSettings();
        }
    });

    function toggleTemplateUrlSection() {
        if (elements.templateSelect.value === 'custom') {
            elements.templateUrlSection.style.display = 'block';
        } else {
            elements.templateUrlSection.style.display = 'none';
        }
    }

    elements.templateSelect.addEventListener('change', toggleTemplateUrlSection);

    await init();
});