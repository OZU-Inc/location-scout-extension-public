import { analyzeWithGPT } from './gptAnalyzer.js';
import { createGoogleSlide } from './slideGenerator.js';
import { createCustomFormatSlide } from './slideGenerator_custom.js';
import { saveToSpreadsheet, createSpreadsheetIfNotExists } from './sheetsManager.js';
import { getAuthToken } from './auth.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateSlide') {
        handleSlideGeneration(request, sendResponse);
        return true;
    }
});

async function handleSlideGeneration(request, sendResponse) {
    try {
        console.log('スライド生成開始:', request.url);
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const contentResponse = await chrome.tabs.sendMessage(tab.id, { 
            action: 'extractContent' 
        });
        
        console.log('ページコンテンツ抽出完了');
        
        const locationData = await analyzeWithGPT(
            contentResponse,
            request.settings.apiKey
        );
        
        console.log('GPT解析完了:', locationData);
        
        const authToken = await getAuthToken();
        
        let slideUrl;
        if (request.settings.template === 'filming_location') {
            slideUrl = await createCustomFormatSlide(locationData, authToken);
        } else {
            slideUrl = await createGoogleSlide(
                locationData,
                authToken,
                request.settings.template,
                request.settings.autoImages
            );
        }
        
        console.log('スライド生成完了:', slideUrl);
        
        if (request.settings.saveToSheets && request.settings.spreadsheetId) {
            try {
                await saveToSpreadsheet(
                    locationData,
                    slideUrl,
                    authToken,
                    request.settings.spreadsheetId
                );
                console.log('スプレッドシートへの保存完了');
            } catch (sheetError) {
                console.error('スプレッドシート保存エラー:', sheetError);
            }
        }
        
        sendResponse({ 
            success: true, 
            slideUrl: slideUrl,
            spreadsheetSaved: request.settings.saveToSheets
        });
        
    } catch (error) {
        console.error('スライド生成エラー:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Location Scout Extension installed');
});