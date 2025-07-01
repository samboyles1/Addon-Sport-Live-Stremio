const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { ADDON_PORT, AVAILABLE_STREAM_PROVIDERS } = require('./config'); 
const { initImageMaps } = require('./image_manager');
const { getGroupedEvents, fetchAllEvents } = require('./event_manager');

const streamProviders = require('./servers/stream_providers');

let builder;

function defineCatalogHandler() {
    builder.defineCatalogHandler(async ({ type, id, extra }) => {
        const statusFilter = extra.status || 'All';
        const categoryFilter = extra.category || 'All';

        if (id === 'sportslive_events_direct' && type === 'tv') {
            const groupedEvents = await getGroupedEvents(statusFilter, categoryFilter); 

            const metas = groupedEvents.map(eventGroup => ({
                id: `sportslive:${eventGroup.id}`,
                type: 'tv',
                name: eventGroup.title,
                poster: eventGroup.poster,
                description: eventGroup.description,
                posterShape: 'tv',
                background: eventGroup.background,
                releaseInfo: `${eventGroup.time} - ${eventGroup.displayStatus}`, 
            }));
            return Promise.resolve({ metas });
        }
        return Promise.resolve({ metas: [] });
    });
}

function defineMetaHandler() {
    builder.defineMetaHandler(async ({ type, id }) => { 
        if (type === 'tv' && id.startsWith('sportslive:')) {
            const eventGroupId = id.replace('sportslive:', '');
            const groupedEvents = await getGroupedEvents('All', 'All'); 
            const eventGroup = groupedEvents.find(group => group.id === eventGroupId);

            if (eventGroup) { 
                const meta = {
                    id: id,
                    type: 'tv',
                    name: eventGroup.title,
                    poster: eventGroup.poster, 
                    background: eventGroup.background,
                    description: eventGroup.description,
                    releaseInfo: `${eventGroup.time} - ${eventGroup.displayStatus}`, 
                    posterShape: 'tv',
                };
                return Promise.resolve({ meta });
            }
        }
        return Promise.resolve({ meta: null });
    });
}

function defineStreamHandler() {
    builder.defineStreamHandler(async function(args) {
        if (args.type === 'tv' && args.id.startsWith('sportslive:')) {
            const eventGroupId = args.id.replace('sportslive:', '');
            const groupedEvents = await getGroupedEvents('All', 'All'); 
            const eventGroup = groupedEvents.find(group => group.id === eventGroupId);

            if (!eventGroup || eventGroup.displayStatus === 'FINALIZADO') {
                return Promise.resolve({ streams: [] }); 
            }

            if (eventGroup.links && eventGroup.links.length > 0) {
                const streams = [];
                const userConfig = args.extra.config || {};
                const enabledProviders = userConfig.enabledProviders && userConfig.enabledProviders.length > 0
                    ? userConfig.enabledProviders
                    : AVAILABLE_STREAM_PROVIDERS.map(p => p.id);

                let optionCounter = 1;

                for (let i = 0; i < eventGroup.links.length; i++) {
                    const link = eventGroup.links[i];
                    const urlObj = new URL(link);
                    let streamNameFromLink = urlObj.searchParams.get('stream') || `Unknown Channel`;
                    streamNameFromLink = streamNameFromLink.replace(/_/g, ' ').toUpperCase();

                    for (const providerId in streamProviders) {
                        if (enabledProviders.includes(providerId)) {
                            const getProviderUrl = streamProviders[providerId];
                            try {
                                const decipheredUrl = await getProviderUrl(link);
                                if (decipheredUrl) {
                                    let providerName = providerId;
                                    if (providerId === 'streamtp') providerName = 'StreamTP';
                                    if (providerId === 'la12hd') providerName = 'La12HD';
                                    if (providerId === '1envivo') providerName = '1EnVivo';

                                    streams.push({
                                        url: decipheredUrl,
                                        title: `${streamNameFromLink} (Option ${optionCounter})\nFrom ${providerName}`
                                    });
                                    optionCounter++; 
                                }
                            } catch (error) {
                                console.error(`[ADDON] Error decoding from ${providerId} for ${eventGroup.title} (link ${i + 1}, ${link}):`, error.message);
                            }
                        }
                    }
                }
                return Promise.resolve({ streams });
            } else {
                return Promise.resolve({ streams: [] });
            }
        }
        return Promise.resolve({ streams: [] });
    });
}

Promise.all([
    initImageMaps(),
    fetchAllEvents() 
])
.then(([_, allEventsData]) => { 
    const categoriesSet = new Set(allEventsData.map(event => event.category).filter(Boolean));
    uniqueCategories = Array.from(categoriesSet).sort(); 
    
    builder = addonBuilder({
        id: 'com.stremio.sports.live.addon',
        version: '1.0.0',
        name: 'Sports Live',
        description: 'Live sporting events',
        logo: 'https://i.imgur.com/eo6sbBO.png',

        types: ['tv'],
        resources: ['catalog', 'meta', 'stream'],
        idPrefixes: ['sportslive:'],

        catalogs: [
            {
                id: 'sportslive_events_direct',
                name: 'Sporting Events',
                type: 'tv',
                extra: [
                    {
                        name: 'status',
                        options: ['All', 'Live', 'Upcoming', 'Finished'],
                        isRequired: false,
                        default: 'All'
                    },
                    { 
                        name: 'category',
                        options: ['All', ...uniqueCategories],
                        isRequired: false,
                        default: 'All'
                    }
                ]
            }
        ],

        behaviorHints: {
            configurable: true, 
        },
    });

    defineCatalogHandler();
    defineMetaHandler();
    defineStreamHandler();

    serveHTTP(builder.getInterface(), {
        port: ADDON_PORT,
        middleware: (req, res, next) => {
            next(); 
        }
    });
})
.catch(err => {
    console.error(`[ADDON] CRITICAL ERROR! The addon could not start because image maps or homepage HTML failed to load.`, err);
    process.exit(1);
});
