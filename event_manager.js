const fetch = require('node-fetch');
const { EVENTS_JSON_URL, SOURCE_TIMEZONE_OFFSET_HOURS, TIMEZONE_OFFSET_HOURS } = require('./config');
const { getPosterImage, getBackgroundImage } = require('./image_manager');

async function fetchAllEvents() {
    try {
        const response = await fetch(EVENTS_JSON_URL);
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('[EventManager] Error fetching events from JSON:', error);
        return [];
    }
}

async function getGroupedEvents(statusFilter = 'All', categoryFilter = 'All') {
    const allEvents = await fetchAllEvents();
    let relevantEvents = allEvents;

    if (statusFilter === 'Live') {
        relevantEvents = relevantEvents.filter(event =>
            event.status && event.status.toLowerCase() === 'en vivo'
        );
    } else if (statusFilter === 'Upcoming') {
        relevantEvents = relevantEvents.filter(event =>
            event.status && event.status.toLowerCase() === 'pronto'
        );
    } else if (statusFilter === 'Finished') {
        relevantEvents = relevantEvents.filter(event =>
            event.status && event.status.toLowerCase() === 'finalizado'
        );
    } else {
        relevantEvents = relevantEvents.filter(event =>
            event.status && (
                event.status.toLowerCase() === 'en vivo' ||
                event.status.toLowerCase() === 'pronto' ||
                event.status.toLowerCase() === 'finalizado'
            )
        );
    }

    if (categoryFilter !== 'All') {
        relevantEvents = relevantEvents.filter(event =>
            event.category && event.category.toLowerCase() === categoryFilter.toLowerCase()
        );
    }

    const groupedEvents = new Map();

    relevantEvents.forEach(event => {
        const eventId = `${event.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}_${event.time ? event.time.replace(/[^a-zA-Z0-9]/g, '') : 'no_time'}`;
        const groupKey = eventId;

        let adjustedTime = 'Time not available';

        if (event.time) {
            try {
                let eventDateTime;

                if (event.time.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                    const [hours, minutes, seconds = 0] = event.time.split(':').map(Number);

                    const todayUtc = new Date(Date.UTC(
                        new Date().getUTCFullYear(),
                        new Date().getUTCMonth(),
                        new Date().getUTCDate(),
                        hours, minutes, seconds
                    ));

                    eventDateTime = new Date(todayUtc.getTime() - (SOURCE_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000));

                } else {
                    eventDateTime = new Date(event.time);
                }

                if (!isNaN(eventDateTime.getTime())) {
                    const adjustedDateTimeMs = eventDateTime.getTime() + (TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
                    const adjustedDateTime = new Date(adjustedDateTimeMs);

                    adjustedTime = adjustedDateTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    });

                } else {
                    console.warn(`[EventManager] Could not parse "${event.time}" as a valid date/time. Showing original string.`);
                    adjustedTime = event.time;
                }

            } catch (e) {
                console.error(`[EventManager] Exception while processing date/time for "${event.title}" ("${event.time}"):`, e.message);
                adjustedTime = event.time || 'Date/time error';
            }
        }

        const displayStatus = event.status ? event.status.toUpperCase() : 'UNKNOWN';

        let newDescription = `Enjoy ${event.title}`;
        if (displayStatus === 'EN VIVO') {
            newDescription += ` live.`;
        } else if (displayStatus === 'PRONTO') {
            newDescription += `. Starts at ${adjustedTime}.`;
        } else if (displayStatus === 'FINALIZADO') {
            newDescription += `. Finished at ${adjustedTime}.`;
        } else {
            newDescription += `. Status: ${displayStatus}.`;
        }

        if (!groupedEvents.has(groupKey)) {
            const posterImage = getPosterImage(event.title, event.status);
            const backgroundImage = getBackgroundImage(event.title);

            groupedEvents.set(groupKey, {
                id: eventId,
                title: event.title,
                time: adjustedTime,
                category: event.category,
                description: newDescription,
                displayStatus: displayStatus,
                poster: posterImage,
                background: backgroundImage,
                links: []
            });
        }
        groupedEvents.get(groupKey).links.push(event.link);
    });

    return Array.from(groupedEvents.values());
}

module.exports = {
    getGroupedEvents,
    fetchAllEvents
};
