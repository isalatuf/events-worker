export default async function (payload, env) {
    console.info('Google Analytics event process started')

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