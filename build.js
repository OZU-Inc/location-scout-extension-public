const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function generateIcons() {
    console.log('Generating icons...');
    
    const sizes = [16, 48, 128];
    const svgContent = fs.readFileSync('./chrome-extension/icons/icon.svg', 'utf8');
    
    // SVGアイコンをコピー（実際のプロジェクトではSVGからPNGに変換）
    sizes.forEach(size => {
        const pngPath = `./chrome-extension/icons/icon${size}.png`;
        // 実際の実装では svg2png などを使用
        fs.writeFileSync(pngPath, `PNG_PLACEHOLDER_${size}x${size}`);
    });
}

async function validateManifest() {
    console.log('Validating manifest...');
    
    const manifest = JSON.parse(
        fs.readFileSync('./chrome-extension/manifest.json', 'utf8')
    );
    
    // Client IDの検証
    if (manifest.oauth2.client_id.includes('YOUR_')) {
        console.warn('Warning: OAuth client_id needs to be configured');
    }
    
    // 必要なファイルの存在確認
    const requiredFiles = [
        'popup/popup.html',
        'popup/popup.css', 
        'popup/popup.js',
        'content/content.js',
        'background/background.js'
    ];
    
    requiredFiles.forEach(file => {
        const filePath = `./chrome-extension/${file}`;
        if (!fs.existsSync(filePath)) {
            throw new Error(`Required file missing: ${file}`);
        }
    });
    
    console.log('Manifest validation passed');
}

async function createZip() {
    console.log('Creating distribution zip...');
    
    const output = fs.createWriteStream('./location-scout-extension.zip');
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });
    
    output.on('close', () => {
        console.log(`Extension packaged: ${archive.pointer()} total bytes`);
    });
    
    archive.on('error', (err) => {
        throw err;
    });
    
    archive.pipe(output);
    
    // Chrome拡張ファイルを追加
    archive.directory('./chrome-extension/', false);
    
    // ドキュメントを追加
    archive.file('./IMPLEMENTATION_GUIDE.md', { name: 'IMPLEMENTATION_GUIDE.md' });
    archive.file('./TEMPLATE_SETUP_GUIDE.md', { name: 'TEMPLATE_SETUP_GUIDE.md' });
    
    await archive.finalize();
}

async function main() {
    try {
        await generateIcons();
        await validateManifest();
        await createZip();
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}