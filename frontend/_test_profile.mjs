/**
 * 个人资料纯逻辑测试（profile.js）
 * 用法：node _test_profile.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const TMP = path.join(here, '_profile_tmp.mjs')
writeFileSync(TMP, readFileSync(path.join(here, 'src', 'profile.js'), 'utf8'))

// 注入 localStorage 桩，覆盖持久化路径
const store = new Map()
globalThis.localStorage = {
  get length() { return store.size },
  key: (i) => [...store.keys()][i] || null,
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}

const P = await import('./_profile_tmp.mjs')

let pass = 0
let fail = 0
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log('  ✓ ' + label) }
  else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')) }
}
const eq = (got, want, label) => ok(got === want, label, { got, want })
const section = (t) => console.log('\n' + t)
const AVA = 'data:image/jpeg;base64,AAAA'

section('1. 归一化：脏数据不崩、非法值被纠正')
{
  const d = P.normalizeProfile(null)
  eq(d.bio, '', 'null → 空资料')
  eq(d.prefs.renderMath, true, '默认开启公式渲染')
  eq(d.prefs.fontScale, 'md', '默认标准字号')

  const dirty = P.normalizeProfile({
    avatar: 'http://evil/x.png', avatarColor: 'red', grade: '大七',
    bio: 'x'.repeat(200), prefs: { renderMath: false, fontScale: 'huge', defaultMode: 'turbo' },
  })
  eq(dirty.avatar, '', '非 dataURL 的头像被丢弃')
  eq(dirty.avatarColor, '', '非法颜色被清空')
  eq(dirty.grade, '', '非法年级被清空')
  eq(dirty.bio.length, 60, '签名超长被截断')
  eq(dirty.prefs.renderMath, false, 'renderMath=false 被保留')
  eq(dirty.prefs.fontScale, 'md', '非法字号回落标准')
  eq(dirty.prefs.defaultMode, 'deep', '非法档位回落深思')

  const good = P.normalizeProfile({ avatar: AVA, grade: '大三', prefs: { fontScale: 'lg', defaultMode: 'fast' } })
  eq(good.avatar, AVA, '合法头像保留')
  eq(good.grade, '大三', '合法年级保留')
  eq(good.prefs.fontScale, 'lg', '合法字号保留')
  eq(good.prefs.defaultMode, 'fast', '合法档位保留')
}

section('2. 头像首字与配色')
{
  eq(P.avatarLetter('阿哲'), '阿', '中文取首字')
  eq(P.avatarLetter('  bob '), 'b', '英文取首字母')
  eq(P.avatarLetter(''), '知', '空名回落「知」')
  eq(P.avatarLetter('🎓考研人'), '🎓', 'emoji 不被截断')
  const c1 = P.avatarColorOf({}, '阿哲')
  const c2 = P.avatarColorOf({}, '阿哲')
  eq(c1, c2, '同一昵称颜色稳定')
  ok(P.AVATAR_COLORS.includes(c1), '颜色来自预设色板')
  const picked = '#1d9e75'
  eq(P.avatarColorOf({ avatarColor: picked }, '阿哲'), picked, '用户选色优先')
}

section('3. 云端合并：本地非空优先，偏好以本地为准')
{
  const local = P.normalizeProfile({ bio: '本机签名', prefs: { fontScale: 'lg' } })
  const remote = P.normalizeProfile({ bio: '云端签名', school: '××大学', avatar: AVA, prefs: { fontScale: 'sm' } })
  const m = P.mergeProfile(local, remote)
  eq(m.bio, '本机签名', '本地有值用本地')
  eq(m.school, '××大学', '本地为空用云端')
  eq(m.avatar, AVA, '头像取非空一方')
  eq(m.prefs.fontScale, 'lg', '偏好以本地为准')
  eq(P.mergeProfile(local, null).bio, '本机签名', '云端为空时保留本地')
  ok(P.isProfileRicher(remote, local) === true, '云端资料更完整时返回 true')
  ok(P.isProfileRicher(P.emptyProfile(), remote) === false, '本地全空 → 不算更丰富')
}

section('4. 备份包：构建与校验')
{
  const pack = P.buildExport({
    profile: { bio: 'hi' }, stats: { streak: { current: 3 } },
    items: [{ id: 1, question: 'q' }, { id: null }, { bad: true }],
    settings: { srsEnabled: true }, nickname: '阿哲',
  })
  eq(pack.app, 'zhiyi', '带应用标识')
  eq(pack.items.length, 3, '错题原样带出（校验阶段再筛）')

  const v = P.validateImport(pack)
  eq(v.ok, true, '合法备份通过校验')
  eq(v.counts.items, 3, '统计错题条数')
  eq(v.counts.badItems, 2, '能识别出 2 条格式异常的错题')
  eq(v.counts.hasStats, true, '识别出含学习档案')
  eq(v.counts.hasProfile, true, '识别出含个人资料')

  ok(P.validateImport(null).ok === false, 'null 被拒')
  ok(P.validateImport({ app: 'other' }).ok === false, '非本应用备份被拒')
  ok(P.validateImport({ app: 'zhiyi' }).ok === false, '空备份被拒')
  ok(P.validateImport({ app: 'zhiyi', items: [{ id: 1 }] }).ok === true, '只有错题也能导入')

  const fn = P.exportFileName(new Date(2026, 8, 19, 14, 5))
  eq(fn, '知一备份-20260919-1405.json', '导出文件名带时间')
}

section('5. 本地持久化与占用统计')
{
  const p = P.normalizeProfile({ bio: '本地签名', prefs: { defaultMode: 'fast' } })
  P.saveProfile(p, 'guest')
  const back = P.loadProfile('guest')
  eq(back.bio, '本地签名', '保存后能读回')
  eq(back.prefs.defaultMode, 'fast', '偏好一并持久化')

  P.saveProfile(P.normalizeProfile({ bio: '账号空间' }), 'account')
  eq(P.loadProfile('account').bio, '账号空间', '账号空间独立存储')
  eq(P.loadProfile('guest').bio, '本地签名', '两个空间互不覆盖')

  ok(P.storageUsageKB() > 0, '能统计 zhiyi_ 前缀的占用（含小数 KB）')
  store.clear()
  eq(P.loadProfile('guest').bio, '', '数据被清空后回落默认值')
}

console.log('\n' + '='.repeat(46))
console.log(fail === 0 ? `全部通过（${pass} 项断言）` : `有 ${fail} 项未通过（通过 ${pass} 项）`)

try { unlinkSync(TMP) } catch { /* ignore */ }
process.exit(fail === 0 ? 0 : 1)
