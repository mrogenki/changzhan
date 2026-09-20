import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1"

declare const Deno: { env: { get(k: string): string | undefined } }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase()
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const json = (b: unknown, s = 200) => {
    if (s >= 400) console.error('manage-admin failed', s, JSON.stringify(b))
    return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    const URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

    // 依 email 找出 Auth 帳號（admin API 無直接查詢，掃分頁比對）
    const findAuthUser = async (email: string) => {
      const target = normEmail(email)
      if (!target) return null
      for (let page = 1; page <= 10; page++) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
        const users = data?.users ?? []
        const hit = users.find((u: any) => normEmail(u.email) === target)
        if (hit) return hit
        if (users.length < 1000) break
      }
      return null
    }

    // 驗證呼叫者：必須是已登入、且在 admins 表中的「總管理員」
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '')
    const { data: userData } = await admin.auth.getUser(jwt)
    const callerEmail = userData?.user?.email
    if (!callerEmail) return json({ error: 'unauthorized', message: '請重新登入' }, 401)
    const { data: callerAdmin } = await admin.from('admins').select('id, role, can_edit').ilike('email', callerEmail).maybeSingle()
    if (!callerAdmin) return json({ error: 'forbidden', message: '此帳號沒有後台權限' }, 403)
    if (callerAdmin.role !== '總管理員') return json({ error: 'forbidden', message: '僅總管理員可管理人員權限' }, 403)
    // 被設為「僅檢視」的總管理員一樣不能動人員設定（否則等於留了一個後門）
    if (callerAdmin.can_edit === false) return json({ error: 'forbidden', message: '你的帳號為僅檢視權限，無法管理人員' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const adopt = body.adopt === true

    if (action === 'create') {
      const name = String(body.name || '').trim()
      const email = normEmail(body.email)
      const password = String(body.password || '')
      const role = String(body.role || '')
      const canEdit = body.can_edit === false ? false : true
      if (!name) return json({ error: 'invalid_params', message: '姓名必填' }, 400)
      if (!isEmail(email)) return json({ error: 'invalid_params', message: 'Email 格式不正確' }, 400)
      if (password.length < 6) return json({ error: 'invalid_params', message: '密碼至少 6 碼' }, 400)

      const { data: dup } = await admin.from('admins').select('id').ilike('email', email).maybeSingle()
      if (dup) return json({ error: 'duplicated', message: '此 Email 已在人員名單中' }, 400)

      // 兩系統共用 Supabase Auth：此 Email 可能已有帳號（例：引薦單報告的使用者）
      const existing = await findAuthUser(email)
      if (existing) {
        if (!adopt) {
          return json({
            error: 'email_has_account',
            message: `${email} 在系統中已有登入帳號（可能來自引薦單報告）。可直接沿用該帳號並授予後台權限。`,
          }, 409)
        }
        const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { ...(existing as any).user_metadata, name, role, changzhan_admin: true },
        } as any)
        if (upErr) return json({ error: 'auth_update_failed', message: upErr.message }, 400)
      } else {
        const { error: authErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { name, role, changzhan_admin: true },
        })
        if (authErr) return json({ error: 'auth_create_failed', message: authErr.message }, 400)
      }

      const { error: insErr } = await admin.from('admins').insert([{ name, role, email, password: '', can_edit: canEdit }])
      if (insErr) return json({ error: 'db_insert_failed', message: insErr.message }, 400)
      return json({ ok: true, adopted: !!existing })
    }

    if (action === 'update') {
      const id = body.id
      if (id === undefined || id === null) return json({ error: 'missing_id' }, 400)
      const { data: target } = await admin.from('admins').select('id, name, role, email, can_edit').eq('id', id).maybeSingle()
      if (!target) return json({ error: 'not_found', message: '找不到此人員' }, 404)

      const name = body.name === undefined ? target.name : String(body.name).trim()
      const role = body.role === undefined ? target.role : String(body.role)
      const email = body.email === undefined ? normEmail(target.email) : normEmail(body.email)
      const password = body.password === undefined ? '' : String(body.password)
      const canEdit = body.can_edit === undefined ? target.can_edit : body.can_edit !== false
      if (!name) return json({ error: 'invalid_params', message: '姓名必填' }, 400)
      if (!isEmail(email)) return json({ error: 'invalid_params', message: 'Email 格式不正確' }, 400)
      if (password && password.length < 6) return json({ error: 'invalid_params', message: '密碼至少 6 碼' }, 400)

      const targetEmail = normEmail(target.email)
      const emailChanged = email !== targetEmail

      if (emailChanged) {
        const { data: dup } = await admin.from('admins').select('id').ilike('email', email).neq('id', id).maybeSingle()
        if (dup) return json({ error: 'duplicated', message: '此 Email 已被其他人員使用' }, 400)
      }

      const authUser = await findAuthUser(targetEmail)
      if (!authUser) return json({ error: 'auth_user_not_found', message: '找不到對應的登入帳號，請刪除後重新新增' }, 404)

      // 目標 Email 已有其他 Auth 帳號（共用 Auth，可能來自引薦單報告）→ 改為沿用該帳號
      const existing = emailChanged ? await findAuthUser(email) : null
      if (existing && existing.id !== authUser.id) {
        if (!adopt) {
          return json({
            error: 'email_has_account',
            message: `${email} 在系統中已有登入帳號（可能來自引薦單報告）。可改為沿用該帳號登入，原本的 ${targetEmail} 帳號會一併移除。`,
          }, 409)
        }
        const patch: Record<string, unknown> = {
          user_metadata: { ...(existing as any).user_metadata, name, role, changzhan_admin: true },
        }
        if (password) patch.password = password
        const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, patch as any)
        if (upErr) return json({ error: 'auth_update_failed', message: upErr.message }, 400)

        const { error: updErr } = await admin.from('admins').update({ name, role, email, can_edit: canEdit }).eq('id', id)
        if (updErr) return json({ error: 'db_update_failed', message: updErr.message }, 400)

        // admins 已指向新帳號後才移除舊的手機衍生帳號；失敗不影響結果
        const { error: delErr } = await admin.auth.admin.deleteUser(authUser.id)
        if (delErr) console.error('adopt: 舊 Auth 帳號刪除失敗', authUser.id, delErr.message)
        return json({ ok: true, adopted: true })
      }

      const patch: Record<string, unknown> = {
        user_metadata: { ...(authUser as any).user_metadata, name, role, changzhan_admin: true },
      }
      if (emailChanged) {
        patch.email = email
        patch.email_confirm = true
      }
      if (password) patch.password = password

      const { error: authErr } = await admin.auth.admin.updateUserById(authUser.id, patch as any)
      if (authErr) return json({ error: 'auth_update_failed', message: authErr.message }, 400)

      const { error: updErr } = await admin.from('admins').update({ name, role, email, can_edit: canEdit }).eq('id', id)
      if (updErr) return json({ error: 'db_update_failed', message: updErr.message }, 400)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const id = body.id
      if (id === undefined || id === null) return json({ error: 'missing_id' }, 400)
      const { data: target } = await admin.from('admins').select('id, email').eq('id', id).maybeSingle()
      if (!target) return json({ error: 'not_found', message: '找不到此人員' }, 404)
      if (String(target.id) === String(callerAdmin.id)) return json({ error: 'self_delete', message: '無法刪除自己' }, 400)
      const au = await findAuthUser(target.email || '')
      if (au) await admin.auth.admin.deleteUser(au.id)
      const { error: delErr } = await admin.from('admins').delete().eq('id', id)
      if (delErr) return json({ error: 'db_delete_failed', message: delErr.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'unknown_action', message: '未知的操作' }, 400)
  } catch (e) {
    return json({ error: 'unexpected', message: String((e as Error)?.message ?? e) }, 500)
  }
})
