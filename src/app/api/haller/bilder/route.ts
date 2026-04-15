import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

// POST /api/haller/bilder — upload image for a hall (admin only)
export async function POST(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const halId = formData.get('hal_id') as string | null

  if (!file || !halId) {
    return NextResponse.json({ error: 'Mangler fil eller hal_id' }, { status: 400 })
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Ugyldig filtype: ${file.type}. Tillatte typer: JPG, PNG, WebP, GIF` },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `Filen er for stor (${(file.size / 1024 / 1024).toFixed(1)} MB). Maks 5 MB.` },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${halId}/${Date.now()}.${ext}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('hall-bilder')
    .upload(fileName, file, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('hall-bilder')
    .getPublicUrl(fileName)

  // Add URL to haller.bilder array
  const { data: hall } = await supabase
    .from('haller')
    .select('bilder')
    .eq('id', halId)
    .single()

  const currentBilder = hall?.bilder ?? []
  const { data, error } = await supabase
    .from('haller')
    .update({ bilder: [...currentBilder, publicUrl] })
    .eq('id', halId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ url: publicUrl, hall: data }, { status: 201 })
}

// PUT /api/haller/bilder — hent bilde fra en URL (web) og last opp til Storage
// Body: { hal_id, url } — admin only
export async function PUT(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const { hal_id, url } = (await request.json()) as { hal_id?: string; url?: string }
  if (!hal_id || !url) return NextResponse.json({ error: 'Mangler hal_id eller url' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch { return NextResponse.json({ error: 'Ugyldig URL' }, { status: 400 }) }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Bare http(s) er tillatt' }, { status: 400 })
  }

  // Hent bildet
  let resp: Response
  try {
    resp = await fetch(parsed.toString(), { headers: { 'User-Agent': 'AktivitetssalerOslo/1.0' }, redirect: 'follow' })
  } catch (e: any) {
    return NextResponse.json({ error: `Kunne ikke hente bildet: ${e.message}` }, { status: 502 })
  }
  if (!resp.ok) return NextResponse.json({ error: `Kilde svarte ${resp.status}` }, { status: 502 })

  const contentType = (resp.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: `Ugyldig bildetype: ${contentType || 'ukjent'}` }, { status: 400 })
  }

  const buf = Buffer.from(await resp.arrayBuffer())
  if (buf.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: `Bildet er for stort (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB). Maks 5 MB.` }, { status: 400 })
  }

  const supabase = createAdminClient()
  const ext = contentType === 'image/jpeg' ? 'jpg'
    : contentType === 'image/png' ? 'png'
    : contentType === 'image/webp' ? 'webp' : 'gif'
  const fileName = `${hal_id}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('hall-bilder')
    .upload(fileName, buf, { contentType, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('hall-bilder').getPublicUrl(fileName)

  const { data: hall } = await supabase.from('haller').select('bilder').eq('id', hal_id).single()
  const currentBilder = hall?.bilder ?? []
  const { data, error } = await supabase
    .from('haller')
    .update({ bilder: [...currentBilder, publicUrl] })
    .eq('id', hal_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: publicUrl, hall: data, kilde: parsed.toString() }, { status: 201 })
}

// DELETE /api/haller/bilder — remove image from a hall (admin only)
export async function DELETE(request: NextRequest) {
  const { error: authError } = await verifyAdmin()
  if (authError) return authError

  const { hal_id, url } = await request.json()

  if (!hal_id || !url) {
    return NextResponse.json({ error: 'Mangler hal_id eller url' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Remove from storage
  const path = url.split('/hall-bilder/')[1]
  if (path) {
    await supabase.storage.from('hall-bilder').remove([path])
  }

  // Remove URL from haller.bilder array
  const { data: hall } = await supabase
    .from('haller')
    .select('bilder')
    .eq('id', hal_id)
    .single()

  const updatedBilder = (hall?.bilder ?? []).filter((b: string) => b !== url)
  const { data, error } = await supabase
    .from('haller')
    .update({ bilder: updatedBilder.length > 0 ? updatedBilder : null })
    .eq('id', hal_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ hall: data })
}
