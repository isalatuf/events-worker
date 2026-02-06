import handleFbEvent from './fb-event-handler.js'
import handleGaEvent from './ga-event-handler.js'

export default async function (body, headers, env) {
    const { name, user, id, cookies } = body || {}

    if (!id) return console.error('Event id is missing')
    if (!name) return console.error('Event name is missing')

    const nameMap = ({
        pageview: { fb: 'PageView', ga: 'page_view' },
        lead: { fb: 'Lead', ga: 'generate_lead' },
        signup: { fb: 'Lead', ga: 'sign_up' },
        checkout: { fb: 'InitiateCheckout', ga: 'begin_checkout' },
        purchase: { fb: 'Purchase', ga: 'purchase' }
    })[name] || {}

    if (!nameMap) return console.error('Event name is invalid')

    console.log({ id, name })

    const timestamp = Math.floor(Date.now() / 1000)

    const referrer = headers['referer'] || null

    const clientIp = headers['cf-connecting-ip'] ||
        headers['x-forwarded-for']?.split(',')[0].trim() ||
        null

    const userAgent = headers['user-agent'] || null

    function extractUtms(url) {
        let utms = {
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            utm_content: null,
            utm_term: null,
        };

        if (!url) return utms;

        const params = url.split("?")[1];
        if (!params) return utms;

        params.split("&").forEach((p) => {
            const [rawKey, rawValue] = p.split("=");
            if (!rawKey || !rawValue) return;

            const key = decodeURIComponent(rawKey);
            const value = decodeURIComponent(rawValue);

            if (key in utms) {
                utms[key] = value;
            }
        });

        return utms;
    }

    const utms = extractUtms(referrer)

    async function encrypt(value) {
        const data = new TextEncoder().encode(value.trim().toLowerCase())
        const hash = await crypto.subtle.digest('SHA-256', data)
        return Array.from(new Uint8Array(hash)).map(item => item.toString(16).padStart(2, '0')).join('')
    }

    const encryptedUserPhone = user?.phone ? await encrypt(user.phone) : null
    const encryptedUserEmail = user?.email ? await encrypt(user.email) : null

    const tasks = []

    if (env.FB_PIXEL_ID && env.FB_ACCESS_TOKEN && nameMap.fb) {
        const fbPayload = {
            data: [
                {
                    event_name: nameMap.fb,
                    event_id: id,
                    event_time: timestamp,
                    action_source: 'website',
                    event_source_url: referrer,
                    user_data: {
                        ph: encryptedUserPhone,
                        em: encryptedUserEmail,
                        fbp: cookies?.fbp,
                        fbc: cookies?.fbc,
                        client_user_agent: userAgent,
                        client_ip_address: clientIp
                    },
                    custom_data: {
                        page_referrer: referrer,
                        ...utms
                    },
                }]
        }

        tasks.push(handleFbEvent(fbPayload, env))
    } else {
        console.warn('Facebook event skipped')
    }

    if (env.GA_MEASUREMENT_ID && env.GA_ACCESS_TOKEN && nameMap.ga) {
        const gaPayload = {
            client_id: user?.clientId,
            user_properties: {
                phone: encryptedUserPhone,
                email: encryptedUserEmail
            },
            events: [
                {
                    name: nameMap.ga,
                    params: {
                        page_location: referrer,
                        page_referrer: referrer,
                        event_id: id,
                        engagement_time_msec: 1,
                        ...utms
                    }
                }
            ]
        }

        tasks.push(handleGaEvent(gaPayload, env))
    } else {
        console.warn('Google Analytics event skipped')
    }

    if (tasks.length > 0) await Promise.all(tasks)
}