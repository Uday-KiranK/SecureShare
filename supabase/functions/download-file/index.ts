import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json()

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role key for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validate the share link token
    const { data: shareLinks, error: linkError } = await supabaseAdmin
      .rpc('get_share_link_by_token', { link_token: token })

    if (linkError || !shareLinks || shareLinks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const shareLink = shareLinks[0]

    // Check if link is valid
    const now = new Date()
    const isExpired = shareLink.expires_at ? new Date(shareLink.expires_at) < now : false
    const limitReached = shareLink.max_downloads ? 
      shareLink.current_downloads >= shareLink.max_downloads : false

    if (!shareLink.is_active || isExpired || limitReached) {
      return new Response(
        JSON.stringify({ error: 'Link is no longer valid' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the download attempt
    // Extract first IP from x-forwarded-for (can contain multiple IPs)
    const forwardedFor = req.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor 
      ? forwardedFor.split(',')[0].trim() 
      : (req.headers.get('x-real-ip') || '0.0.0.0')
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const { error: logError } = await supabaseAdmin.rpc('log_download', {
      link_token: token,
      user_agent_text: userAgent,
      ip_addr: ipAddress
    })

    if (logError) {
      console.error('Error logging download:', logError)
      return new Response(
        JSON.stringify({ error: logError.message || 'Failed to log download' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate a signed URL with 1 hour expiration
    const { data: signedUrlData, error: urlError } = await supabaseAdmin
      .storage
      .from('secure-files')
      .createSignedUrl(shareLink.storage_path, 3600) // 1 hour

    if (urlError || !signedUrlData) {
      console.error('Error creating signed URL:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to generate download URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        signedUrl: signedUrlData.signedUrl,
        filename: shareLink.original_filename 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in download-file function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
