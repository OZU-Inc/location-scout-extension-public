export class SecureStorage {
    static async encrypt(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const key = await this.getOrCreateKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return btoa(String.fromCharCode(...combined));
    }
    
    static async decrypt(encryptedText) {
        try {
            const combined = new Uint8Array(
                atob(encryptedText).split('').map(char => char.charCodeAt(0))
            );
            
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            
            const key = await this.getOrCreateKey();
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }
    
    static async getOrCreateKey() {
        let keyData = await chrome.storage.local.get(['encryptionKey']);
        
        if (!keyData.encryptionKey) {
            const key = await crypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );
            
            const exported = await crypto.subtle.exportKey('raw', key);
            const keyArray = Array.from(new Uint8Array(exported));
            
            await chrome.storage.local.set({ encryptionKey: keyArray });
            return key;
        }
        
        const keyArray = new Uint8Array(keyData.encryptionKey);
        return await crypto.subtle.importKey(
            'raw',
            keyArray,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }
    
    static async secureStore(key, value) {
        const encrypted = await this.encrypt(value);
        await chrome.storage.local.set({ [key]: encrypted });
    }
    
    static async secureGet(key) {
        const data = await chrome.storage.local.get([key]);
        if (data[key]) {
            return await this.decrypt(data[key]);
        }
        return null;
    }
    
    static async secureRemove(key) {
        await chrome.storage.local.remove([key]);
    }
}