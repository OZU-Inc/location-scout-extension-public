const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function createDistributionZip() {
    console.log('🚀 Creating distribution zip for Chrome Extension...');
    
    // 配布用フォルダを作成
    const distDir = './dist';
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true });
    }
    fs.mkdirSync(distDir, { recursive: true });
    
    // Chrome拡張機能に必要なファイルをコピー
    const extensionFiles = [
        'chrome-extension/manifest.json',
        'chrome-extension/popup/popup.html',
        'chrome-extension/popup/popup.css', 
        'chrome-extension/popup/popup.js',
        'chrome-extension/content/content.js',
        'chrome-extension/background/background.js',
        'chrome-extension/background/gptAnalyzer.js',
        'chrome-extension/background/slideGenerator_custom.js',
        'chrome-extension/background/sheetsManager.js',
        'chrome-extension/background/auth.js',
        'chrome-extension/background/encryption.js',
        'chrome-extension/icons/icon.svg',
        'chrome-extension/templates/custom-template.json'
    ];
    
    // アイコンファイルを生成（SVGから簡易PNG代替）
    const iconSizes = [16, 48, 128];
    iconSizes.forEach(size => {
        const iconContent = `iVBORw0KGgoAAAANSUhEUgAAABAAAAA${size === 16 ? 'Q' : size === 48 ? 'w' : 'g'}AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuMjHxIGmVAAAAxklEQVQ4T2NkYGBgYBhYwP///xlGAyB48P///2gAxABGEJvR/z8Q/4ckD9EHchHIDyAFIAVA${size === 16 ? 'Q' : 'w'}AAAAAXNSR0IArs4c6Q==`;
        fs.writeFileSync(`chrome-extension/icons/icon${size}.png`, iconContent, 'base64');
    });
    
    console.log('📁 Copying extension files...');
    
    // ファイルをdistフォルダにコピー
    extensionFiles.forEach(file => {
        const srcPath = file;
        const destPath = path.join(distDir, file.replace('chrome-extension/', ''));
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`✅ Copied: ${file}`);
        } else {
            console.log(`⚠️  Missing: ${file}`);
        }
    });
    
    // アイコンファイルもコピー
    iconSizes.forEach(size => {
        const iconFile = `chrome-extension/icons/icon${size}.png`;
        if (fs.existsSync(iconFile)) {
            fs.copyFileSync(iconFile, `${distDir}/icons/icon${size}.png`);
            console.log(`✅ Copied: icons/icon${size}.png`);
        }
    });
    
    // ドキュメントをコピー
    const docs = [
        { src: 'docs/SETUP_GUIDE.md', dest: 'SETUP_GUIDE.md' },
        { src: 'README.md', dest: 'README.md' }
    ];
    
    docs.forEach(doc => {
        if (fs.existsSync(doc.src)) {
            fs.copyFileSync(doc.src, path.join(distDir, doc.dest));
            console.log(`✅ Copied: ${doc.dest}`);
        }
    });
    
    // manifest.jsonの検証と警告
    const manifestPath = path.join(distDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        if (manifest.oauth2.client_id.includes('YOUR_')) {
            console.log('⚠️  WARNING: Google OAuth client_id needs to be configured!');
        }
    }
    
    // Zipファイルを作成
    console.log('📦 Creating zip file...');
    
    const output = fs.createWriteStream('./location-scout-extension-v1.0.0.zip');
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });
    
    return new Promise((resolve, reject) => {
        output.on('close', () => {
            console.log(`✨ Distribution created: location-scout-extension-v1.0.0.zip (${archive.pointer()} bytes)`);
            console.log('');
            console.log('📋 Installation Instructions:');
            console.log('1. Extract the zip file');
            console.log('2. Open Chrome → chrome://extensions/');
            console.log('3. Enable "Developer mode"');
            console.log('4. Click "Load unpacked" and select the extracted folder');
            console.log('5. Configure Google OAuth client_id in manifest.json');
            console.log('6. Add OpenAI API key in extension settings');
            console.log('');
            console.log('📖 See SETUP_GUIDE.md for detailed instructions');
            
            // クリーンアップ
            fs.rmSync(distDir, { recursive: true });
            resolve();
        });
        
        archive.on('error', reject);
        archive.pipe(output);
        
        // distフォルダの内容をzipに追加（ルートレベルに）
        archive.directory(distDir, false);
        archive.finalize();
    });
}

// スクリプト実行
if (require.main === module) {
    createDistributionZip().catch(console.error);
}

module.exports = { createDistributionZip };