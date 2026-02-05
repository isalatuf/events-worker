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

    const timestamp = Math.floor(Date.now() / 1000)

    const referrer = headers['referer'] || null

    const clientIp = headers['cf-connecting-ip'] ||
        headers['x-forwarded-for']?.split(',')[0].trim() ||
        null

    const userAgent = headers['user-agent'] || null

    function extractUtms(url) {
        if (!url) return { utm: null }

        const params = url.split('?')[1]
        if (!params) return { utm: null }

        const utms = {}
        params.split('&').forEach(p => {
            const [k, v] = p.split('=')
            if (k?.startsWith('utm_') && v) {
                utms[k.replace(/^utm_/, '')] = decodeURIComponent(v)
            }
        })
        return utms
    }

    const utms = referrer ? extractUtms(referrer) : {}

    async function sha256(value) {
        const data = new TextEncoder().encode(value.trim().toLowerCase())
        const hash = await crypto.subtle.digest('SHA-256', data)
        return Array.from(new Uint8Array(hash)).map(item => item.toString(16).padStart(2, '0')).join('')
    }

    const hashedUser = {
        phone: user?.phone ? await sha256(user.phone) : null,
        email: user?.email ? await sha256(user.email) : null
    }

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
                        ph: hashedUser.phone,
                        em: hashedUser.email,
                        fbp: cookies.fbp,
                        fbc: cookies.fbc,
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
            client_id: clientIp,
            user_properties: {
                phone: hashedUser.phone,
                email: hashedUser.email
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