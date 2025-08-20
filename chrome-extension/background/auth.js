/**
 * Google OAuth認証トークン取得関数
 * 目的: Google APIs（Slides、Sheets、Drive）にアクセスするための認証トークンを取得
 * manifest.jsonのclient_idとscopesに基づいて認証フローを実行
 */
export async function getAuthToken() {
    return new Promise((resolve, reject) => {
        // Chrome Identity API でOAuth認証実行（ユーザーにGoogleログイン画面表示）
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                // 認証失敗時（client_id未設定、ユーザー拒否等）
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                // 認証成功 - アクセストークンを返却
                resolve(token);
            }
        });
    });
}

/**
 * 保存されている認証トークンをキャッシュから削除
 * 目的: ログアウト処理や認証エラー時のトークン無効化
 */
export async function removeCachedAuthToken(token) {
    return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
            resolve();  // 削除完了
        });
    });
}

/**
 * 汎用WebAuth認証フロー実行関数
 * 目的: 他のOAuth プロバイダー用の認証フロー（現在は未使用）
 */
export async function launchWebAuthFlow(url) {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            {
                url: url,              // 認証プロバイダーのURL
                interactive: true      // ユーザー操作必須
            },
            (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(redirectUrl);  // リダイレクトURLを返却（認証コード等含む）
                }
            }
        );
    });
}