import handleEvent from './event-handler.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, referer'
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return new Response('Wrong request method', { status: 405, headers: corsHeaders })
    }

    let body

    try {
      body = await request.json()
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders })
    }

    const headers = Object.fromEntries(request.headers.entries())

    ctx.waitUntil(handleEvent(body, headers, env))

    return new Response('Worker started', { status: 202, headers: corsHeaders })
  }
}