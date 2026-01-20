import handleFbEvent from './fb-event-handler.js'
import handleGaEvent from './ga-event-handler.js'

export default async function (body, headers, env) {
    if (!body.id) return console.error('Event id is missing')

    function extractUrlParams(url) {
        const parts = url.split('?')[1]
        if (!parts) return {}
        const urlParams = {}
        parts.split('&').forEach(p => {
            const [k, v] = p.split('=')
            const camel = k.replace(/-([a-z])/g, g => g[1].toUpperCase()).replace(/_([a-z])/g, g => g[1].toUpperCase())
            urlParams[camel] = decodeURIComponent(v || '')
        })
        return urlParams
    }

    const referrer = headers['referer'] || null
    const qp = referrer ? extractUrlParams(referrer) : {}

    async function sha256(value) {
        const data = new TextEncoder().encode(value.trim().toLowerCase())
        const hash = await crypto.subtle.digest('SHA-256', data)
        return Array.from(new Uint8Array(hash)).map(item => item.toString(16).padStart(2, '0')).join('')
    }

    const event = {
        id: body.id || null,
        name: body.name || null,
        fbName: body.fbName || null,
        gaName: body.gaName || null,
        hashedUserPhone: body.userPhone ? await sha256(body.userPhone) : null,
        hashedUserEmail: body.userEmail ? await sha256(body.userEmail) : null,
        cookieFbp: body.cookieFbp || null,
        cookieFbc: body.cookieFbc || null,
        utmSource: qp.utmSource || null,
        utmMedium: qp.utmMedium || null,
        utmCampaign: qp.utmCampaign || null,
        utmContent: qp.utmContent || null,
        utmTerm: qp.utmTerm || null,
        userAgent: headers['user-agent'] || null,
        referrer,
        clientIp: headers['cf-connecting-ip'] ||
            headers['x-forwarded-for']?.split(',')[0].trim() ||
            null,
        timestamp: Math.floor(Date.now() / 1000)
    }

    const tasks = []

    if (env.FB_PIXEL_ID && env.FB_ACCESS_TOKEN && event.fbName && event.clientIp) {
        tasks.push(handleFbEvent(event, env))
    } else {
        console.warn('Facebook event skipped')
    }

    if (env.GA_MEASUREMENT_ID && env.GA_ACCESS_TOKEN && event.gaName && event.clientIp) {
        tasks.push(handleGaEvent(event, env))
    } else {
        console.warn('Google Analytics event skipped')
    }

    if (tasks.length > 0) await Promise.all(tasks)
}