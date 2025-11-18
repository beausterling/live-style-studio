// User Preferences Edge Function
// Handles storing and retrieving user preferences like Twitch stream keys

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    })

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { action, key, value } = await req.json()

    if (action === 'save') {
      // Save preference
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          preference_key: key,
          preference_value: value,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    } else if (action === 'load') {
      // Load preference
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', user.id)
        .eq('preference_key', key)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw error
      }

      return new Response(
        JSON.stringify({ value: data?.preference_value || null }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    } else {
      throw new Error('Invalid action')
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
