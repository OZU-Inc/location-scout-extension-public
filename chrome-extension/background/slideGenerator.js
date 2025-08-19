export async function createGoogleSlide(locationData, authToken, template = 'default', includeImages = true) {
    try {
        const presentation = await createPresentation(locationData.locationName, authToken);
        const presentationId = presentation.presentationId;
        
        const slides = generateSlideRequests(locationData, template, includeImages);
        
        await batchUpdate(presentationId, slides, authToken);
        
        const slideUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
        return slideUrl;
        
    } catch (error) {
        console.error('スライド生成エラー:', error);
        throw new Error(`スライド生成に失敗しました: ${error.message}`);
    }
}

async function createPresentation(title, authToken) {
    const response = await fetch('https://slides.googleapis.com/v1/presentations', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: `${title} - ロケハン資料`
        })
    });
    
    if (!response.ok) {
        throw new Error(`プレゼンテーション作成失敗: ${response.statusText}`);
    }
    
    return await response.json();
}

function generateSlideRequests(data, template, includeImages) {
    const requests = [];
    const slideIds = [];
    
    for (let i = 0; i < 5; i++) {
        slideIds.push(generateId());
    }
    
    requests.push({
        createSlide: {
            objectId: slideIds[0],
            slideLayoutReference: {
                predefinedLayout: 'TITLE'
            }
        }
    });
    
    requests.push({
        createSlide: {
            objectId: slideIds[1],
            slideLayoutReference: {
                predefinedLayout: 'TITLE_AND_BODY'
            }
        }
    });
    
    requests.push({
        createSlide: {
            objectId: slideIds[2],
            slideLayoutReference: {
                predefinedLayout: 'TITLE_AND_BODY'
            }
        }
    });
    
    if (includeImages && data.images && data.images.length > 0) {
        requests.push({
            createSlide: {
                objectId: slideIds[3],
                slideLayoutReference: {
                    predefinedLayout: 'BLANK'
                }
            }
        });
    }
    
    requests.push({
        createSlide: {
            objectId: slideIds[4],
            slideLayoutReference: {
                predefinedLayout: 'TITLE_AND_BODY'
            }
        }
    });
    
    const textRequests = generateTextRequests(data, slideIds, includeImages);
    requests.push(...textRequests);
    
    if (includeImages && data.images && data.images.length > 0) {
        const imageRequests = generateImageRequests(data.images, slideIds[3]);
        requests.push(...imageRequests);
    }
    
    return requests;
}

function generateTextRequests(data, slideIds, includeImages) {
    const requests = [];
    const today = new Date().toLocaleDateString('ja-JP');
    
    requests.push({
        insertText: {
            objectId: `${slideIds[0]}_title`,
            text: data.locationName || '場所名未設定',
            insertionIndex: 0
        }
    });
    
    requests.push({
        insertText: {
            objectId: `${slideIds[0]}_subtitle`,
            text: `ロケハン資料\n${today}`,
            insertionIndex: 0
        }
    });
    
    requests.push({
        insertText: {
            objectId: `${slideIds[1]}_title`,
            text: '基本情報',
            insertionIndex: 0
        }
    });
    
    const basicInfo = [
        `📍 住所: ${data.address || '情報なし'}`,
        `🚃 アクセス: ${data.access || '情報なし'}`,
        `⏰ 営業時間: ${data.businessHours || '情報なし'}`,
        `📅 定休日: ${data.closedDays || '情報なし'}`,
        data.contact?.phone ? `📞 電話: ${data.contact.phone}` : null,
        data.contact?.website ? `🌐 Web: ${data.contact.website}` : null
    ].filter(Boolean).join('\n');
    
    requests.push({
        insertText: {
            objectId: `${slideIds[1]}_body`,
            text: basicInfo,
            insertionIndex: 0
        }
    });
    
    requests.push({
        insertText: {
            objectId: `${slideIds[2]}_title`,
            text: '特徴・撮影ポイント',
            insertionIndex: 0
        }
    });
    
    const features = [
        '【特徴】',
        ...(data.features || []).map(f => `• ${f}`),
        '',
        '【撮影に適した場所】',
        ...(data.photoSpots || []).map(p => `• ${p}`),
        '',
        '【施設・設備】',
        ...(data.facilities || []).map(f => `• ${f}`)
    ].join('\n');
    
    requests.push({
        insertText: {
            objectId: `${slideIds[2]}_body`,
            text: features,
            insertionIndex: 0
        }
    });
    
    const notesSlideIndex = includeImages ? 4 : 3;
    
    requests.push({
        insertText: {
            objectId: `${slideIds[notesSlideIndex]}_title`,
            text: '注意事項・備考',
            insertionIndex: 0
        }
    });
    
    const notes = [
        data.notes || '特記事項なし',
        '',
        '【概要】',
        data.summary || '',
        '',
        `参照元: ${data.sourceUrl}`,
        `取得日時: ${new Date(data.extractedAt).toLocaleString('ja-JP')}`
    ].join('\n');
    
    requests.push({
        insertText: {
            objectId: `${slideIds[notesSlideIndex]}_body`,
            text: notes,
            insertionIndex: 0
        }
    });
    
    return requests;
}

function generateImageRequests(images, slideId) {
    const requests = [];
    const maxImages = Math.min(images.length, 4);
    
    const positions = [
        { x: 50, y: 50 },
        { x: 370, y: 50 },
        { x: 50, y: 250 },
        { x: 370, y: 250 }
    ];
    
    for (let i = 0; i < maxImages; i++) {
        requests.push({
            createImage: {
                url: images[i],
                elementProperties: {
                    pageObjectId: slideId,
                    size: {
                        width: { magnitude: 300, unit: 'PT' },
                        height: { magnitude: 180, unit: 'PT' }
                    },
                    transform: {
                        scaleX: 1,
                        scaleY: 1,
                        translateX: positions[i].x,
                        translateY: positions[i].y,
                        unit: 'PT'
                    }
                }
            }
        });
    }
    
    requests.push({
        createShape: {
            objectId: `${slideId}_title_box`,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 720, unit: 'PT' },
                    height: { magnitude: 40, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 0,
                    translateY: 0,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: `${slideId}_title_box`,
            text: '参考画像',
            insertionIndex: 0
        }
    });
    
    return requests;
}

async function batchUpdate(presentationId, requests, authToken) {
    const response = await fetch(
        `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests })
        }
    );
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`バッチ更新失敗: ${JSON.stringify(error)}`);
    }
    
    return await response.json();
}

function generateId() {
    return 'slide_' + Math.random().toString(36).substr(2, 9);
}