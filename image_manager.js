const TITLE_IMAGE_MAP = require('./poster_data');
const { PLACEHOLDER_POSTER, PLACEHOLDER_BACKGROUND, IMAGE_GENERATOR_BASE_URL } = require('./config');

let generatorNotConfiguredLogged = false;

async function initImageMaps() {
    if (!TITLE_IMAGE_MAP) {
        console.error('[ImageManager] Error: Poster map could not be loaded from local files.');
        throw new Error('Poster map not available.');
    }
    console.log('[ImageManager] Local poster map loaded successfully.');
    
    if (!IMAGE_GENERATOR_BASE_URL || IMAGE_GENERATOR_BASE_URL.trim() === '') {
        console.log('[ImageManager] Warning: IMAGE_GENERATOR_BASE_URL is not configured. Dynamic image generation is disabled; poster_data.js will be used instead.');
        generatorNotConfiguredLogged = true;
    }
    
    return Promise.resolve();
}

function getPosterImage(title, status) {
    if (!TITLE_IMAGE_MAP) {
        console.warn('[ImageManager] TITLE_IMAGE_MAP has not been loaded.');
        return PLACEHOLDER_POSTER;
    }

    const normalizedTitle = title.toLowerCase();
    const normalizedStatus = status ? status.toLowerCase() : '';

    let baseImageUrl = undefined;
    let longestMatchKeyword = '';

    for (const keyword in TITLE_IMAGE_MAP) {
        if (normalizedTitle.includes(keyword.toLowerCase())) {
            if (keyword.length > longestMatchKeyword.length) {
                longestMatchKeyword = keyword;
            }
        }
    }

    if (longestMatchKeyword && TITLE_IMAGE_MAP[longestMatchKeyword]) {
        baseImageUrl = TITLE_IMAGE_MAP[longestMatchKeyword];
    }

    if (!baseImageUrl && TITLE_IMAGE_MAP['default_poster']) {
        baseImageUrl = TITLE_IMAGE_MAP['default_poster'];
    }

    if (!baseImageUrl) {
        return PLACEHOLDER_POSTER;
    }

    if (IMAGE_GENERATOR_BASE_URL && IMAGE_GENERATOR_BASE_URL.trim() !== '') {
        let liveTextParam = '';

        switch (normalizedStatus) {
            case 'en vivo':
                liveTextParam = 'LIVE';
                break;
            case 'pronto':
                liveTextParam = 'UPCOMING';
                break;
            case 'finalizado':
                liveTextParam = 'FINISHED';
                break;
            default:
                return baseImageUrl;
        }

        const encodedLiveText = encodeURIComponent(liveTextParam);
        const encodedImageUrl = encodeURIComponent(baseImageUrl);

        const generatedImageUrl = `${IMAGE_GENERATOR_BASE_URL}?imageUrl=${encodedImageUrl}&liveText=${encodedLiveText}`;
        
        return generatedImageUrl;
    } else {
        return baseImageUrl;
    }
}

function getBackgroundImage(title) { 
    if (!TITLE_IMAGE_MAP) {
        console.warn('[ImageManager] TITLE_IMAGE_MAP has not been loaded for background.');
        return PLACEHOLDER_BACKGROUND;
    }

    const normalizedTitle = title.toLowerCase();
    let longestMatchKeyword = '';

    for (const keyword in TITLE_IMAGE_MAP) {
        if (normalizedTitle.includes(keyword.toLowerCase())) {
            if (keyword.length > longestMatchKeyword.length) {
                longestMatchKeyword = keyword;
            }
        }
    }

    let baseImageUrl = undefined;
    if (longestMatchKeyword && TITLE_IMAGE_MAP[longestMatchKeyword]) {
        baseImageUrl = TITLE_IMAGE_MAP[longestMatchKeyword];
    }

    if (!baseImageUrl && TITLE_IMAGE_MAP['default_poster']) {
        baseImageUrl = TITLE_IMAGE_MAP['default_poster'];
    }

    if (!baseImageUrl) {
        return PLACEHOLDER_BACKGROUND;
    }

    return baseImageUrl;
}

module.exports = {
    initImageMaps,
    getPosterImage,
    getBackgroundImage
};
