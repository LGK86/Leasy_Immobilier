export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  // Verify ownership (path starts with user id)
  if (!filePath.startsWith(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase.storage.from('documents').download(filePath)
  if (error || !data) return NextResponse.json({ error: 'File not found' }, { status: 404 })

  const arrayBuffer = await data.arrayBuffer()
  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filePath.split('/').pop()}"`,
    },
  })
}
