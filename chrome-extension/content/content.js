function extractPageContent() {
    const content = {
        title: document.title,
        url: window.location.href,
        meta: {},
        text: '',
        images: []
    };

    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (name && content) {
            content.meta[name] = content;
        }
    });

    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, address, time');
    const textContent = [];
    textElements.forEach(element => {
        const text = element.textContent.trim();
        if (text && text.length > 10) {
            textContent.push(text);
        }
    });
    content.text = textContent.join('\n');

    const images = document.querySelectorAll('img');
    const imageUrls = [];
    images.forEach((img, index) => {
        if (index < 10 && img.src && img.width > 100 && img.height > 100) {
            imageUrls.push({
                src: img.src,
                alt: img.alt || '',
                width: img.width,
                height: img.height
            });
        }
    });
    content.images = imageUrls;

    const addressElements = document.querySelectorAll('[itemprop="address"], .address, .location, address');
    if (addressElements.length > 0) {
        content.address = addressElements[0].textContent.trim();
    }

    const phoneElements = document.querySelectorAll('[href^="tel:"], [itemprop="telephone"]');
    if (phoneElements.length > 0) {
        content.phone = phoneElements[0].textContent.trim();
    }

    const timeElements = document.querySelectorAll('.hours, .business-hours, [itemprop="openingHours"]');
    if (timeElements.length > 0) {
        content.hours = timeElements[0].textContent.trim();
    }

    return content;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
        const content = extractPageContent();
        sendResponse(content);
    }
    return true;
});