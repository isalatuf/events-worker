export default async function (event, env) {
    console.info('Facebook event process started')

    const payload = {
        data: [
            {
                event_name: event.fbName,
                event_id: event.id,
                event_time: event.timestamp,
                action_source: 'website',
                event_source_url: event.referrer,
                user_data: {
                    ph: event.hashedUserPhone,
                    em: event.hashedUserEmail,
                    fbp: event.cookieFbp,
                    fbc: event.cookieFbc,
                    client_user_agent: event.userAgent,
                    client_ip_address: event.clientIp
                },
                custom_data: {
                    page_referrer: event.referrer,
                    utm_source: event.utmSource,
                    utm_medium: event.utmMedium,
                    utm_campaign: event.utmCampaign,
                    utm_content: event.utmContent,
                    utm_term: event.utmTerm
                }
            }]
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
        const res = await fetch(
            `https://graph.facebook.com/v18.0/${env.FB_PIXEL_ID}/events?access_token=${env.FB_ACCESS_TOKEN}${env.FB_TEST_EVENT_CODE ? `&test_event_code=${env.FB_TEST_EVENT_CODE}` : ''}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        )

        const text = await res.text()

        if (!res.ok) {
            try {
                const json = JSON.parse(text)
                console.error('Facebook event request error: ' + (json.error?.error_user_msg || json.error?.message || text))
                return
            } catch {
                console.error('Facebook event request error: ' + text)
                return
            }
        }
    } catch {
        console.error('Facebook event request failed')
        return
    } finally {
        clearTimeout(timeout)
    }

    console.info(`Facebook event processed succesfully`)
    return
}