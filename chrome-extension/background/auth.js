/**
 * Location Scout v2 - Google認証モジュール
 */

let cachedToken = null;
let tokenExpiry = null;

/**
 * Google認証トークンを取得
 * @param {boolean} interactive - インタラクティブ認証を許可するか
 * @returns {Promise<string>} 認証トークン
 */
export async function getAuthToken(interactive = true) {
    // キャッシュされたトークンが有効かチェック
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log('Using cached auth token');
        return cachedToken;
    }

    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
            if (chrome.runtime.lastError) {
                console.error('Auth error:', chrome.runtime.lastError);
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            if (!token) {
                reject(new Error('認証トークンを取得できませんでした'));
                return;
            }

            // トークンをキャッシュ（55分間有効）
            cachedToken = token;
            tokenExpiry = Date.now() + 55 * 60 * 1000;

            console.log('Got new auth token');
            resolve(token);
        });
    });
}

/**
 * トークンを無効化してキャッシュをクリア
 * @returns {Promise<void>}
 */
export async function revokeToken() {
    if (cachedToken) {
        return new Promise((resolve) => {
            chrome.identity.removeCachedAuthToken({ token: cachedToken }, () => {
                cachedToken = null;
                tokenExpiry = null;
                console.log('Token revoked');
                resolve();
            });
        });
    }
}

/**
 * 認証状態をチェック
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
    try {
        const token = await getAuthToken(false);
        return !!token;
    } catch {
        return false;
    }
}

/**
 * トークンをリフレッシュ
 * @returns {Promise<string>}
 */
export async function refreshToken() {
    await revokeToken();
    return getAuthToken(true);
}
