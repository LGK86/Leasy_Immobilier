/**
 * Fermeture automatique lors de la finalisation d'un EDL de sortie.
 * Appelé depuis generate/route.ts et tenant-sign/route.ts.
 *
 * Statuts valides pour documents.status :
 *   'draft' | 'sent' | 'signed' | 'pending_tenant_signature' | 'finalized'
 * La clôture utilise status='finalized' + content.closed_at (pas de statut 'closed').
 */
export async function closeExitInspection(
  supabase: any,
  doc: any,
  userId: string
): Promise<void> {
  if (doc.type !== 'exit_inspection') return

  const closedAt = new Date().toISOString()
  console.log('=== closeExitInspection called ===')
  console.log('document.id:', doc.id)
  console.log('property_id:', doc.property_id)
  console.log('linked_inspection_id:', doc.content?.linked_inspection_id)
  console.log('tenant_ids:', doc.content?.tenant_ids)

  // 1. Bien → vacant
  if (doc.property_id) {
    const { error: e1 } = await supabase
      .from('properties')
      .update({ status: 'vacant', updated_at: closedAt })
      .eq('id', doc.property_id)
      .eq('owner_id', userId)
    console.log('Property update:', e1 ? e1.message : 'OK')
  }

  // 2. Locataires → inactive
  const tenantIds: string[] = Array.isArray(doc.content?.tenant_ids)
    ? doc.content.tenant_ids
    : []
  if (tenantIds.length > 0) {
    const { error: e2 } = await supabase
      .from('tenants')
      .update({ status: 'inactive', updated_at: closedAt })
      .in('id', tenantIds)
      .eq('owner_id', userId)
    console.log('Tenants update:', e2 ? e2.message : 'OK')
  }

  // 3. EDL d'entrée lié → finalized + closed_at
  if (doc.content?.linked_inspection_id) {
    const { data: entryDoc, error: eFetch } = await supabase
      .from('documents')
      .select('id, content')
      .eq('id', doc.content.linked_inspection_id)
      .eq('owner_id', userId)
      .single()
    console.log('Entry inspection fetch:', eFetch ? eFetch.message : 'OK')
    if (entryDoc) {
      const { error: e3 } = await supabase
        .from('documents')
        .update({
          status: 'finalized',
          content: { ...entryDoc.content, closed_at: closedAt },
          updated_at: closedAt,
        })
        .eq('id', doc.content.linked_inspection_id)
        .eq('owner_id', userId)
      console.log('Entry inspection close:', e3 ? e3.message : 'OK')
    }
  }

  // 4. Bail actif → finalized + closed_at
  if (doc.property_id) {
    const { data: leaseDoc, error: lFetch } = await supabase
      .from('documents')
      .select('id, content')
      .eq('property_id', doc.property_id)
      .eq('type', 'lease')
      .eq('owner_id', userId)
      .in('status', ['signed', 'pending_tenant_signature', 'finalized'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    console.log('Lease fetch:', lFetch ? lFetch.message : 'OK')
    if (leaseDoc) {
      const { error: e4 } = await supabase
        .from('documents')
        .update({
          status: 'finalized',
          content: { ...leaseDoc.content, closed_at: closedAt },
          updated_at: closedAt,
        })
        .eq('id', leaseDoc.id)
        .eq('owner_id', userId)
      console.log('Lease close:', e4 ? e4.message : 'OK')
    }
  }
}
