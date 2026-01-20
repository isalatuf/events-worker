export default async function (event, env) {
    console.info('Google Analytics event process started')

    const payload = {
        client_id: event.clientIp,
        user_properties: {
            phone: event.hashedUserPhone,
            email: event.hashedUserEmail
        },
        events: [
            {
                name: event.gaName,
                params: {
                    page_location: event.referrer,
                    page_referrer: event.referrer,
                    event_id: event.id,
                    engagement_time_msec: 1,
                    utm_source: event.utmSource,
                    utm_medium: event.utmMedium,
                    utm_campaign: event.utmCampaign,
                    utm_content: event.utmContent,
                    utm_term: event.utmTerm
                }
            }
        ]
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
        const res = await fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${env.GA_MEASUREMENT_ID}&api_secret=${env.GA_ACCESS_TOKEN}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        )

        if (!res.ok) {
            const text = await res.text()
            console.error('Google Analytics event request error: ' + text)
            return
        }
    } catch {
        console.error('Google Analytics event request failed')
        return
    } finally {
        clearTimeout(timeout)
    }

    console.info(`Google Analytics event processed succesfully`)
    return
}