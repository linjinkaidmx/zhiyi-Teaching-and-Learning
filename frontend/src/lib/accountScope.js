// Account caches are keyed by immutable server identity. Legacy unowned caches stay untouched.
let identity = ''
export function setAccountScope(id) {
  identity = id == null ? '' : String(id)
}
export function getAccountScope() { return identity }
export function accountKey(base) { return `${base}:uid:${identity || 'unresolved'}` }
export function personalKey(base) { return identity ? accountKey(base) : `${base}:guest` }
