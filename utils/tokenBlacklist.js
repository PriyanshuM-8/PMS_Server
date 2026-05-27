const blacklist = new Set()

export const addToBlacklist = (token) => blacklist.add(token)
export const isBlacklisted = (token) => blacklist.has(token)
