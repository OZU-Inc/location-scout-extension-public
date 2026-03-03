/**
 * Location Scout v2 - Google Drive管理モジュール
 * フォルダ作成、画像保存、ドキュメント保存を担当
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const DOCS_API_BASE = 'https://docs.googleapis.com/v1';

/**
 * ロケーション用フォルダを作成
 * @param {string} locationName - ロケーション名
 * @param {string} parentFolderId - 親フォルダID
 * @param {string} authToken - 認証トークン
 * @returns {Promise<{folderId: string, folderUrl: string, imagesFolderId: string}>}
 */
export async function createLocationFolder(locationName, parentFolderId, authToken) {
    const timestamp = new Date().toISOString().split('T')[0];
    const folderName = `${timestamp}_${sanitizeFileName(locationName)}`;

    console.log(`Creating folder: ${folderName} in ${parentFolderId}`);

    // メインフォルダ作成
    const mainFolder = await createFolder(folderName, parentFolderId, authToken);

    // imagesサブフォルダ作成
    const imagesFolder = await createFolder('images', mainFolder.id, authToken);

    return {
        folderId: mainFolder.id,
        folderUrl: `https://drive.google.com/drive/folders/${mainFolder.id}`,
        imagesFolderId: imagesFolder.id
    };
}

/**
 * フォルダを作成
 * @param {string} name - フォルダ名
 * @param {string} parentId - 親フォルダID
 * @param {string} authToken - 認証トークン
 * @returns {Promise<{id: string, name: string}>}
 */
async function createFolder(name, parentId, authToken) {
    const response = await fetch(`${DRIVE_API_BASE}/files`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`フォルダ作成失敗: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
}

/**
 * 画像をBase64データからDriveに保存
 * @param {Array} images - 画像情報の配列 [{src, classification, base64}]
 * @param {string} locationName - ロケーション名
 * @param {string} imagesFolderId - 保存先フォルダID
 * @param {string} authToken - 認証トークン
 * @param {Function} progressCallback - 進捗コールバック
 * @returns {Promise<{saved: Array, errors: Array}>}
 */
export async function saveImages(images, locationName, imagesFolderId, authToken, progressCallback) {
    const saved = [];
    const errors = [];
    const sanitizedLocationName = sanitizeFileName(locationName);

    console.log(`saveImages: ${images.length}枚の画像を保存開始`);

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const indexStr = String(i + 1).padStart(3, '0');
        const classification = sanitizeFileName(image.classification || 'photo');
        const fileName = `${sanitizedLocationName}_${indexStr}_${classification}.jpg`;

        if (progressCallback) {
            progressCallback(`画像 ${i + 1}/${images.length} を保存中...`);
        }

        try {
            let imageBlob;

            // Base64データがあればそれを使用、なければURLからダウンロード
            if (image.base64) {
                console.log(`Image ${i + 1}: Base64データから変換`);
                imageBlob = base64ToBlob(image.base64);
            } else {
                console.log(`Image ${i + 1}: URLからダウンロード ${image.src.substring(0, 60)}`);
                imageBlob = await downloadImage(image.src);
            }

            // Driveにアップロード
            const uploadedFile = await uploadFile(
                imageBlob,
                fileName,
                'image/jpeg',
                imagesFolderId,
                authToken
            );

            saved.push({
                originalUrl: image.src,
                driveFileId: uploadedFile.id,
                fileName: fileName,
                classification: image.classification
            });

            console.log(`Saved image: ${fileName} (ID: ${uploadedFile.id})`);

        } catch (error) {
            console.error(`Failed to save image ${i + 1}:`, error);
            errors.push({
                url: image.src,
                error: error.message,
                index: i
            });
        }
    }

    console.log(`saveImages完了: ${saved.length}枚保存, ${errors.length}枚失敗`);
    return { saved, errors };
}

/**
 * Base64データをBlobに変換
 */
function base64ToBlob(base64Data) {
    // data:image/jpeg;base64,... の形式からbase64部分を抽出
    const parts = base64Data.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64 = parts[1];

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

/**
 * 画像をダウンロード
 * @param {string} url - 画像URL
 * @returns {Promise<Blob>}
 */
async function downloadImage(url) {
    const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit'
    });

    if (!response.ok) {
        throw new Error(`画像ダウンロード失敗: ${response.status}`);
    }

    return await response.blob();
}

/**
 * ファイルをDriveにアップロード
 * @param {Blob} blob - ファイルデータ
 * @param {string} fileName - ファイル名
 * @param {string} mimeType - MIMEタイプ
 * @param {string} folderId - 保存先フォルダID
 * @param {string} authToken - 認証トークン
 * @returns {Promise<{id: string, name: string}>}
 */
async function uploadFile(blob, fileName, mimeType, folderId, authToken) {
    const metadata = {
        name: fileName,
        parents: [folderId]
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`
        },
        body: form
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`アップロード失敗: ${error.error?.message || response.statusText}`);
    }

    return await response.json();
}

/**
 * 生データをGoogleドキュメントとして保存
 * @param {string} rawText - 生テキストデータ
 * @param {string} locationName - ロケーション名
 * @param {string} sourceUrl - ソースURL
 * @param {string} folderId - 保存先フォルダID
 * @param {string} authToken - 認証トークン
 * @returns {Promise<{documentId: string, documentUrl: string}>}
 */
export async function saveRawDataAsDocument(rawText, locationName, sourceUrl, folderId, authToken) {
    const timestamp = new Date().toLocaleString('ja-JP');
    const title = `生データ_${sanitizeFileName(locationName)}`;

    // まず空のドキュメントを作成
    const createResponse = await fetch(`${DOCS_API_BASE}/documents`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title
        })
    });

    if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(`ドキュメント作成失敗: ${error.error?.message || createResponse.statusText}`);
    }

    const doc = await createResponse.json();
    const documentId = doc.documentId;

    // ドキュメントの内容を追加
    const content = `取得元: ${sourceUrl}
取得日時: ${timestamp}
ロケーション名: ${locationName}

${'='.repeat(50)}
生データ
${'='.repeat(50)}

${rawText}
`;

    const updateResponse = await fetch(`${DOCS_API_BASE}/documents/${documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            requests: [{
                insertText: {
                    location: { index: 1 },
                    text: content
                }
            }]
        })
    });

    if (!updateResponse.ok) {
        console.warn('ドキュメント内容の追加に失敗しましたが、空のドキュメントは作成されました');
    }

    // ドキュメントを指定フォルダに移動
    await moveFileToFolder(documentId, folderId, authToken);

    return {
        documentId: documentId,
        documentUrl: `https://docs.google.com/document/d/${documentId}/edit`
    };
}

/**
 * ファイルをフォルダに移動
 * @param {string} fileId - ファイルID
 * @param {string} folderId - 移動先フォルダID
 * @param {string} authToken - 認証トークン
 */
async function moveFileToFolder(fileId, folderId, authToken) {
    // まず現在の親を取得
    const fileResponse = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=parents`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!fileResponse.ok) {
        throw new Error('ファイル情報取得失敗');
    }

    const fileData = await fileResponse.json();
    const previousParents = fileData.parents ? fileData.parents.join(',') : '';

    // 新しいフォルダに移動
    const moveResponse = await fetch(
        `${DRIVE_API_BASE}/files/${fileId}?addParents=${folderId}&removeParents=${previousParents}`,
        {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${authToken}` }
        }
    );

    if (!moveResponse.ok) {
        throw new Error('ファイル移動失敗');
    }
}

/**
 * フォルダ一覧を取得
 * @param {string} authToken - 認証トークン
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export async function listFolders(authToken) {
    const query = "mimeType='application/vnd.google-apps.folder'";
    const response = await fetch(
        `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&orderBy=name`,
        {
            headers: { 'Authorization': `Bearer ${authToken}` }
        }
    );

    if (!response.ok) {
        throw new Error('フォルダ一覧取得失敗');
    }

    const data = await response.json();
    return data.files || [];
}

/**
 * ファイル名をサニタイズ
 * @param {string} name - 元のファイル名
 * @returns {string} サニタイズされたファイル名
 */
function sanitizeFileName(name) {
    if (!name) return 'unknown';
    return name
        .replace(/[\\/:*?"<>|]/g, '_')  // 禁止文字を置換
        .replace(/\s+/g, '_')            // 空白をアンダースコアに
        .replace(/_+/g, '_')             // 連続アンダースコアを1つに
        .substring(0, 100);               // 長さ制限
}

/**
 * 画像URLから拡張子を取得
 * @param {string} url - 画像URL
 * @returns {string} 拡張子（ドット付き）
 */
function getImageExtension(url) {
    try {
        const pathname = new URL(url).pathname;
        const ext = pathname.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            return '.' + (ext === 'jpeg' ? 'jpg' : ext);
        }
    } catch {
        // URLパース失敗
    }
    return '.jpg';  // デフォルト
}
