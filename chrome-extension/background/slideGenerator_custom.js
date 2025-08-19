export async function createCustomFormatSlide(locationData, authToken) {
    try {
        const presentation = await createPresentation(locationData.locationName, authToken);
        const presentationId = presentation.presentationId;
        
        const slideRequests = generateCustomSlideRequests(locationData);
        
        await batchUpdate(presentationId, slideRequests, authToken);
        
        const slideUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
        return slideUrl;
        
    } catch (error) {
        console.error('カスタムスライド生成エラー:', error);
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
            title: `撮影地情報 - ${title}`
        })
    });
    
    if (!response.ok) {
        throw new Error(`プレゼンテーション作成失敗: ${response.statusText}`);
    }
    
    return await response.json();
}

function generateCustomSlideRequests(data) {
    const requests = [];
    const slideId = generateId();
    
    // スライドを作成（BLANK レイアウト）
    requests.push({
        createSlide: {
            objectId: slideId,
            slideLayoutReference: {
                predefinedLayout: 'BLANK'
            }
        }
    });
    
    // URLリンク（上部）
    const urlLinkId = generateId();
    requests.push({
        createShape: {
            objectId: urlLinkId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 600, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 20,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: urlLinkId,
            text: `URL: ${data.sourceUrl || 'https://'}`,
            insertionIndex: 0
        }
    });
    
    // URLをクリック可能なリンクに設定
    if (data.sourceUrl) {
        requests.push({
            updateTextStyle: {
                objectId: urlLinkId,
                textRange: {
                    type: 'ALL'
                },
                style: {
                    link: {
                        url: data.sourceUrl
                    },
                    foregroundColor: {
                        opaqueColor: {
                            rgbColor: {
                                red: 0.0,
                                green: 0.4,
                                blue: 0.8
                            }
                        }
                    },
                    underline: true
                },
                fields: 'link,foregroundColor,underline'
            }
        });
    }
    
    // セクション番号とタイトル
    const sectionHeaderId = generateId();
    requests.push({
        createShape: {
            objectId: sectionHeaderId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 300, unit: 'PT' },
                    height: { magnitude: 40, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 80,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: sectionHeaderId,
            text: '8. 撮影地',
            insertionIndex: 0
        }
    });
    
    // セクションヘッダーのスタイル
    requests.push({
        updateTextStyle: {
            objectId: sectionHeaderId,
            textRange: { type: 'ALL' },
            style: {
                fontSize: { magnitude: 16, unit: 'PT' },
                bold: true
            },
            fields: 'fontSize,bold'
        }
    });
    
    // 下線
    const underlineId = generateId();
    requests.push({
        createLine: {
            objectId: underlineId,
            lineCategory: 'STRAIGHT',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 620, unit: 'PT' },
                    height: { magnitude: 0, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 125,
                    unit: 'PT'
                }
            }
        }
    });
    
    // 場所名フィールド
    const locationNameId = generateId();
    requests.push({
        createShape: {
            objectId: locationNameId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 600, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 150,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: locationNameId,
            text: `場所名：${data.locationName || '記載無し'}`,
            insertionIndex: 0
        }
    });
    
    // 住所フィールド
    const addressId = generateId();
    requests.push({
        createShape: {
            objectId: addressId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 600, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 185,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: addressId,
            text: `住所：${data.address || '記載無し'}`,
            insertionIndex: 0
        }
    });
    
    // アクセス（電車の場合）セクション
    const trainAccessHeaderId = generateId();
    requests.push({
        createShape: {
            objectId: trainAccessHeaderId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 200, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 240,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: trainAccessHeaderId,
            text: 'アクセス\n【電車の場合】',
            insertionIndex: 0
        }
    });
    
    // 電車アクセス詳細
    const trainAccessDetailId = generateId();
    requests.push({
        createShape: {
            objectId: trainAccessDetailId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 600, unit: 'PT' },
                    height: { magnitude: 60, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 80,
                    translateY: 285,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: trainAccessDetailId,
            text: data.trainAccess || '記載無し',
            insertionIndex: 0
        }
    });
    
    // アクセス（車の場合）セクション
    const carAccessHeaderId = generateId();
    requests.push({
        createShape: {
            objectId: carAccessHeaderId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 200, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 80,
                    translateY: 360,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: carAccessHeaderId,
            text: '【車の場合】',
            insertionIndex: 0
        }
    });
    
    // 車アクセス詳細
    const carAccessDetailId = generateId();
    requests.push({
        createShape: {
            objectId: carAccessDetailId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 600, unit: 'PT' },
                    height: { magnitude: 60, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 80,
                    translateY: 390,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: carAccessDetailId,
            text: data.carAccess || '記載無し',
            insertionIndex: 0
        }
    });
    
    // 駐車場セクション
    const parkingHeaderId = generateId();
    requests.push({
        createShape: {
            objectId: parkingHeaderId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 200, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 470,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: parkingHeaderId,
            text: '駐車場：',
            insertionIndex: 0
        }
    });
    
    // 駐車場詳細
    const parkingDetailId = generateId();
    requests.push({
        createShape: {
            objectId: parkingDetailId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 500, unit: 'PT' },
                    height: { magnitude: 60, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 150,
                    translateY: 470,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: parkingDetailId,
            text: data.parkingInfo || '記載無し',
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
    return 'custom_' + Math.random().toString(36).substr(2, 9);
}