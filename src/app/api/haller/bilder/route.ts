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
