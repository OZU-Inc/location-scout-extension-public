export async function getAuthToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(token);
            }
        });
    });
}

export async function removeCachedAuthToken(token) {
    return new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
            resolve();
        });
    });
}

export async function launchWebAuthFlow(url) {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
            {
                url: url,
                interactive: true
            },
            (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(redirectUrl);
                }
            }
        );
    });
}