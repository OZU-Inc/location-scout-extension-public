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

// テンプレートファイルから新しいスライドを作成
export async function createSlideFromTemplate(locationData, authToken, templateId) {
    try {
        console.log('📋 テンプレートファイルから複製中...', templateId);
        
        // Google Drive APIを使用してテンプレートファイルを複製
        const copyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${templateId}/copy`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: `撮影地情報 - ${locationData.locationName} - ${new Date().toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}`
            })
        });
        
        if (!copyResponse.ok) {
            throw new Error(`テンプレート複製失敗: ${copyResponse.statusText}`);
        }
        
        const copiedFile = await copyResponse.json();
        const presentationId = copiedFile.id;
        
        console.log('📝 複製完了、プレースホルダーを置換中...');
        
        // プレースホルダーを実際のデータで置換
        const replaceRequests = generateTemplateReplaceRequests(locationData);
        
        if (replaceRequests.length > 0) {
            await batchUpdate(presentationId, replaceRequests, authToken);
        }
        
        const slideUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
        console.log('✅ テンプレートベーススライド生成完了');
        return slideUrl;
        
    } catch (error) {
        console.error('❌ テンプレートスライド生成エラー:', error);
        throw new Error(`テンプレートからのスライド生成に失敗しました: ${error.message}`);
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
    
    // セクション番号とタイトル（最上部）
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
                    translateY: 20,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: sectionHeaderId,
            text: `. 撮影地`,
            insertionIndex: 0
        }
    });
    
    // セクションヘッダーのスタイル
    requests.push({
        updateTextStyle: {
            objectId: sectionHeaderId,
            textRange: { type: 'ALL' },
            style: {
                fontSize: { magnitude: 10, unit: 'PT' },
                bold: true,
                foregroundColor: {
                    opaqueColor: {
                        rgbColor: {
                            red: 0.0,
                            green: 0.0,
                            blue: 0.0
                        }
                    }
                }
            },
            fields: 'fontSize,bold,foregroundColor'
        }
    });
    
    // 下線（8. 撮影地の真下）
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
                    translateY: 55,
                    unit: 'PT'
                }
            }
        }
    });
    
    // URLリンク（8.撮影地の右側、スライド真ん中より右）
    const urlLinkId = generateId();
    requests.push({
        createShape: {
            objectId: urlLinkId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 350, unit: 'PT' },
                    height: { magnitude: 30, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 370,
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
    
    // URLテキストのフォントサイズを10pt、文字色を黒に設定
    requests.push({
        updateTextStyle: {
            objectId: urlLinkId,
            textRange: { type: 'ALL' },
            style: { 
                fontSize: { magnitude: 10, unit: 'PT' },
                foregroundColor: {
                    opaqueColor: {
                        rgbColor: {
                            red: 0.0,
                            green: 0.0,
                            blue: 0.0
                        }
                    }
                }
            },
            fields: 'fontSize,foregroundColor'
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
                                green: 0.0,
                                blue: 0.0
                            }
                        }
                    },
                    underline: true,
                    fontSize: { magnitude: 10, unit: 'PT' }
                },
                fields: 'link,foregroundColor,underline,fontSize'
            }
        });
    }
    
    // 場所名・住所フィールド
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
                    translateY: 70,
                    unit: 'PT'
                }
            }
        }
    });
    
    requests.push({
        insertText: {
            objectId: locationNameId,
            text: `場所名：${data.locationName || '記載無し'}\n住所：${data.address || '記載無し'}`,
            insertionIndex: 0
        }
    });
    
    requests.push({
        updateTextStyle: {
            objectId: locationNameId,
            textRange: { type: 'ALL' },
            style: { 
                fontSize: { magnitude: 10, unit: 'PT' },
                foregroundColor: {
                    opaqueColor: {
                        rgbColor: {
                            red: 0.0,
                            green: 0.0,
                            blue: 0.0
                        }
                    }
                }
            },
            fields: 'fontSize,foregroundColor'
        }
    });
    
    
    // アクセス（電車の場合）セクション
    // アクセス（電車の場合）セクション＋詳細を1つのテキストボックスに
    const trainAccessId = generateId();
    requests.push({
        createShape: {
            objectId: trainAccessId,
            shapeType: 'TEXT_BOX',
            elementProperties: {
                pageObjectId: slideId,
                size: {
                    width: { magnitude: 600, unit: 'PT' },
                    height: { magnitude: 100, unit: 'PT' }
                },
                transform: {
                    scaleX: 1,
                    scaleY: 1,
                    translateX: 50,
                    translateY: 300,
                    unit: 'PT'
                }
            }
        }
    });


    requests.push({
        insertText: {
            objectId: trainAccessId,
            text: `アクセス\n【電車の場合】\n${data.trainAccess || '記載無し'}\n 【車の場合】\n${data.carAccess || '記載無し'}\n 駐車場：${data.parkingInfo || '記載無し'}`,
            insertionIndex: 0
        }
    });
    
    requests.push({
        updateTextStyle: {
            objectId: trainAccessId,
            textRange: { type: 'ALL' },
            style: { 
                fontSize: { magnitude: 10, unit: 'PT' },
                foregroundColor: {
                    opaqueColor: {
                        rgbColor: {
                            red: 0.0,
                            green: 0.0,
                            blue: 0.0
                        }
                    }
                }
            },
            fields: 'fontSize,foregroundColor'
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

// テンプレート内のプレースホルダーを置換するリクエストを生成
function generateTemplateReplaceRequests(locationData) {
    const requests = [];
    
    // 定義されたプレースホルダーと置換対象のマッピング
    const placeholders = {
        '{{場所名}}': locationData.locationName || '記載無し',
        '{{住所}}': locationData.address || '記載無し',
        '{{電車アクセス}}': locationData.trainAccess || '記載無し',
        '{{車アクセス}}': locationData.carAccess || '記載無し',
        '{{駐車場}}': locationData.parkingInfo || '記載無し',
        '{{電話番号}}': locationData.phoneNumber || '記載無し',
        '{{ページタイトル}}': locationData.sourceInfo?.pageTitle || '不明',
        '{{ページ概要}}': locationData.sourceInfo?.pageDescription || '',
        '{{抽出元}}': locationData.sourceInfo?.extractedFrom || '全体',
        '{{データ品質}}': locationData.sourceInfo?.dataQuality || '不明',
        '{{抽出フィールド}}': (locationData.sourceInfo?.extractedFields || []).join(', ') || '',
        '{{ソースURL}}': locationData.sourceUrl || '',
        '{{抽出日時}}': new Date().toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    };
    
    // 各プレースホルダーに対して置換リクエストを作成
    Object.entries(placeholders).forEach(([placeholder, replacement]) => {
        requests.push({
            replaceAllText: {
                containsText: {
                    text: placeholder,
                    matchCase: true
                },
                replaceText: replacement
            }
        });
    });
    
    return requests;
}