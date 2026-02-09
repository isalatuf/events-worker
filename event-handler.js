import handleFbEvent from './fb-event-handler.js'
import handleGaEvent from './ga-event-handler.js'

export default async function (body, headers, env) {
    const { event, user, id, cookies } = body || {}

    if (!id) return console.error('Event id is missing')
    if (!event) return console.error('Event name is missing')

    const eventMap = {
        pageview: { fb: 'PageView', ga: 'page_view' },
        lead: { fb: 'Lead', ga: 'generate_lead' },
        signup: { fb: 'Lead', ga: 'sign_up' },
        login: { fb: 'Login', ga: 'login' },
        search: { fb: 'Search', ga: 'search' },
        viewcontent: { fb: 'ViewContent', ga: 'view_item' },
        addtocart: { fb: 'AddToCart', ga: 'add_to_cart' },
        addtowishlist: { fb: 'AddToWishlist', ga: 'add_to_wishlist' },
        checkout: { fb: 'InitiateCheckout', ga: 'begin_checkout' },
        addpaymentinfo: { fb: 'AddPaymentInfo', ga: 'add_payment_info' },
        purchase: { fb: 'Purchase', ga: 'purchase' },
        subscribe: { fb: 'Subscribe', ga: 'subscribe' },
        contact: { fb: 'Contact', ga: 'contact' },
        download: { fb: 'Download', ga: 'file_download' }
    }[event]

    if (!eventMap) return console.error('Event name is invalid')

    console.log({ id, event })

    const timestamp = Math.floor(Date.now() / 1000)

    const referrer = headers['referer'] || null

    const clientIp = headers['cf-connecting-ip'] ||
        headers['x-forwarded-for']?.split(',')[0].trim() ||
        null

    const userAgent = headers['user-agent'] || null

    function extractQueryParams(input, queryParams) {
        const output = {};

        for (const key of queryParams) {
            output[key] = null;
        }

        if (!input) return output;

        const query = input.split("?")[1];
        if (!query) return output;

        const parts = query.split("&");

        for (let i = 0; i < parts.length; i++) {
            const [key, value] = parts[i].split("=");
            if (!key || !value) continue;

            if (key in output) {
                output[key] = decodeURIComponent(value);
            }
        }

        return output;
    }

    const queryParams = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
    ];

    const referrerParams = extractQueryParams(referrer, queryParams)

    async function encrypt(value) {
        const data = new TextEncoder().encode(value.trim().toLowerCase())
        const hash = await crypto.subtle.digest('SHA-256', data)
        return Array.from(new Uint8Array(hash)).map(item => item.toString(16).padStart(2, '0')).join('')
    }

    const encryptedUserPhone = user?.phone ? await encrypt(user.phone) : null
    const encryptedUserEmail = user?.email ? await encrypt(user.email) : null

    const tasks = []

    if (env.FB_PIXEL_ID && env.FB_ACCESS_TOKEN && eventMap.fb) {
        const fbPayload = {
            data: [
                {
                    event_name: eventMap.fb,
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
                        ...referrerParams
                    },
                }]
        }

        tasks.push(handleFbEvent(fbPayload, env))
    } else {
        console.warn('Facebook event skipped')
    }

    if (env.GA_MEASUREMENT_ID && env.GA_ACCESS_TOKEN && eventMap.ga) {
        const gaPayload = {
            client_id: user?.clientId,
            user_properties: {
                phone: encryptedUserPhone,
                email: encryptedUserEmail
            },
            events: [
                {
                    name: eventMap.ga,
                    params: {
                        page_location: referrer,
                        page_referrer: referrer,
                        event_id: id,
                        engagement_time_msec: 1,
                        ...referrerParams
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